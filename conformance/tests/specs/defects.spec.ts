import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { audit, defects, fixtures, mutations, run, type Adapter, type Audited, type Case, type ConcreteCase, type Defect, type ExpectedNode, type Fixture, type Generator, type Node, type Resolution, type Resolved, type ResolutionFixtureFile } from '@curly-message/conformance';
import { format } from '../../src/cases';
import { resolver } from './kept';

const root = fileURLToPath(new URL('../../', import.meta.url));

const LIMITS = { output: 5, read: 7, conversion: 7, nesting: 3 };

const REQUEST = { api: 'NumberFormat', options: { maximumFractionDigits: 2, useGrouping: false }, input: 1234.5678 } as const;

// The bound on counted reads the implementation behind the adapter keeps.
const REENTRY = 2;

// One case per thing a defect can reach: an output, an output whose ends are
// whitespace, a report, two reports the order of which matters, a report
// carrying a limit, a value at the declared conversion limit and one past it,
// a locale-dependent request, and each construction of kept reads.
const CASES: Record<string, Case> = {
  'a.plain': { id: 'a/plain', description: 'Pins an output.', message: '{{v}}', messageId: 'a.plain', expected: { output: 'x' } },
  'a.spaced': { id: 'a/spaced', description: 'Pins an output whose ends are whitespace.', message: ' {{v}} ', messageId: 'a.spaced', expected: { output: ' x ' } },
  'a.report': { id: 'a/report', description: 'Pins a report.', message: '{{v:none}}', messageId: 'a.report', expected: { output: 'x', reports: [{ code: 'unknown-modifier', origin: 'message', id: 'a.report' }] } },
  'a.order': { id: 'a/order', description: 'Pins the order of two reports.', message: '{{v:none}}{{w; eq:}}', messageId: 'a.order', expected: { output: 'x', reports: [{ code: 'unknown-modifier', origin: 'message', id: 'a.order' }, { code: 'missing-options', origin: 'payload', id: 'a.order' }] } },
  limits: { id: 'limits/over', description: 'Pins the declared nesting limit.', generate: 'nesting-over-limit' },
  conversion: { id: 'limits/conversion', description: 'Pins the declared conversion limit.', generate: 'conversion-at-limit' },
  'conversion.over': { id: 'limits/conversion-over', description: 'Pins the declared conversion limit from past it.', generate: 'conversion-over-limit' },
  'b.format': { id: 'b/format', description: 'Pins a request.', message: '{{n:number}}', messageId: 'b.format', locale: 'de', expected: { format: REQUEST } },
  'c.at': { id: 'c/at', description: 'Pins the declared bound on counted reads.', generate: 'reentry-at-limit' },
  'c.over': { id: 'c/over', description: 'Pins the declared bound on counted reads from past it.', generate: 'reentry-over-limit' },
  'c.refused': { id: 'c/refused', description: 'Pins that a refused read is not recorded.', generate: 'reentry-refused-not-recorded' },
  'c.own': { id: 'c/own', description: 'Pins that own reads count toward no bound.', generate: 'reentry-own-reads-free' },
};

// What the implementation behind the adapter produced for each, keyed by the
// id the case resolves under.
const ANSWERS: Record<string, Resolved> = {
  'a.plain': { output: 'x', reports: [] },
  'a.spaced': { output: ' x ', reports: [] },
  'a.report': { output: 'x', reports: [{ code: 'unknown-modifier', origin: 'message', id: 'a.report' }] },
  'a.order': { output: 'x', reports: [{ code: 'unknown-modifier', origin: 'message', id: 'a.order' }, { code: 'missing-options', origin: 'payload', id: 'a.order' }] },
  limits: { output: 'fallback', reports: [{ code: 'nesting-limit', origin: 'message', id: 'limits', limit: LIMITS.nesting }] },
  'b.format': { output: format(REQUEST, 'de'), reports: [] },
};

const file = (name: string, level: ResolutionFixtureFile['level'], ids: string[]): Fixture => ({
  name,
  file: { format: 'curly-message-3', level, section: level === 'intl' ? '11.2' : '9', cases: ids.map((id) => CASES[id]) },
});

// One message per thing a defect of the tree can reach: a separator, a name
// spelled with an escape sequence, and a character outside the basic plane,
// which is the only place a unit other than the one declared shows.
const TREES: Record<string, ExpectedNode[]> = {
  '{{v; x:y}}': [{ type: 'placeholder', text: '{{v; x:y}}', nodes: [
    { type: 'open', text: '{{' },
    { type: 'key', text: 'v', name: 'v', nodes: [{ type: 'text', text: 'v' }] },
    { type: 'separator', text: ';' },
    { type: 'space', text: ' ' },
    { type: 'option-key', text: 'x', name: 'x', nodes: [{ type: 'text', text: 'x' }] },
    { type: 'separator', text: ':' },
    { type: 'option-value', text: 'y', nodes: [{ type: 'text', text: 'y' }] },
    { type: 'close', text: '}}' },
  ] }],
  '{{a\\;b}}': [{ type: 'placeholder', text: '{{a\\;b}}', nodes: [
    { type: 'open', text: '{{' },
    { type: 'key', text: 'a\\;b', name: 'a;b', nodes: [
      { type: 'text', text: 'a' },
      { type: 'escape', text: '\\;', cancels: true },
      { type: 'text', text: 'b' },
    ] },
    { type: 'close', text: '}}' },
  ] }],
  '\\\u{1F600}': [{ type: 'escape', text: '\\\u{1F600}', cancels: false }],
};

// The tree the implementation answers with, in the unit it counts in, laid
// out from the same sketch the case expects: a span written a second time by
// hand would only be a second chance to get one wrong.
const built = (sketches: ExpectedNode[], from: number, length: (text: string) => number): Node[] => {
  let at = from;

  return sketches.map((sketch) => {
    const start = at;

    at += length(sketch.text);

    return {
      type: sketch.type,
      start,
      end: at,
      ...sketch.name === undefined ? {} : { name: sketch.name },
      ...sketch.cancels === undefined ? {} : { cancels: sketch.cancels },
      ...sketch.nodes ? { nodes: built(sketch.nodes, start, length) } : {},
    };
  });
};

const counting = (unit: 'utf-16' | 'code-point', length: (text: string) => number) => ({
  unit,
  parse: (message: string) => ({ type: 'message', start: 0, end: length(message), nodes: built(TREES[message], 0, length) }),
});

const CST = counting('utf-16', (text) => text.length);

const trees: Fixture = {
  name: 'tree.json',
  file: {
    format: 'curly-message-3',
    kind: 'tree',
    section: '6',
    cases: Object.entries(TREES).map(([message, expected], index) => ({ id: `tree/case-${index + 1}`, description: 'Pins one tree.', message, expected })),
  },
};

const SET = [file('core.json', 'core', ['a.plain', 'a.spaced', 'a.report', 'a.order', 'limits', 'conversion', 'conversion.over']), file('intl.json', 'intl', ['b.format']), trees, file('extensions.json', 'extensions', ['c.at', 'c.over', 'c.refused', 'c.own'])];

// How many nodes a serialization visits: the root, then every member reached,
// a shared one counted every time.
const visits = (value: unknown) => {
  let count = 0;

  JSON.stringify(value, (_, entry) => {
    count += 1;

    return entry;
  });

  return count;
};

// The implementation answers a construction of kept reads by the bound it
// keeps, as section 13 reads it.
const kept = (bound: number) => resolver({ bound });

const isKept = (message: unknown): message is string => typeof message === 'string' && message.startsWith('{{x:');

// The implementation answers the conversion case by the limit it enforces,
// which a defect may misdeclare but cannot move, and a construction of kept
// reads by the bound it keeps.
const answer = ({ id, message, payload, modifiers }: Resolution): Resolved => {
  if (isKept(message)) return kept(REENTRY)({ id, message, payload, modifiers });

  const { v, w = '' } = (payload ?? {}) as { v?: unknown; w?: string };

  if (typeof v !== 'object' || v === null) return ANSWERS[String(id)];

  return visits(v) > LIMITS.conversion
    ? { output: String(message).includes('default:D') ? `D${w}` : 'refused', reports: [{ code: 'unserializable-value', origin: 'payload', id: 'limits' }] }
    : { output: String(message).includes('nomatch:ok') ? 'ok' : '{}', reports: [] };
};

// An implementation that answers every case of the set correctly: what a
// defect is applied to, and what the audit needs.
const conforming = (over: Partial<Adapter> = {}): Adapter => ({
  levels: ['core', 'intl', 'extensions'],
  limits: LIMITS,
  reentry: REENTRY,
  resolve: answer,
  cst: CST,
  ...over,
});

const audited = (adapter: Adapter, set = SET) => Object.fromEntries(audit(adapter, { fixtures: set }).map((entry) => [entry.id, entry])) as Record<Defect, Audited>;

const outcomes = (adapter: Adapter, set = SET) => Object.fromEntries(Object.entries(audited(adapter, set)).map(([id, entry]) => [id, entry.outcome]));

describe('the catalogue', () => {
  it('validates against the schema', () => {
    const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as object;
    const validate = new Ajv2020({ allErrors: true }).compile(read(join(root, 'schema', 'defect.schema.json')));

    expect(validate(read(join(root, 'defects.json')))).toBe(true);
    expect(validate.errors).toBe(null);
  });

  it('names every defect this runner carries, and no other', () => {
    const named = defects().map(({ id }) => id);

    expect(named).toEqual([...new Set(named)]);
    expect([...named].sort()).toEqual(Object.keys(mutations).sort());
  });

  it('pins a heading of the document it names with every section', () => {
    const headings = (document: string) => new Set([...readFileSync(join(root, '..', document), 'utf8').matchAll(/^#{2,3} (\d+\.\d+|\d+|A\.\d+)\b/gm)].map(([, number]) => number));
    const named = { 'SPEC.md': headings('SPEC.md'), 'CST.md': headings('CST.md') };

    expect(defects().filter(({ document, section }) => section !== undefined && !named[document ?? 'SPEC.md'].has(section))).toEqual([]);
  });

  it('states a request the shipped set states nowhere, so a case compared on one fails on it', () => {
    const { adapter } = mutations['formats-wrong'](conforming());
    const wrong = JSON.stringify(adapter.resolve({ message: '', id: 'a.plain' }).formats?.[0]);
    const stated = fixtures().flatMap(({ file: f }) => f.kind === 'tree' ? [] : f.cases.flatMap((c) => 'generate' in c || !c.expected.format ? [] : [JSON.stringify(c.expected.format)]));

    expect(stated.length).toBeGreaterThan(0);
    expect(stated).not.toContain(wrong);
  });
});

describe('audit', () => {
  it('catches every defect of the catalogue with an adapter that passes the set', () => {
    const missed = audit(conforming(), { fixtures: SET }).filter(({ outcome }) => outcome !== 'caught');

    expect(missed).toEqual([]);
  });

  it('catches every defect of the catalogue with an adapter that counts its spans in code points', () => {
    const codePoints = conforming({ cst: counting('code-point', (text) => [...text].length) });

    expect(audit(codePoints, { fixtures: SET }).filter(({ outcome }) => outcome !== 'caught')).toEqual([]);
  });

  it('answers what the runner made of the defect beside what it expected', () => {
    const entries = audited(conforming());

    expect(entries['tree-unoffered']).toMatchObject({ expects: 'skip', observed: 'skip', outcome: 'caught', document: 'CST.md' });
    expect(entries['tree-unit-unknown']).toMatchObject({ expects: 'error', observed: 'error', outcome: 'caught' });

    expect(entries['output-truncated']).toMatchObject({ expects: 'fail', observed: 'fail', outcome: 'caught', section: '9' });
    expect(entries['claims-no-core']).toMatchObject({ expects: 'error', observed: 'error', outcome: 'caught' });
    expect(entries['claims-core-only']).toMatchObject({ expects: 'skip', observed: 'skip', outcome: 'caught' });
    expect(entries['reports-unobserved']).toMatchObject({ expects: 'unobserved', observed: 'unobserved', outcome: 'caught' });
    expect(entries['conversion-limit-overstated']).toMatchObject({ expects: 'fail', observed: 'fail', outcome: 'caught', section: '13' });
    expect(entries['conversion-limit-understated']).toMatchObject({ expects: 'fail', observed: 'fail', outcome: 'caught', section: '13' });
    expect(entries['reentry-limit-overstated']).toMatchObject({ expects: 'fail', observed: 'fail', outcome: 'caught', section: '13' });
    expect(entries['reentry-limit-understated']).toMatchObject({ expects: 'fail', observed: 'fail', outcome: 'caught', section: '13' });
    expect(entries['claims-negative-reentry']).toMatchObject({ expects: 'error', observed: 'error', outcome: 'caught', section: '13' });
  });

  it('catches an overstated bound on counted reads at every construction of kept reads, and an understated one only past it', () => {
    const only = (...constructions: Generator[]): Fixture[] => [{ name: 'extensions.json', file: { format: 'curly-message-3', level: 'extensions', section: '13', cases: constructions.map((generate) => ({ id: `extensions/${generate}`, description: `Pins the declared bound on counted reads with ${generate}.`, generate })) } }];
    const reentry = (set: Fixture[], adapter = conforming()) => {
      const { 'reentry-limit-overstated': overstated, 'reentry-limit-understated': understated, 'claims-negative-reentry': negative } = outcomes(adapter, set);

      return { overstated, understated, negative };
    };
    const ALL: Generator[] = ['reentry-at-limit', 'reentry-over-limit', 'reentry-refused-not-recorded', 'reentry-own-reads-free'];
    // An implementation that keeps a bound of 0, as section 13 lets it.
    const none = conforming({ reentry: 0, resolve: (input) => isKept(input.message) ? kept(0)(input) : answer(input) });

    expect(reentry(only('reentry-at-limit'))).toEqual({ overstated: 'caught', understated: 'unreachable', negative: 'caught' });
    expect(reentry(only('reentry-over-limit'))).toEqual({ overstated: 'caught', understated: 'caught', negative: 'caught' });
    expect(reentry(only('reentry-refused-not-recorded'))).toEqual({ overstated: 'caught', understated: 'caught', negative: 'caught' });
    expect(reentry(only('reentry-own-reads-free'))).toEqual({ overstated: 'caught', understated: 'unreachable', negative: 'caught' });
    expect(reentry(only(...ALL), none)).toEqual({ overstated: 'caught', understated: 'unreachable', negative: 'caught' });
    expect(reentry(only(...ALL), conforming({ reentry: undefined }))).toEqual({ overstated: 'unreachable', understated: 'unreachable', negative: 'caught' });
    expect(reentry(only(...ALL), conforming({ keeps: false }))).toEqual({ overstated: 'unreachable', understated: 'unreachable', negative: 'caught' });
    expect(reentry([SET[0]])).toEqual({ overstated: 'unreachable', understated: 'unreachable', negative: 'caught' });
    expect(audit(conforming(), { fixtures: only(...ALL), levels: ['core'] }).filter(({ id }) => id.startsWith('reentry-')).map(({ outcome }) => outcome)).toEqual(['unreachable', 'unreachable']);
  });

  it('catches an overstated conversion limit only at the bound, and an understated one only past it', () => {
    const only = (...constructions: Generator[]): Fixture[] => [{ name: 'core.json', file: { format: 'curly-message-3', level: 'core', section: '13', cases: constructions.map((generate) => ({ id: `limits/${generate}`, description: `Pins the declared conversion limit with ${generate}.`, generate })) } }];
    const conversion = (set: Fixture[]) => {
      const { 'conversion-limit-overstated': overstated, 'conversion-limit-understated': understated } = outcomes(conforming(), set);

      return { overstated, understated };
    };

    expect(conversion(only('conversion-at-limit'))).toEqual({ overstated: 'caught', understated: 'unreachable' });
    expect(conversion(only('conversion-over-limit'))).toEqual({ overstated: 'unreachable', understated: 'caught' });
    expect(conversion(only('conversion-over-limit-continues'))).toEqual({ overstated: 'unreachable', understated: 'caught' });
    expect(conversion([SET[1]])).toEqual({ overstated: 'unreachable', understated: 'unreachable' });
    expect(audit(conforming(), { fixtures: only('conversion-at-limit', 'conversion-over-limit'), levels: [] }).filter(({ id }) => id.startsWith('conversion-')).map(({ outcome }) => outcome)).toEqual(['unreachable', 'unreachable']);
  });

  it('calls a defect unreachable where the adapter never answers what it alters', () => {
    const silent = conforming({ resolve: (input) => ({ output: answer(input).output }) });
    const core = conforming({ levels: ['core'] });
    const treeless = conforming({ cst: undefined });

    expect(outcomes(silent, [SET[0]])).toMatchObject({
      'reports-dropped': 'unreachable',
      'reports-extra': 'unreachable',
      'reports-reversed': 'unreachable',
      'report-code-changed': 'unreachable',
      'report-limit-changed': 'unreachable',
      'reports-unobserved': 'unreachable',
      'output-truncated': 'caught',
    });
    expect(outcomes(core, [SET[0]])).toMatchObject({
      'claims-core-only': 'unreachable',
      'formats-wrong': 'unreachable',
      'unexpressible-declared': 'unreachable',
      'unexpressible-conditional-declared': 'unreachable',
      'claims-no-core': 'caught',
    });
    expect(outcomes(treeless)).toMatchObject({
      'tree-unoffered': 'unreachable',
      'tree-node-dropped': 'unreachable',
      'tree-name-raw': 'unreachable',
      'tree-unit-changed': 'unreachable',
      'tree-unit-unknown': 'unreachable',
      'output-truncated': 'caught',
    });
  });

  it('adds a defect of what the adapter cannot express to what the adapter declared itself', () => {
    const request = (options: Record<string, unknown>) => ({ api: 'NumberFormat', options, input: 1234.5678 }) as const;
    const REQUESTS = {
      'b.format': REQUEST,
      'b.digits': request({ maximumFractionDigits: 2 }),
      'b.grouped': request({ maximumFractionDigits: 1, useGrouping: true }),
      'b.code': request({ style: 'currency', currency: 'USD', currencyDisplay: 'code' }),
    };
    const intl: Fixture = {
      name: 'intl.json',
      file: { format: 'curly-message-3', level: 'intl', section: '11.2', cases: Object.entries(REQUESTS).map(([id, stated]) => ({ id: id.replace('.', '/'), description: 'Pins a request.', message: '{{n:number}}', messageId: id, locale: 'de', expected: { format: stated } })) },
    };
    // A host that cannot express grouping or how a currency is displayed, and
    // formats those requests without them, as it documents.
    const gapped = conforming({
      unexpressible: { NumberFormat: ['useGrouping', 'currencyDisplay'] },
      resolve: (input) => {
        const key = String(input.id);

        if (!Object.hasOwn(REQUESTS, key)) return answer(input);

        return { output: key === 'b.grouped' || key === 'b.code' ? 'formatted without it' : format(REQUESTS[key as keyof typeof REQUESTS], 'de'), reports: [] };
      },
    });

    expect(run(gapped, { fixtures: [SET[0], intl] }).skipped.map(({ id }) => id)).toEqual(['b/format', 'b/grouped', 'b/code']);
    expect(outcomes(gapped, [SET[0], intl])).toMatchObject({
      'unexpressible-declared': 'caught',
      'unexpressible-conditional-declared': 'unreachable',
    });
  });

  it('reaches the runner with a defect of what the adapter cannot express wherever it leaves out a case the adapter ran', () => {
    const digits = (id: string, maximumFractionDigits: number): ConcreteCase => ({ id: `b/${id}`, description: 'Pins a request.', message: '{{n:number}}', messageId: `b.${id}`, locale: 'de', expected: { format: { api: 'NumberFormat', options: { maximumFractionDigits }, input: 1234.5678 } } });
    const set = (...cases: ConcreteCase[]): Fixture[] => [SET[0], { name: 'intl.json', file: { format: 'curly-message-3', level: 'intl', section: '11.2', cases } }];
    const answers: Record<string, Resolved> = Object.fromEntries([1, 2].map((n) => [`b.digits-${n}`, { output: format({ api: 'NumberFormat', options: { maximumFractionDigits: n }, input: 1234.5678 }, 'de'), reports: [] }]));
    // A host that cannot express two fraction digits, and formats a request
    // for one as asked.
    const gapped = conforming({
      unexpressible: { NumberFormat: [{ property: 'maximumFractionDigits', values: [2] }] },
      resolve: (input) => answers[String(input.id)] ?? answer(input),
    });

    expect(outcomes(gapped, set(digits('digits-1', 1), digits('digits-2', 2)))['unexpressible-declared']).toBe('caught');
    expect(outcomes(gapped, set(digits('digits-2', 2)))['unexpressible-declared']).toBe('unreachable');
    expect(audit(gapped, { fixtures: set(digits('digits-1', 1), digits('digits-2', 2)), levels: ['core'] }).find(({ id }) => id === 'unexpressible-declared')?.outcome).toBe('unreachable');
  });

  it('calls a defect missed where it reached the runner and the runner answered nothing', () => {
    const anonymous: ConcreteCase = { id: 'a/anonymous', description: 'Pins a report no expectation names an id of.', message: '{{v:none}}', messageId: 'a.report', expected: { output: 'x', reports: [{ code: 'unknown-modifier', origin: 'message' }] } };
    const set: Fixture[] = [{ name: 'core.json', file: { format: 'curly-message-3', level: 'core', section: '9', cases: [anonymous] } }, SET[1]];

    expect(outcomes(conforming(), set)).toMatchObject({ 'report-id-changed': 'missed', 'report-code-changed': 'caught' });
    expect(audited(conforming(), set)['report-id-changed']).toMatchObject({ expects: 'fail', observed: 'none' });
  });

  it('needs an adapter that passes the set', () => {
    const wrong = conforming({ resolve: () => ({ output: 'not what any case expects' }) });

    expect(() => audit(wrong, { fixtures: SET })).toThrow('The audit needs an adapter that passes the set; this one fails 12 of 15 cases.');
  });
});
