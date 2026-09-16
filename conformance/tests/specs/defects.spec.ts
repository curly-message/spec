import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { audit, defects, fixtures, mutations, type Adapter, type Audited, type Case, type ConcreteCase, type Defect, type Fixture, type FixtureFile, type Resolved } from '../../src';
import { format } from '../../src/cases';

const root = fileURLToPath(new URL('../../', import.meta.url));

const LIMITS = { passes: 3, output: 5, conversion: 7 };

const REQUEST = { api: 'NumberFormat', options: { maximumFractionDigits: 2 }, input: 1234.5678 } as const;

// One case per thing a defect can reach: an output, an output whose ends are
// whitespace, a report, two reports the order of which matters, a report
// carrying a limit, and a locale-dependent request.
const CASES: Record<string, Case> = {
  'a.plain': { id: 'a/plain', description: 'Pins an output.', message: '{{v}}', messageId: 'a.plain', expected: { output: 'x' } },
  'a.spaced': { id: 'a/spaced', description: 'Pins an output whose ends are whitespace.', message: ' {{v}} ', messageId: 'a.spaced', expected: { output: ' x ' } },
  'a.report': { id: 'a/report', description: 'Pins a report.', message: '{{v:none}}', messageId: 'a.report', expected: { output: 'x', reports: [{ code: 'unknown-modifier', origin: 'message', id: 'a.report' }] } },
  'a.order': { id: 'a/order', description: 'Pins the order of two reports.', message: '{{v:none}}{{w; eq:}}', messageId: 'a.order', expected: { output: 'x', reports: [{ code: 'unknown-modifier', origin: 'message', id: 'a.order' }, { code: 'missing-options', origin: 'payload', id: 'a.order' }] } },
  limits: { id: 'limits/over', description: 'Pins the declared pass limit.', generate: 'passes-over-limit' },
  'b.format': { id: 'b/format', description: 'Pins a request.', message: '{{n:number}}', messageId: 'b.format', locale: 'de', expected: { format: REQUEST } },
};

// What the implementation behind the adapter produced for each, keyed by the
// id the case resolves under.
const ANSWERS: Record<string, Resolved> = {
  'a.plain': { output: 'x', reports: [] },
  'a.spaced': { output: ' x ', reports: [] },
  'a.report': { output: 'x', reports: [{ code: 'unknown-modifier', origin: 'message', id: 'a.report' }] },
  'a.order': { output: 'x', reports: [{ code: 'unknown-modifier', origin: 'message', id: 'a.order' }, { code: 'missing-options', origin: 'payload', id: 'a.order' }] },
  limits: { output: '{{p4}}', reports: [{ code: 'pass-limit', origin: 'limit', id: 'limits', limit: LIMITS.passes }] },
  'b.format': { output: format(REQUEST, 'de'), reports: [] },
};

const file = (name: string, level: FixtureFile['level'], ids: string[]): Fixture => ({
  name,
  file: { format: 'curly-message-1', level, section: level === 'intl' ? '11.2' : '9', cases: ids.map((id) => CASES[id]) },
});

const SET = [file('core.json', 'core', ['a.plain', 'a.spaced', 'a.report', 'a.order', 'limits']), file('intl.json', 'intl', ['b.format'])];

// An implementation that answers every case of the set correctly: what a
// defect is applied to, and what the audit needs.
const conforming = (over: Partial<Adapter> = {}): Adapter => ({
  levels: ['core', 'intl', 'extensions'],
  limits: LIMITS,
  resolve: ({ id }) => ANSWERS[String(id)],
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

  it('pins a heading of SPEC.md with every section', () => {
    const headings = new Set([...readFileSync(join(root, '..', 'SPEC.md'), 'utf8').matchAll(/^#{2,3} (\d+\.\d+|\d+|A\.\d+)\b/gm)].map(([, number]) => number));

    expect(defects().filter(({ section }) => section !== undefined && !headings.has(section))).toEqual([]);
  });

  it('states a request the shipped set states nowhere, so a case compared on one fails on it', () => {
    const { adapter } = mutations['formats-wrong'](conforming());
    const wrong = JSON.stringify(adapter.resolve({ message: '', id: 'a.plain' }).formats?.[0]);
    const stated = fixtures().flatMap(({ file: f }) => f.cases.flatMap((c) => 'generate' in c || !c.expected.format ? [] : [JSON.stringify(c.expected.format)]));

    expect(stated.length).toBeGreaterThan(0);
    expect(stated).not.toContain(wrong);
  });
});

describe('audit', () => {
  it('catches every defect of the catalogue with an adapter that passes the set', () => {
    const missed = audit(conforming(), { fixtures: SET }).filter(({ outcome }) => outcome !== 'caught');

    expect(missed).toEqual([]);
  });

  it('answers what the runner made of the defect beside what it expected', () => {
    const entries = audited(conforming());

    expect(entries['output-truncated']).toMatchObject({ expects: 'fail', observed: 'fail', outcome: 'caught', section: '9' });
    expect(entries['claims-no-core']).toMatchObject({ expects: 'error', observed: 'error', outcome: 'caught' });
    expect(entries['claims-core-only']).toMatchObject({ expects: 'skip', observed: 'skip', outcome: 'caught' });
    expect(entries['reports-unobserved']).toMatchObject({ expects: 'unobserved', observed: 'unobserved', outcome: 'caught' });
  });

  it('calls a defect unreachable where the adapter never answers what it alters', () => {
    const silent = conforming({ resolve: ({ id }) => ({ output: ANSWERS[String(id)].output }) });
    const core = conforming({ levels: ['core'] });

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
      'claims-no-core': 'caught',
    });
  });

  it('calls a defect missed where it reached the runner and the runner answered nothing', () => {
    const anonymous: ConcreteCase = { id: 'a/anonymous', description: 'Pins a report no expectation names an id of.', message: '{{v:none}}', messageId: 'a.report', expected: { output: 'x', reports: [{ code: 'unknown-modifier', origin: 'message' }] } };
    const set: Fixture[] = [{ name: 'core.json', file: { format: 'curly-message-1', level: 'core', section: '9', cases: [anonymous] } }, SET[1]];

    expect(outcomes(conforming(), set)).toMatchObject({ 'report-id-changed': 'missed', 'report-code-changed': 'caught' });
    expect(audited(conforming(), set)['report-id-changed']).toMatchObject({ expects: 'fail', observed: 'none' });
  });

  it('needs an adapter that passes the set', () => {
    const wrong = conforming({ resolve: () => ({ output: 'not what any case expects' }) });

    expect(() => audit(wrong, { fixtures: SET })).toThrow('The audit needs an adapter that passes the set; this one fails 6 of 6 cases.');
  });
});
