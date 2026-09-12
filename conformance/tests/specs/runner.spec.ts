import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { behaviours, check, fixtures, load, plan, run, summarize, type Adapter, type Case, type ConcreteCase, type Fixture, type Level } from '../../src';
import { format } from '../../src/cases';

const LIMITS = { passes: 10, output: 100000, conversion: 100000 };

const file = (level: Level, cases: Case[], section = '9'): Fixture => ({ name: `${level}.json`, file: { format: 'curly-message-1', level, section, cases } });

const concrete = (id: string, over: Partial<ConcreteCase> = {}): ConcreteCase => ({ id, description: `Pins ${id}.`, message: '{{v}}', payload: { v: 'x' }, expected: { output: 'x' }, ...over });

const adapter = (resolve: Adapter['resolve'], levels: Level[] = ['core']): Adapter => ({ levels, limits: LIMITS, resolve });

// An implementation of nothing but `{{v}}`, reporting nothing.
const echo: Adapter['resolve'] = ({ payload }) => ({ output: String((payload as { v: string }).v), reports: [] });

const outcome = (a: Adapter, c: Case, level: Level = 'core') => plan(a, { fixtures: [file(level, [c])] }).cases[0].execute();

describe('plan', () => {
  it('requires the adapter to claim core', () => {
    expect(() => plan(adapter(echo, ['intl']))).toThrow('The adapter must claim the core level.');
  });

  it('requires the levels option to be among the levels the adapter claims', () => {
    expect(() => plan(adapter(echo), { levels: ['core', 'intl'] })).toThrow('The adapter does not claim the intl level.');
    expect(() => plan(adapter(echo, ['core', 'intl']), { levels: ['intl'], fixtures: [] })).not.toThrow();
  });

  it('rejects a level that is not one of section 2\'s, in the adapter\'s claims and in the levels option', () => {
    const claiming = (...levels: string[]) => adapter(echo, levels as Level[]);

    expect(() => plan(claiming('core', 'foo'))).toThrow('The adapter names the level "foo"; the levels are core, intl and extensions.');
    expect(() => plan(claiming('core'), { levels: [''] as unknown as Level[] })).toThrow('The levels option names the level ""; the levels are core, intl and extensions.');
    expect(() => plan(claiming('core'), { levels: ['core', ''] as unknown as Level[] })).toThrow('The levels option names the level ""');
  });

  it('rejects an adapter that lists no levels or declares no positive integer limits', () => {
    const shaped = (over: object) => ({ ...adapter(echo), ...over });

    expect(() => plan(shaped({ levels: undefined }))).toThrow('The adapter must list the levels it claims.');
    expect(() => plan(shaped({ limits: undefined }))).toThrow('The adapter must declare its passes limit as a positive integer.');
    expect(() => plan(shaped({ limits: { passes: 10, output: 100000 } }))).toThrow('The adapter must declare its conversion limit as a positive integer.');
    expect(() => plan(shaped({ limits: { passes: 2.5, output: 100000, conversion: 100000 } }))).toThrow('The adapter must declare its passes limit as a positive integer.');
    expect(() => plan(shaped({ limits: { passes: 10, output: 0, conversion: 100000 } }))).toThrow('The adapter must declare its output limit as a positive integer.');
  });

  it('rejects a generated case naming no construction, the prototype\'s names included', () => {
    const generated = (generate: string) => ({ id: 'a/generated', description: 'Pins nothing.', generate } as unknown as Case);

    expect(() => outcome(adapter(echo), generated('bogus'))).toThrow('The case a/generated names no construction: "bogus".');
    expect(() => outcome(adapter(echo), generated('toString'))).toThrow('The case a/generated names no construction: "toString".');
  });

  it('identifies each case by its file, level, section and description, the case section over the file one', () => {
    const { cases } = plan(adapter(echo), { fixtures: [file('core', [concrete('a/one'), concrete('a/two', { section: '9.2' })], '9')] });

    expect(cases.map(({ execute: _, ...identity }) => identity)).toEqual([
      { id: 'a/one', file: 'core.json', level: 'core', section: '9', description: 'Pins a/one.' },
      { id: 'a/two', file: 'core.json', level: 'core', section: '9.2', description: 'Pins a/two.' },
    ]);
  });

  it('skips the files at a level the adapter does not claim, naming the level', () => {
    const { cases, skipped } = plan(adapter(echo), { fixtures: [file('core', [concrete('a/one')]), file('intl', [concrete('b/one')], '11.2')] });

    expect(cases.map(({ id }) => id)).toEqual(['a/one']);
    expect(skipped).toEqual([{ id: 'b/one', file: 'intl.json', level: 'intl', section: '11.2', description: 'Pins b/one.', reason: 'The adapter does not claim the intl level.' }]);
  });

  it('skips the files at a claimed level the levels option leaves out, naming the level', () => {
    const { cases, skipped } = plan(adapter(echo, ['core', 'intl']), { levels: ['core'], fixtures: [file('core', [concrete('a/one')]), file('intl', [concrete('b/one')])] });

    expect(cases.map(({ id }) => id)).toEqual(['a/one']);
    expect(skipped.map(({ id, reason }) => ({ id, reason }))).toEqual([{ id: 'b/one', reason: 'The intl level is not among the levels being run.' }]);
  });

  it('plans output-over-limit-stops only where the extensions level runs, whatever the file level', () => {
    const stops: Case = { id: 'limits/stops', description: 'Pins the stop.', generate: 'output-over-limit-stops' };
    const set = [file('core', [stops], '13')];

    expect(plan(adapter(echo), { fixtures: set }).skipped.map(({ id, reason }) => ({ id, reason }))).toEqual([{ id: 'limits/stops', reason: 'The case registers a host-defined modifier, which needs the extensions level.' }]);
    expect(plan(adapter(echo, ['core', 'extensions']), { levels: ['core'], fixtures: set }).skipped.map(({ id }) => id)).toEqual(['limits/stops']);
    expect(plan(adapter(echo, ['core', 'extensions']), { fixtures: set }).cases.map(({ id }) => id)).toEqual(['limits/stops']);
  });

  it('hands the adapter the decoded inputs and the behaviours the case names', () => {
    const resolve = vi.fn(echo);
    const c = concrete('a/inputs', {
      message: { $curly: 'undefined' },
      payload: { v: 'x', w: { value: { $curly: 'undefined' }, default: 'W' } },
      props: { number: { maximumFractionDigits: 1 } },
      locale: 'cs',
      key: 'a.key',
      modifiers: { up: 'upper', obj: 'object' },
      defaults: { number: { useGrouping: false } },
    });

    outcome(adapter(resolve), c);

    const [input] = resolve.mock.calls[0];

    expect(input).toEqual({
      message: undefined,
      payload: { v: 'x', w: { value: undefined, default: 'W' } },
      props: { number: { maximumFractionDigits: 1 } },
      locale: 'cs',
      key: 'a.key',
      modifiers: { up: behaviours.upper, obj: behaviours.object },
      defaults: { number: { useGrouping: false } },
    });
    expect('value' in (input.payload as { w: object }).w).toBe(true);
  });

  it('leaves what a case does not write undefined', () => {
    const resolve = vi.fn(echo);

    outcome(adapter(resolve), concrete('a/bare'));

    expect(resolve.mock.calls[0][0]).toEqual({ message: '{{v}}', payload: { v: 'x' } });
  });
});

describe('execute', () => {
  it('passes where the output and the reports match', () => {
    expect(outcome(adapter(echo), concrete('a/pass'))).toEqual({ ok: true });
  });

  it('fails on a differing output, with what was expected and what came back', () => {
    expect(outcome(adapter(() => ({ output: 'y', reports: [] })), concrete('a/output'))).toEqual({ ok: false, reason: 'The output differs.', expected: 'x', actual: 'y' });
  });

  it('fails where the adapter raised, with the error message as what came back', () => {
    const raising = adapter(() => {
      throw new Error('boom');
    });

    expect(outcome(raising, concrete('a/raise'))).toEqual({ ok: false, reason: 'The adapter raised.', expected: 'x', actual: 'boom' });
  });

  it('fails where the adapter raised with something JSON cannot describe, without raising itself', () => {
    const cyclic: Record<string, unknown> = {};

    cyclic.self = cyclic;

    const raising = (thrown: unknown) => adapter(() => {
      throw thrown;
    });

    expect(outcome(raising(cyclic), concrete('a/cyclic'))).toEqual({ ok: false, reason: 'The adapter raised.', expected: 'x', actual: '[object Object]' });
    expect(outcome(raising('text'), concrete('a/text'))).toEqual({ ok: false, reason: 'The adapter raised.', expected: 'x', actual: '"text"' });
    expect(outcome(raising(undefined), concrete('a/nothing'))).toEqual({ ok: false, reason: 'The adapter raised.', expected: 'x', actual: 'undefined' });
  });

  it('fails where the adapter answered with no resolution, or answered asynchronously', () => {
    const answering = (answer: unknown) => adapter(() => answer as ReturnType<Adapter['resolve']>);

    expect(outcome(answering(undefined), concrete('a/none'))).toEqual({ ok: false, reason: 'The adapter answered with no resolution.', expected: 'x', actual: undefined });
    expect(outcome(answering('x'), concrete('a/text'))).toEqual({ ok: false, reason: 'The adapter answered with no resolution.', expected: 'x', actual: 'x' });
    expect(outcome(answering(Promise.resolve({ output: 'x' })), concrete('a/promise'))).toEqual({ ok: false, reason: 'The adapter answered asynchronously; resolve must answer at once.', expected: 'x', actual: 'a promise' });
  });

  it('fails where the reports are neither undefined nor a list', () => {
    const c = concrete('a/list', { expected: { output: 'x', reports: [{ code: 'unknown-modifier', origin: 'message' }] } });
    const reporting = (reports: unknown) => adapter(() => ({ output: 'x', reports: reports as [] }));

    expect(outcome(reporting(null), c)).toEqual({ ok: false, reason: 'The reports are not a list.', expected: [{ code: 'unknown-modifier', origin: 'message' }], actual: null });
    expect(outcome(reporting('none'), c)).toMatchObject({ ok: false, reason: 'The reports are not a list.', actual: 'none' });
  });

  it('fails on a differing report count', () => {
    const c = concrete('a/count', { expected: { output: 'x', reports: [{ code: 'unknown-modifier', origin: 'message' }] } });

    expect(outcome(adapter(echo), c)).toEqual({ ok: false, reason: 'Expected 1 report, got 0 reports.', expected: [{ code: 'unknown-modifier', origin: 'message' }], actual: [] });
  });

  it('fails on a differing report code, position by position', () => {
    const c = concrete('a/code', { expected: { output: 'x', reports: [{ code: 'unknown-modifier', origin: 'message' }, { code: 'missing-options', origin: 'message' }] } });
    const reporting = adapter(() => ({ output: 'x', reports: [{ code: 'unknown-modifier' }, { code: 'failed-modifier' }] }));

    expect(outcome(reporting, c)).toEqual({ ok: false, reason: 'The code of report 2 differs.', expected: { code: 'missing-options', origin: 'message' }, actual: { code: 'failed-modifier' } });
  });

  it('compares the origin, the key and the limit only where the adapter\'s report carries them', () => {
    const c = concrete('a/fields', { key: 'k', expected: { output: 'x', reports: [{ code: 'unknown-modifier', origin: 'message', key: 'k' }] } });
    const reporting = (report: object) => adapter(() => ({ output: 'x', reports: [report as { code: 'unknown-modifier' }] }));

    expect(outcome(reporting({ code: 'unknown-modifier' }), c)).toEqual({ ok: true });
    expect(outcome(reporting({ code: 'unknown-modifier', origin: 'message', key: 'k', limit: 10 }), c)).toEqual({ ok: true });
    expect(outcome(reporting({ code: 'unknown-modifier', origin: 'payload' }), c)).toMatchObject({ ok: false, reason: 'The origin of report 1 differs.' });
    expect(outcome(reporting({ code: 'unknown-modifier', key: 'other' }), c)).toMatchObject({ ok: false, reason: 'The key of report 1 differs.' });
  });

  it('leaves a key of another shape unobserved, an expectation naming only text', () => {
    const c = concrete('a/key', { key: ['a', { b: 1 }], expected: { output: 'x', reports: [{ code: 'unknown-modifier', origin: 'message' }] } });
    const reporting = (key: unknown) => adapter(() => ({ output: 'x', reports: [{ code: 'unknown-modifier', key }] }));

    expect(outcome(reporting(['a', { b: 1 }]), c)).toEqual({ ok: true });
    expect(outcome(reporting(['a', { b: 2 }]), c)).toEqual({ ok: true });
  });

  it('passes without checking the reports where the adapter leaves them undefined, and says so', () => {
    const c = concrete('a/unobserved', { expected: { output: 'x', reports: [{ code: 'unknown-modifier', origin: 'message' }] } });

    expect(outcome(adapter(() => ({ output: 'x' })), c)).toEqual({ ok: true, unobserved: 'reports' });
    expect(outcome(adapter(() => ({ output: 'y' })), c)).toMatchObject({ ok: false, reason: 'The output differs.' });
  });

  it('computes a format expectation on this host with the case\'s locale', () => {
    const request = { api: 'NumberFormat', options: { maximumFractionDigits: 2 }, input: 1234.5678 } as const;
    const c = concrete('a/format', { message: '{{n:number}}', payload: { n: '1234.5678' }, locale: 'de', expected: { format: request } });
    const formatted = (locale: string) => adapter(() => ({ output: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(1234.5678), reports: [] }));

    expect(outcome(formatted('de'), c)).toEqual({ ok: true });
    expect(outcome(formatted('en'), c)).toEqual({ ok: false, reason: 'The output differs.', expected: '1.234,57', actual: '1,234.57' });
  });

  it('rejects a case expecting neither an output nor a format', () => {
    expect(() => outcome(adapter(echo), concrete('a/neither', { expected: {} }))).toThrow('The case a/neither expects neither an output nor a format.');
  });
});

describe('format', () => {
  it('performs a NumberFormat request', () => {
    expect(format({ api: 'NumberFormat', options: { style: 'currency', currency: 'EUR' }, input: 12.5 }, 'de')).toBe(new Intl.NumberFormat('de', { style: 'currency', currency: 'EUR' }).format(12.5));
    expect(format({ api: 'NumberFormat', input: 1234.5678 }, 'en')).toBe(new Intl.NumberFormat('en').format(1234.5678));
  });

  it('performs a DateTimeFormat request', () => {
    expect(format({ api: 'DateTimeFormat', options: { timeZone: 'UTC', dateStyle: 'long' }, input: 0 }, 'en')).toBe(new Intl.DateTimeFormat('en', { timeZone: 'UTC', dateStyle: 'long' }).format(0));
  });

  it('performs a RelativeTimeFormat request', () => {
    expect(format({ api: 'RelativeTimeFormat', options: { numeric: 'auto' }, input: [-1, 'day'] }, 'en')).toBe(new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-1, 'day'));
    expect(format({ api: 'RelativeTimeFormat', options: { numeric: 'auto' }, input: [-1, 'day'] }, 'en')).toBe('yesterday');
  });
});

describe('run', () => {
  const set = [
    file('core', [concrete('a/pass'), concrete('a/fail', { expected: { output: 'y' } }), concrete('a/unobserved')]),
    file('intl', [concrete('b/skipped')], '11.2'),
  ];
  const mixed = adapter(({ payload }) => (payload as { v: string }).v === 'x' && Math.random() < 2 ? { output: 'x' } : { output: 'x', reports: [] });

  it('sorts the outcomes', () => {
    const result = run(adapter(echo), { fixtures: set });

    expect(result.passed.map(({ id }) => id)).toEqual(['a/pass', 'a/unobserved']);
    expect(result.failed.map(({ id, outcome: o }) => ({ id, ...o }))).toEqual([{ id: 'a/fail', ok: false, reason: 'The output differs.', expected: 'y', actual: 'x' }]);
    expect(result.skipped.map(({ id }) => id)).toEqual(['b/skipped']);
    expect(result.unobserved).toEqual([]);
  });

  it('lists the passed cases whose reports went unobserved', () => {
    const result = run(mixed, { fixtures: set });

    expect(result.passed.map(({ id }) => id)).toEqual(['a/pass', 'a/unobserved']);
    expect(result.unobserved.map(({ id }) => id)).toEqual(['a/pass', 'a/unobserved']);
  });

  it('summarizes one line per failure and per skipped case, then the counts', () => {
    expect(summarize(run(adapter(echo), { fixtures: set }))).toBe([
      'FAIL a/fail (section 9): The output differs. Expected "y", actual "x". Pins a/fail.',
      'SKIP b/skipped (section 11.2): The adapter does not claim the intl level.',
      '2 passed, 1 failed, 1 skipped',
    ].join('\n'));
    expect(summarize(run(mixed, { fixtures: set })).split('\n').at(-1)).toBe('2 passed, 1 failed, 1 skipped, 2 passed with reports unobserved');
    expect(summarize(run(adapter(echo), { fixtures: [] }))).toBe('0 passed, 0 failed, 0 skipped');
  });

  it('bounds what a failure line shows', () => {
    const long = concrete('a/long', { payload: { v: 'x'.repeat(1000) }, expected: { output: 'y' } });
    const [line] = summarize(run(adapter(echo), { fixtures: [file('core', [long])] })).split('\n');

    expect(line).toContain(`actual "${'x'.repeat(199)}...`);
    expect(line.length).toBeLessThan(400);
  });
});

describe('check', () => {
  it('answers nothing where everything passed', () => {
    expect(() => check(adapter(echo), { fixtures: [file('core', [concrete('a/pass')])] })).not.toThrow();
  });

  it('throws with every failure listed', () => {
    const set = [file('core', [concrete('a/one', { expected: { output: 'y' } }), concrete('a/two', { expected: { output: 'z' } }), concrete('a/three')])];

    expect(() => check(adapter(echo), { fixtures: set })).toThrow([
      '2 of 3 conformance cases failed:',
      'FAIL a/one (section 9): The output differs. Expected "y", actual "x". Pins a/one.',
      'FAIL a/two (section 9): The output differs. Expected "z", actual "x". Pins a/two.',
    ].join('\n'));
  });
});

describe('load', () => {
  it('reads the fixture files of a directory, sorted by name', () => {
    const directory = mkdtempSync(join(tmpdir(), 'curly-conformance-'));
    const b = file('core', [concrete('b/one')]);
    const a = file('intl', [concrete('a/one')]);

    writeFileSync(join(directory, 'b.json'), JSON.stringify(b.file));
    writeFileSync(join(directory, 'a.json'), JSON.stringify(a.file));
    writeFileSync(join(directory, 'notes.txt'), 'not a fixture');

    expect(load(directory)).toEqual([{ name: 'a.json', file: a.file }, { name: 'b.json', file: b.file }]);
  });

  it('ships the set under the package\'s own fixtures directory', () => {
    expect(fixtures()).toEqual(load(fileURLToPath(new URL('../../fixtures/', import.meta.url))));
  });
});
