import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Adapter, Catalogue, Defect, FormatRequest, Level, Mutation, Report, ReportCode, ReportOrigin, Resolved } from './types';

/** The catalogue shipped with this package; RUNNER.md states what each defect pins. */
export const defects = () => (JSON.parse(readFileSync(fileURLToPath(new URL('../defects.json', import.meta.url)), 'utf8')) as Catalogue).defects;

// A defect that changes what the adapter answers. `change` answers with the
// altered resolution, or with nothing where this resolution held nothing to
// alter, which is what `reached` is read from.
const answering = (adapter: Adapter, change: (resolved: Resolved) => Resolved | undefined): Mutation => {
  let reached = false;

  return {
    adapter: {
      ...adapter,
      resolve: (input) => {
        const resolved = adapter.resolve(input);
        const changed = change(resolved);

        if (changed === undefined) return resolved;

        reached = true;

        return changed;
      },
    },
    reached: () => reached,
  };
};

// A defect of the reports, which an implementation need not observe at all.
const reporting = (adapter: Adapter, change: (reports: Report[]) => Report[] | undefined) => answering(adapter, (resolved) => {
  if (!Array.isArray(resolved.reports)) return undefined;

  const changed = change(resolved.reports);

  return changed && { ...resolved, reports: changed };
});

// A defect that answers nothing of what the implementation produced.
const instead = (resolve: Adapter['resolve']) => (adapter: Adapter): Mutation => ({ adapter: { ...adapter, resolve }, reached: () => true });

// A defect of what the adapter claims about itself. Those claims are read
// before anything runs, so such a defect reaches the runner wherever the
// claim it alters was one the adapter made.
const claiming = (adapter: Adapter, claims: Partial<Adapter>, reached: () => boolean = () => true): Mutation => ({ adapter: { ...adapter, ...claims }, reached });

const otherCode = (code: ReportCode): ReportCode => code === 'unknown-modifier' ? 'failed-modifier' : 'unknown-modifier';

const otherOrigin = (origin: ReportOrigin): ReportOrigin => origin === 'message' ? 'payload' : 'message';

const OTHER_ID = 'an id no case names';

// A request the set states nowhere, so a case compared on one fails on it.
const OTHER_REQUEST: FormatRequest = { api: 'NumberFormat', options: { style: 'percent' }, input: 0 };

const alike = (reports: Report[], other: Report[]) => reports.every((report, index) => JSON.stringify(report) === JSON.stringify(other[index]));

/** The catalogue's defects as this host carries them: each wraps a conforming adapter into one that is wrong in exactly one way. */
export const mutations: Record<Defect, (adapter: Adapter) => Mutation> = {
  'output-truncated': (adapter) => answering(adapter, (resolved) => typeof resolved.output === 'string' && resolved.output.length ? { ...resolved, output: resolved.output.slice(0, -1) } : undefined),

  'output-trimmed': (adapter) => answering(adapter, (resolved) => {
    const trimmed = typeof resolved.output === 'string' ? resolved.output.trim() : resolved.output;

    return trimmed === resolved.output ? undefined : { ...resolved, output: trimmed };
  }),

  'answers-nothing': instead(() => undefined as unknown as Resolved),

  raises: instead(() => {
    throw new Error('The raises defect raised.');
  }),

  'reports-dropped': (adapter) => reporting(adapter, (reports) => reports.length ? [] : undefined),

  'reports-extra': (adapter) => reporting(adapter, (reports) => [...reports, { code: 'unknown-modifier' }]),

  'reports-reversed': (adapter) => reporting(adapter, (reports) => {
    const reversed = [...reports].reverse();

    return alike(reports, reversed) ? undefined : reversed;
  }),

  'report-code-changed': (adapter) => reporting(adapter, (reports) => reports.length ? reports.map((report) => ({ ...report, code: otherCode(report.code) })) : undefined),

  'report-origin-changed': (adapter) => reporting(adapter, (reports) => reports.some(({ origin }) => origin !== undefined)
    ? reports.map((report) => report.origin === undefined ? report : { ...report, origin: otherOrigin(report.origin) })
    : undefined),

  'report-id-changed': (adapter) => reporting(adapter, (reports) => reports.some(({ id }) => id !== undefined)
    ? reports.map((report) => report.id === undefined ? report : { ...report, id: OTHER_ID })
    : undefined),

  'report-limit-changed': (adapter) => reporting(adapter, (reports) => reports.some(({ limit }) => typeof limit === 'number')
    ? reports.map((report) => typeof report.limit === 'number' ? { ...report, limit: report.limit + 1 } : report)
    : undefined),

  // The one defect that answers what the implementation produced and states
  // something else about it: the output stands, and only the request is wrong,
  // so a runner that ignores the request answers nothing at all.
  'formats-wrong': (adapter) => ({
    adapter: { ...adapter, resolve: (input) => ({ ...adapter.resolve(input), formats: [OTHER_REQUEST] }) },
    reached: () => adapter.levels.includes('intl'),
  }),

  'reports-unobserved': (adapter) => answering(adapter, ({ reports, ...rest }) => reports === undefined ? undefined : rest),

  'claims-core-only': (adapter) => claiming(adapter, { levels: ['core'] }, () => adapter.levels.length > 1),

  'unexpressible-declared': (adapter) => claiming(adapter, { unexpressible: { NumberFormat: ['maximumFractionDigits'] } }, () => adapter.levels.includes('intl')),

  'claims-no-core': (adapter) => claiming(adapter, { levels: adapter.levels.filter((level) => level !== 'core') }),

  'claims-unknown-level': (adapter) => claiming(adapter, { levels: [...adapter.levels, 'ecmascript' as Level] }),

  'claims-no-limits': (adapter) => claiming(adapter, { limits: { ...adapter.limits, passes: 0 } }),
};
