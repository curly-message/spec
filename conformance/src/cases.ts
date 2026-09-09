import { behaviours } from './behaviours';
import { decode, nodes } from './decode';
import type { Adapter, ConcreteCase, ExpectedReport, Failure, FormatRequest, GeneratedCase, Generator, Limits, Outcome, Report, Resolution, Resolved } from './types';

// A generated case expects of a report what a written one may, and the limit
// the adapter declared where the report is about one.
type Expectation = {
  output: string;
  reports: (ExpectedReport & { limit?: number })[];
};

// A case with its inputs built and its expectation computed, plus a check that
// only the run can answer, where the case has one.
type Prepared = {
  input: Resolution;
  expected: Expectation;
  verify?: () => Failure | undefined;
};

const failure = (reason: string, expected: unknown, actual: unknown): Failure => ({ ok: false, reason, expected, actual });

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';

const equal = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;

  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((entry, index) => equal(entry, b[index]));

  if (!isObject(a) || !isObject(b) || Array.isArray(a) || Array.isArray(b)) return false;

  const keys = Object.keys(a);

  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]));
};

/** The text a formatting request produces on this host, which is what a locale-dependent case expects. */
export const format = ({ api, options, input }: FormatRequest, locale?: string): string => {
  switch (api) {
    case 'NumberFormat':
      return new Intl.NumberFormat(locale, options).format(input as number);
    case 'DateTimeFormat':
      return new Intl.DateTimeFormat(locale, options).format(input as number);
    case 'RelativeTimeFormat': {
      const [value, unit] = input as [number, Intl.RelativeTimeFormatUnit];

      return new Intl.RelativeTimeFormat(locale, options).format(value, unit);
    }
  }
};

const register = (modifiers: ConcreteCase['modifiers']) => modifiers && Object.fromEntries(Object.entries(modifiers).map(([name, behaviour]) => [name, behaviours[behaviour]]));

const output = (c: ConcreteCase) => {
  if (c.expected.format) return format(c.expected.format, c.locale);

  if (c.expected.output !== undefined) return c.expected.output;

  throw new Error(`The case ${c.id} expects neither an output nor a format.`);
};

const concrete = (c: ConcreteCase): Prepared => ({
  input: {
    message: decode(c.message),
    payload: decode(c.payload),
    props: decode(c.props),
    locale: c.locale,
    key: decode(c.key),
    defaults: decode(c.defaults),
    modifiers: register(c.modifiers),
  },
  expected: { output: output(c), reports: c.expected.reports ?? [] },
});

// Every generated case reports through this key.
const KEY = 'limits';

// `p1` … `p<links-1>` each hold the placeholder of the next; the last holds
// the text the chain settles to.
const chain = (links: number) => Object.fromEntries(Array.from({ length: links }, (_, index) => [`p${index + 1}`, index + 1 < links ? `{{p${index + 2}}}` : 'settled']));

const limit = (code: 'pass-limit' | 'output-limit', declared: number): Expectation['reports'][number] => ({ code, origin: 'limit', key: KEY, limit: declared });

const generators: Record<Generator, (limits: Limits) => Prepared> = {
  'passes-at-limit': ({ passes }) => ({
    input: { message: '{{p1}}', payload: chain(passes), key: KEY },
    expected: { output: 'settled', reports: [] },
  }),
  'passes-over-limit': ({ passes }) => ({
    input: { message: '{{p1}}', payload: chain(passes + 1), key: KEY },
    expected: { output: `{{p${passes + 1}}}`, reports: [limit('pass-limit', passes)] },
  }),
  'output-at-limit': ({ output: length }) => ({
    input: { message: '{{v}}', payload: { v: 'x'.repeat(length) }, key: KEY },
    expected: { output: 'x'.repeat(length), reports: [] },
  }),
  'output-over-limit': ({ output: length }) => ({
    input: { message: '{{v}}', payload: { v: 'x'.repeat(length + 1) }, key: KEY },
    expected: { output: '{{v}}', reports: [limit('output-limit', length)] },
  }),
  'output-over-limit-stops': ({ output: length }) => {
    // The placeholder past the limit must not reach its modifier, which no
    // output shows: an implementation that resolves the pass before
    // discarding it renders the same text.
    let called = false;
    const raise = (input: Parameters<typeof behaviours.raise>[0]) => {
      called = true;

      return behaviours.raise(input);
    };

    return {
      input: { message: '{{v}}{{w:raise}}', payload: { v: 'x'.repeat(length + 1), w: 'w' }, key: KEY, modifiers: { raise } },
      expected: { output: '{{v}}{{w:raise}}', reports: [limit('output-limit', length)] },
      verify: () => called ? failure('The modifier past the output limit was called.', 'not called', 'called') : undefined,
    };
  },
  'conversion-over-limit': ({ conversion }) => ({
    input: { message: '{{v; default:D}}', payload: { v: nodes(conversion + 1) }, key: KEY },
    expected: { output: 'D', reports: [{ code: 'unserializable-value', origin: 'payload', key: KEY }] },
  }),
};

const COMPARED = ['origin', 'key', 'limit'] as const;

const count = (reports: unknown[]) => `${reports.length} ${reports.length === 1 ? 'report' : 'reports'}`;

// A field is compared where the adapter's report carries it and the case
// expects something of it; the specification prescribes a report no shape.
const compareReports = (expected: Expectation['reports'], actual: Report[]) => {
  if (expected.length !== actual.length) return failure(`Expected ${count(expected)}, got ${count(actual)}.`, expected, actual);

  for (const [index, report] of actual.entries()) {
    const wanted = expected[index];
    const position = `report ${index + 1}`;

    if (report.code !== wanted.code) return failure(`The code of ${position} differs.`, wanted, report);

    const field = COMPARED.find((name) => report[name] !== undefined && wanted[name] !== undefined && !equal(report[name], wanted[name]));

    if (field) return failure(`The ${field} of ${position} differs.`, wanted, report);
  }

  return undefined;
};

// What an adapter raised with, as text: a message where it raised an error,
// and otherwise whatever describes the value — which may be one JSON cannot.
const describe = (error: unknown) => {
  if (error instanceof Error) return error.message;

  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
};

// The adapter's answer is not typed at run time, so what it hands back is
// checked before it is read: an answer that is not one, or one that is
// promised rather than given, fails the case instead of ending the run.
const answer = (adapter: Adapter, input: Resolution, output: string): Resolved | Failure => {
  let resolved: unknown;

  try {
    resolved = adapter.resolve(input);
  } catch (error) {
    return failure('The adapter raised.', output, describe(error));
  }

  if (!isObject(resolved)) return failure('The adapter answered with no resolution.', output, resolved);

  if (typeof resolved.then === 'function') return failure('The adapter answered asynchronously; resolve must answer at once.', output, 'a promise');

  return resolved as Resolved;
};

const execute = (adapter: Adapter, { input, expected, verify }: Prepared): Outcome => {
  const resolved = answer(adapter, input, expected.output);

  if ('ok' in resolved) return resolved;

  if (resolved.output !== expected.output) return failure('The output differs.', expected.output, resolved.output);

  const verified = verify?.();

  if (verified) return verified;

  if (resolved.reports === undefined) return { ok: true, unobserved: 'reports' };

  if (!Array.isArray(resolved.reports)) return failure('The reports are not a list.', expected.reports, resolved.reports);

  return compareReports(expected.reports, resolved.reports) ?? { ok: true };
};

/** Runs a written-out case: decodes its inputs, computes its expectation, and compares. */
export const executeConcrete = (adapter: Adapter, c: ConcreteCase) => execute(adapter, concrete(c));

/** Runs a generated case: builds it from the adapter's limits, and compares. */
export const executeGenerated = (adapter: Adapter, c: GeneratedCase) => {
  if (!Object.hasOwn(generators, c.generate)) throw new Error(`The case ${c.id} names no construction: ${JSON.stringify(c.generate)}.`);

  return execute(adapter, generators[c.generate](adapter.limits));
};
