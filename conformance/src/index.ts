import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeConcrete, executeGenerated } from './cases';
import type { Adapter, Case, Fixture, FixtureFile, Level, Limits, Options, Plan, Planned, Result, Skipped } from './types';

export type * from './types';

export { behaviours } from './behaviours';
export { decode } from './decode';

/** The fixture files of a directory, sorted by name. */
export const load = (directory: string): Fixture[] => readdirSync(directory)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => ({ name, file: JSON.parse(readFileSync(join(directory, name), 'utf8')) as FixtureFile }));

/** The set shipped with this package. */
export const fixtures = () => load(fileURLToPath(new URL('../fixtures/', import.meta.url)));

// The one construction that registers a modifier, so it runs at the
// Extensions level whatever the level of the file it is written in.
const REGISTERING = 'output-over-limit-stops';

const LEVELS: readonly Level[] = ['core', 'intl', 'extensions'];

const LIMITS = ['passes', 'output', 'conversion'] as const;

// The adapter's two statements about itself, and the levels option, are held
// to the vocabulary of sections 2 and 13 before anything runs: a level that is
// not one of the three, or a limit that is not a count, is an error, not a
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

  if ('generate' in c && c.generate === REGISTERING && exclusion('extensions', adapter, options)) return 'The case registers a host-defined modifier, which needs the extensions level.';

  return undefined;
};

/** One entry per case the adapter's levels require, each ready to run, beside the cases left out and why. */
export const plan = (adapter: Adapter, options: Options = {}): Plan => {
  claims(adapter, options);

  const entries = (options.fixtures ?? fixtures()).flatMap(({ name, file }) => file.cases.map((c) => ({
    c,
    identity: { id: c.id, file: name, level: file.level, section: c.section ?? file.section, description: c.description },
    skip: reason(c, file.level, adapter, options),
  })));

  const cases: Planned[] = entries.filter(({ skip }) => !skip).map(({ c, identity }) => ({
    ...identity,
    execute: () => 'generate' in c ? executeGenerated(adapter, c) : executeConcrete(adapter, c),
  }));
  const skipped: Skipped[] = entries.flatMap(({ identity, skip }) => skip ? [{ ...identity, reason: skip }] : []);

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

const failed = ({ id, section, description, outcome }: Result['failed'][number]) => `FAIL ${id} (section ${section}): ${outcome.reason} Expected ${show(outcome.expected)}, actual ${show(outcome.actual)}. ${description}`;

const skipped = ({ id, section, reason: why }: Skipped) => `SKIP ${id} (section ${section}): ${why}`;

/** The text the command prints: one line per failure and per skipped case, then the counts. */
export const summarize = (result: Result) => {
  const counts = `${result.passed.length} passed, ${result.failed.length} failed, ${result.skipped.length} skipped`;
  const unobserved = result.unobserved.length ? `, ${result.unobserved.length} passed with reports unobserved` : '';

  return [...result.failed.map(failed), ...result.skipped.map(skipped), `${counts}${unobserved}`].join('\n');
};

/** Runs the set and throws where anything failed, listing every failure. */
export const check = (adapter: Adapter, options: Options = {}) => {
  const result = run(adapter, options);

  if (result.failed.length) throw new Error(`${result.failed.length} of ${result.passed.length + result.failed.length} conformance cases failed:\n${result.failed.map(failed).join('\n')}`);
};
