import { behaviours } from './behaviours';
import { decode, nodes } from './decode';
import type { Adapter, ConcreteCase, ExpectedReport, Failure, FormatRequest, GeneratedCase, Generator, Limits, Outcome, Report, Resolution, Resolved } from './types';

// A generated case expects of a report what a written one may, and the limit
// the adapter declared where the report is about one.
type Expectation = {
  output: string;
  format?: FormatRequest;
  reports: (ExpectedReport & { limit?: number })[];
};

// A case with its inputs built and its expectation computed.
type Prepared = {
  input: Resolution;
  expected: Expectation;
};

const failure = (reason: string, expected: unknown, actual: unknown): Failure => ({ ok: false, reason, expected, actual });

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';

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
    id: decode(c.messageId),
    defaults: decode(c.defaults),
    modifiers: register(c.modifiers),
  },
  expected: { output: output(c), format: c.expected.format, reports: c.expected.reports ?? [] },
});

// Every generated case reports under this id.
const ID = 'limits';

// An output of the stated length written entirely by the message: the
// placeholder selects an option, and an option value is the message's own
// text, so what reaches the output is the placeholder's result while the
// payload was read for one character.
const writes = (length: number) => `{{v; a:${'x'.repeat(length)};}}`;

// A value of the stated length the placeholder selects nothing from: the read
// budget is spent whole and two characters reach the output.
const reads = '{{v:eq; nomatch:X; default:ok;}}';

// A message nesting the stated number of levels, each selecting the option
// that holds the next. The innermost declares a fallback, so a level the
// nesting limit refuses is visible as the chain it takes.
const nest = (levels: number): string => (levels <= 1 ? '{{v; a:settled; default:fallback;}}' : `{{v; a:${nest(levels - 1)};}}`);

const limit = (code: 'nesting-limit' | 'output-limit' | 'read-limit', origin: ExpectedReport['origin'], declared: number): Expectation['reports'][number] => ({ code, origin, id: ID, limit: declared });

const generators: Record<Generator, (limits: Limits) => Prepared> = {
  'output-at-limit': ({ output: length }) => ({
    input: { message: writes(length), payload: { v: 'a' }, id: ID },
    expected: { output: 'x'.repeat(length), reports: [] },
  }),
  'output-over-limit': ({ output: length }) => ({
    input: { message: `A${writes(length + 1)}B`, payload: { v: 'a' }, id: ID },
    // The placeholder resolves to the empty string and the message's own text
    // still renders, because that text is the caller's and is counted against
    // no limit.
    expected: { output: 'AB', reports: [limit('output-limit', 'limit', length)] },
  }),
  'output-over-limit-continues': ({ output: length }) => ({
    input: { message: `${writes(length + 1)}{{w}}`, payload: { v: 'a', w: 'tail' }, id: ID },
    // A result the output has no room for spends nothing, so the placeholder
    // after it is resolved and carried.
    expected: { output: 'tail', reports: [limit('output-limit', 'limit', length)] },
  }),
  'read-at-limit': ({ read }) => ({
    input: { message: reads, payload: { v: 'x'.repeat(read) }, id: ID },
    expected: { output: 'ok', reports: [] },
  }),
  'read-over-limit': ({ read }) => ({
    input: { message: `${reads}{{w}}`, payload: { v: 'x'.repeat(read + 1), w: 'tail' }, id: ID },
    // The budget is tested before a placeholder reads, so the one that spent
    // it past the limit still resolves and the one after it pays.
    expected: { output: 'ok', reports: [limit('read-limit', 'limit', read)] },
  }),
  'conversion-over-limit': ({ conversion }) => ({
    input: { message: '{{v; default:D}}', payload: { v: nodes(conversion + 1) }, id: ID },
    expected: { output: 'D', reports: [{ code: 'unserializable-value', origin: 'payload', id: ID }] },
  }),
  'nesting-at-limit': ({ nesting }) => ({
    input: { message: nest(nesting), payload: { v: 'a' }, id: ID },
    expected: { output: 'settled', reports: [] },
  }),
  'nesting-over-limit': ({ nesting }) => ({
    input: { message: nest(nesting + 1), payload: { v: 'a' }, id: ID },
    // The innermost placeholder is the one refused, and a nesting limit is a
    // defect of the message: it takes its fallback chain, and every level
    // around it selects the option that holds it.
    expected: { output: 'fallback', reports: [limit('nesting-limit', 'message', nesting)] },
  }),
};

// Property order is the host's, so a request is compared by its entries and
// not by the text a serialization happens to make of it.
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;

  if (!isObject(value)) return JSON.stringify(value) ?? 'undefined';

  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
};

// Section 11.2 lets an implementation expose the request it makes, and an
// adapter that does is measured on it rather than on the text its own locale
// data made. A case that states a request writes the placeholder alone, so the
// resolution it describes makes exactly one.
const compareFormats = (expected: FormatRequest, actual: unknown): Failure | undefined => {
  if (!Array.isArray(actual)) return failure('The formatting requests are not a list.', [expected], actual);

  if (actual.length !== 1) return failure(`Expected one formatting request, got ${actual.length}.`, [expected], actual);

  const request = actual[0] as FormatRequest | undefined;

  if (request?.api !== expected.api) return failure('The facility of the request differs.', expected, request);

  if (canonical(request.options ?? {}) !== canonical(expected.options ?? {})) return failure('The properties of the request differ.', expected, request);

  if (canonical(request.input) !== canonical(expected.input)) return failure('The input of the request differs.', expected, request);

  return undefined;
};

const COMPARED = ['origin', 'id', 'limit'] as const;

const count = (reports: unknown[]) => `${reports.length} ${reports.length === 1 ? 'report' : 'reports'}`;

// A field is compared where the adapter's report carries it and the case
// expects something of it; the specification prescribes a report no shape. Each
// is text or a number, so a report that carries an id of another shape is one
// no expectation names, and that id goes unobserved.
const compareReports = (expected: Expectation['reports'], actual: Report[]) => {
  if (expected.length !== actual.length) return failure(`Expected ${count(expected)}, got ${count(actual)}.`, expected, actual);

  for (const [index, report] of actual.entries()) {
    const wanted = expected[index];
    const position = `report ${index + 1}`;

    if (report.code !== wanted.code) return failure(`The code of ${position} differs.`, wanted, report);

    const field = COMPARED.find((name) => report[name] !== undefined && wanted[name] !== undefined && report[name] !== wanted[name]);

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

const execute = (adapter: Adapter, { input, expected }: Prepared): Outcome => {
  const resolved = answer(adapter, input, expected.output);

  if ('ok' in resolved) return resolved;

  const produced = expected.format && resolved.formats !== undefined
    ? compareFormats(expected.format, resolved.formats)
    : resolved.output === expected.output ? undefined : failure('The output differs.', expected.output, resolved.output);

  if (produced) return produced;

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
