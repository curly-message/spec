import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeConcrete, executeGenerated } from './cases';
import { defects, mutations } from './defects';
import { UNITS, executeTree } from './tree';
import type { Adapter, Audited, Case, Fixture, FixtureFile, FormatApi, Identity, Level, Limits, Options, Outcome, Plan, Planned, Result, Skipped, TreeFixtureFile, Verdict } from './types';

export type * from './types';

export { behaviours } from './behaviours';
export { decode } from './decode';
export { defects, mutations } from './defects';

/** The fixture files of a directory, sorted by name. */
export const load = (directory: string): Fixture[] => readdirSync(directory)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => ({ name, file: JSON.parse(readFileSync(join(directory, name), 'utf8')) as FixtureFile }));

/** The set shipped with this package. */
export const fixtures = () => load(fileURLToPath(new URL('../fixtures/', import.meta.url)));

const LEVELS: readonly Level[] = ['core', 'intl', 'extensions'];

const LIMITS = ['output', 'read', 'conversion', 'nesting'] as const;

const APIS: readonly FormatApi[] = ['NumberFormat', 'DateTimeFormat', 'RelativeTimeFormat'];

// The versioned identifier of the format this set reads.
const FORMAT = 'curly-message-3';

// The third statement an adapter makes about itself (section 11.2), held to
// the same vocabulary as the other two before anything runs.
const unexpressibleClaim = (adapter: Adapter) => {
  const declared = adapter.unexpressible;

  if (declared === undefined) return;

  if (typeof declared !== 'object' || declared === null) throw new Error('The adapter must name the properties it cannot express by the request that reads them.');

  for (const [api, names] of Object.entries(declared)) {
    if (!APIS.includes(api as FormatApi)) throw new Error(`The adapter names the facility ${JSON.stringify(api)}; the facilities are ${APIS.join(', ')}.`);

    if (!Array.isArray(names) || names.some((name) => typeof name !== 'string')) throw new Error(`The adapter must name what it cannot express of a ${api} request as a list of property names.`);
  }
};

// The statement CST.md section 4 requires of an implementation that offers a
// tree: the unit its spans are counted in. A tree whose unit is unstated says
// nothing about where anything is, so an adapter that offers one without it is
// refused the way an unknown level is.
const treeClaim = (adapter: Adapter) => {
  const cst = adapter.cst;

  if (cst === undefined) return;

  if (typeof cst !== 'object' || cst === null || typeof cst.parse !== 'function') throw new Error('An adapter that offers a tree must supply the call that produces one as cst.parse.');

  if (!UNITS.includes(cst.unit)) throw new Error(`The adapter counts its spans in ${JSON.stringify(cst.unit)}; the units are ${UNITS.join(', ')}.`);
};

// The adapter's statements about itself, and the levels option, are held to
// the vocabulary of sections 2, 11.2 and 13 before anything runs: a level that
// is not one of the three, or a limit that is not a count, is an error, not a
// skip. A JavaScript adapter is not typed, so its shape is checked as well.
const claims = (adapter: Adapter, options: Options) => {
  const unknown = (levels: readonly Level[], where: string) => {
    const level = levels.find((name) => !LEVELS.includes(name));

    if (level !== undefined) throw new Error(`${where} names the level ${JSON.stringify(level)}; the levels are core, intl and extensions.`);
  };

  if (!Array.isArray(adapter.levels)) throw new Error('The adapter must list the levels it claims.');

  unknown(adapter.levels, 'The adapter');

  if (!adapter.levels.includes('core')) throw new Error('The adapter must claim the core level.');

  if (options.levels) {
    unknown(options.levels, 'The levels option');

    const unclaimed = options.levels.find((level) => !adapter.levels.includes(level));

    if (unclaimed !== undefined) throw new Error(`The adapter does not claim the ${unclaimed} level.`);
  }

  const declared = adapter.limits as Partial<Limits> | undefined;
  const undeclared = LIMITS.find((name) => !Number.isInteger(declared?.[name]) || (declared?.[name] as number) < 1);

  if (undeclared) throw new Error(`The adapter must declare its ${undeclared} limit as a positive integer.`);

  unexpressibleClaim(adapter);
  treeClaim(adapter);
};

// A case whose request reads a property the adapter documented it cannot
// express (section 11.2) measures the host's facility rather than the
// implementation, so it is left out the way an unclaimed level is.
const unexpressible = (c: Case, adapter: Adapter) => {
  if ('generate' in c || !c.expected.format) return undefined;

  const { api, options } = c.expected.format;
  const cannot = adapter.unexpressible?.[api];
  const property = cannot && Object.keys(options ?? {}).find((name) => cannot.includes(name));

  return property && `The adapter cannot express the ${property} property of a ${api} request.`;
};

// Why a level's cases are left out, or nothing where they run.
const exclusion = (level: Level, adapter: Adapter, options: Options) => {
  if (!adapter.levels.includes(level)) return `The adapter does not claim the ${level} level.`;

  if (options.levels && !options.levels.includes(level)) return `The ${level} level is not among the levels being run.`;

  return undefined;
};

const reason = (c: Case, level: Level, adapter: Adapter, options: Options) => {
  const excluded = exclusion(level, adapter, options);

  if (excluded) return excluded;

  return unexpressible(c, adapter);
};

// A file whose format this set does not read is refused rather than skipped:
// what a runner could not read is not what an implementation passed.
const readable = (set: Fixture[]) => {
  const unreadable = set.find(({ file }) => file.format !== FORMAT);

  if (unreadable) throw new Error(`The fixture file ${unreadable.name} targets the format ${JSON.stringify(unreadable.file.format)}; this set reads ${FORMAT}.`);
};

// A tree file declares no level, because CST.md section 2 is not one of them:
// its cases run where the adapter offers a tree, and are left out where it does
// not, the way an unclaimed level's are.
const isTree = (file: FixtureFile): file is TreeFixtureFile => file.kind === 'tree';

type Entry = { identity: Identity; execute: () => Outcome; skip: string | undefined };

const entries = (adapter: Adapter, options: Options, { name, file }: Fixture): Entry[] => isTree(file)
  ? file.cases.map((c) => ({
    identity: { id: c.id, file: name, document: 'CST.md', section: c.section ?? file.section, description: c.description },
    execute: () => executeTree(adapter, c),
    skip: adapter.cst ? undefined : 'The adapter offers no concrete syntax tree.',
  }))
  : file.cases.map((c) => ({
    identity: { id: c.id, file: name, level: file.level, section: c.section ?? file.section, description: c.description },
    execute: () => 'generate' in c ? executeGenerated(adapter, c) : executeConcrete(adapter, c),
    skip: reason(c, file.level, adapter, options),
  }));

/** One entry per case the adapter's levels require, each ready to run, beside the cases left out and why. */
export const plan = (adapter: Adapter, options: Options = {}): Plan => {
  claims(adapter, options);

  const set = options.fixtures ?? fixtures();

  readable(set);

  const planned = set.flatMap((fixture) => entries(adapter, options, fixture));

  const cases: Planned[] = planned.filter(({ skip }) => !skip).map(({ identity, execute }) => ({ ...identity, execute }));
  const skipped: Skipped[] = planned.flatMap(({ identity, skip }) => skip ? [{ ...identity, reason: skip }] : []);

  return { cases, skipped };
};

/** Executes a plan and sorts the outcomes. */
export const run = (adapter: Adapter, options: Options = {}): Result => {
  const { cases, skipped } = plan(adapter, options);
  const executed = cases.map((planned) => [planned, planned.execute()] as const);

  return {
    passed: executed.filter(([, outcome]) => outcome.ok).map(([planned]) => planned),
    failed: executed.flatMap(([planned, outcome]) => outcome.ok ? [] : [{ ...planned, outcome }]),
    skipped,
    unobserved: executed.filter(([, outcome]) => outcome.ok && outcome.unobserved).map(([planned]) => planned),
  };
};

// A failure line carries text derived from the payload, and an output case
// can be as long as the output limit, so what is shown is bounded.
const SHOWN = 200;

const show = (value: unknown) => {
  let text: string;

  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    text = String(value);
  }

  return text.length > SHOWN ? `${text.slice(0, SHOWN)}...` : text;
};

// Where the sentence a case pins is written. The document is named only where
// it is not the specification, so that a line about a resolution reads as it
// always has.
const where = ({ document, section }: Identity) => document ? `${document} section ${section}` : `section ${section}`;

const failed = (result: Result['failed'][number]) => `FAIL ${result.id} (${where(result)}): ${result.outcome.reason} Expected ${show(result.outcome.expected)}, actual ${show(result.outcome.actual)}. ${result.description}`;

const skipped = (planned: Skipped) => `SKIP ${planned.id} (${where(planned)}): ${planned.reason}`;

/** The text the command prints: one line per failure and per skipped case, then the counts. */
export const summarize = (result: Result) => {
  const counts = `${result.passed.length} passed, ${result.failed.length} failed, ${result.skipped.length} skipped`;
  const unobserved = result.unobserved.length ? `, ${result.unobserved.length} passed with reports unobserved` : '';

  return [...result.failed.map(failed), ...result.skipped.map(skipped), `${counts}${unobserved}`].join('\n');
};

// What the runner answered for a defect, read against what it answered
// without one: a case that failed, a case left out, or a case that passed with
// its reports unchecked, where the run without the defect had none of those.
const verdict = (result: Result, baseline: Result): Verdict | 'none' => {
  if (result.failed.length > baseline.failed.length) return 'fail';

  if (result.skipped.length > baseline.skipped.length) return 'skip';

  if (result.unobserved.length > baseline.unobserved.length) return 'unobserved';

  return 'none';
};

/**
 * Runs the defect catalogue against an adapter that passes the set, and
 * answers what this runner made of each defect: it caught it, it missed it, or
 * the defect never reached it. RUNNER.md states what the catalogue is for — a
 * runner that answers nothing where an adapter is wrong measures nothing — and
 * what each defect pins.
 */
export const audit = (adapter: Adapter, options: Options = {}): Audited[] => {
  const baseline = run(adapter, options);

  if (baseline.failed.length) throw new Error(`The audit needs an adapter that passes the set; this one fails ${baseline.failed.length} of ${baseline.passed.length + baseline.failed.length} cases.`);

  return defects().map((entry) => {
    if (!Object.hasOwn(mutations, entry.id)) throw new Error(`The catalogue names a defect this runner does not carry: ${JSON.stringify(entry.id)}.`);

    const { adapter: defective, reached } = mutations[entry.id](adapter);

    let observed: Verdict | 'none';

    try {
      observed = verdict(run(defective, options), baseline);
    } catch {
      observed = 'error';
    }

    return { ...entry, observed, outcome: !reached() ? 'unreachable' : observed === entry.expects ? 'caught' : 'missed' };
  });
};

/** Runs the set and throws where anything failed, listing every failure. */
export const check = (adapter: Adapter, options: Options = {}) => {
  const result = run(adapter, options);

  if (result.failed.length) throw new Error(`${result.failed.length} of ${result.passed.length + result.failed.length} conformance cases failed:\n${result.failed.map(failed).join('\n')}`);
};
