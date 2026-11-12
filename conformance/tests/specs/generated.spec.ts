import { describe, expect, it } from 'vitest';
import { behaviours, decode, plan, type Adapter, type Fixture, type Generator, type Resolution, type Resolved } from '@curly-message/conformance';
import { resolver, type Mutant } from './kept';

const limits = { output: 5, read: 7, conversion: 7, nesting: 3 };

const fixture = (generate: Generator): Fixture => ({
  name: 'limits.json',
  file: { format: 'curly-message-3', level: 'core', section: '13', cases: [{ id: `limits/${generate}`, description: `Pins ${generate}.`, generate }] },
});

// Runs one construction through an adapter that answers as scripted, and
// hands back what the adapter was given beside the outcome.
const build = (generate: Generator, answer: (input: Resolution) => Resolved, declared = limits, reentry?: number) => {
  let received: Resolution | undefined;
  const adapter: Adapter = {
    levels: ['core', 'extensions'],
    limits: declared,
    reentry,
    resolve: (input) => {
      received = input;

      return answer(input);
    },
  };
  const [planned] = plan(adapter, { fixtures: [fixture(generate)] }).cases;
  const outcome = planned.execute();

  return { input: received as Resolution, outcome };
};

const visits = (value: unknown) => {
  let count = 0;

  JSON.stringify(value, (_, entry) => {
    count += 1;

    return entry;
  });

  return count;
};

describe('generated cases', () => {
  it('output-at-limit writes exactly L characters from the message', () => {
    const { input, outcome } = build('output-at-limit', () => ({ output: 'xxxxx', reports: [] }));

    expect(input).toEqual({ message: '{{v; a:xxxxx;}}', payload: { v: 'a' }, id: 'limits' });
    expect(outcome).toEqual({ ok: true });
  });

  it('output-at-limit expects the whole run and no reports', () => {
    expect(build('output-at-limit', () => ({ output: 'xxxx', reports: [] })).outcome).toEqual({ ok: false, reason: 'The output differs.', expected: 'xxxxx', actual: 'xxxx' });
    expect(build('output-at-limit', () => ({ output: 'xxxxx', reports: [{ code: 'output-limit' }] })).outcome).toMatchObject({ ok: false, reason: 'Expected 0 reports, got 1 report.', expected: [] });
  });

  it('output-over-limit writes one character more and expects the message around it with an output-limit report', () => {
    const { input, outcome } = build('output-over-limit', () => ({ output: 'AB', reports: [] }));

    expect(input).toEqual({ message: 'A{{v; a:xxxxxx;}}B', payload: { v: 'a' }, id: 'limits' });
    expect(outcome).toEqual({ ok: false, reason: 'Expected 1 report, got 0 reports.', expected: [{ code: 'output-limit', origin: 'limit', id: 'limits', limit: 5 }], actual: [] });
  });

  it('holds a report that carries a limit to the declared one, and one that carries none to nothing', () => {
    expect(build('output-over-limit', () => ({ output: 'AB', reports: [{ code: 'output-limit', origin: 'limit', id: 'limits', limit: 5 }] })).outcome).toEqual({ ok: true });
    expect(build('output-over-limit', () => ({ output: 'AB', reports: [{ code: 'output-limit' }] })).outcome).toEqual({ ok: true });
    expect(build('output-over-limit', () => ({ output: 'AB', reports: [{ code: 'output-limit', limit: 10 }] })).outcome).toMatchObject({ ok: false, reason: 'The limit of report 1 differs.' });
  });

  it('output-over-limit-continues writes past the limit and expects the placeholder after it carried', () => {
    const { input, outcome } = build('output-over-limit-continues', () => ({ output: 'tail', reports: [{ code: 'output-limit', origin: 'limit', id: 'limits', limit: 5 }] }));

    expect(input).toEqual({ message: '{{v; a:xxxxxx;}}{{w}}', payload: { v: 'a', w: 'tail' }, id: 'limits' });
    expect(outcome).toEqual({ ok: true });
    expect(build('output-over-limit-continues', () => ({ output: '', reports: [{ code: 'output-limit' }] })).outcome).toEqual({ ok: false, reason: 'The output differs.', expected: 'tail', actual: '' });
  });

  it('read-at-limit holds a value of R characters the placeholder selects nothing from', () => {
    const { input, outcome } = build('read-at-limit', () => ({ output: 'ok', reports: [] }));

    expect(input).toEqual({ message: '{{v:eq; nomatch:X; default:ok;}}', payload: { v: 'xxxxxxx' }, id: 'limits' });
    expect(outcome).toEqual({ ok: true });
  });

  it('read-over-limit holds one character more and expects the placeholder after it to pay', () => {
    const { input, outcome } = build('read-over-limit', () => ({ output: 'ok', reports: [{ code: 'read-limit', origin: 'limit', id: 'limits', limit: 7 }] }));

    expect(input).toEqual({ message: '{{v:eq; nomatch:X; default:ok;}}{{w}}', payload: { v: 'xxxxxxxx', w: 'tail' }, id: 'limits' });
    expect(outcome).toEqual({ ok: true });
    expect(build('read-over-limit', () => ({ output: 'oktail', reports: [] })).outcome).toEqual({ ok: false, reason: 'The output differs.', expected: 'ok', actual: 'oktail' });
  });

  it('conversion-at-limit shares one object of undefined members and adds more, visiting exactly C nodes, and expects the option only a converted value selects', () => {
    const { input, outcome } = build('conversion-at-limit', () => ({ output: 'ok', reports: [] }));
    const { v } = input.payload as { v: Record<string, unknown> };
    const shared = { k0: undefined };

    expect(input).toMatchObject({ message: '{{v:ne; nomatch:ok; default:refused;}}', id: 'limits' });
    expect(v).toStrictEqual({ s0: shared, s1: shared, u0: undefined, u1: undefined });
    expect(v.s0).toBe(v.s1);
    expect(visits(v)).toBe(7);
    expect(JSON.stringify(v)).toBe('{"s0":{},"s1":{}}');
    expect(outcome).toEqual({ ok: true });
    expect(build('conversion-at-limit', () => ({ output: 'refused', reports: [] })).outcome).toEqual({ ok: false, reason: 'The output differs.', expected: 'ok', actual: 'refused' });
    expect(build('conversion-at-limit', () => ({ output: 'ok', reports: [{ code: 'unserializable-value', origin: 'payload', id: 'limits' }] })).outcome).toMatchObject({ ok: false, reason: 'Expected 0 reports, got 1 report.', expected: [] });
  });

  it('conversion-over-limit is built the same way, visiting C + 1 nodes, and expects the default with an unserializable-value report', () => {
    const { input, outcome } = build('conversion-over-limit', () => ({ output: 'D', reports: [{ code: 'unserializable-value', origin: 'payload', id: 'limits' }] }));
    const { v } = input.payload as { v: Record<string, unknown> };

    expect(input).toMatchObject({ message: '{{v; default:D}}', id: 'limits' });
    expect(Object.keys(v)).toEqual(['s0', 's1', 'u0', 'u1', 'u2']);
    expect(visits(v)).toBe(8);
    expect(outcome).toEqual({ ok: true });
    expect(build('conversion-over-limit', () => ({ output: 'D', reports: [] })).outcome).toEqual({ ok: false, reason: 'Expected 1 report, got 0 reports.', expected: [{ code: 'unserializable-value', origin: 'payload', id: 'limits' }], actual: [] });
  });

  it('visits the stated nodes at section 13\'s minimum while writing a fraction of the text bound', () => {
    const minima = { output: 100000, read: 100000, conversion: 100000, nesting: 8 };

    for (const [generate, nodes] of [['conversion-at-limit', 100000], ['conversion-over-limit', 100001]] as const) {
      const { v } = build(generate, () => ({ output: '', reports: [] }), minima).input.payload as { v: unknown };

      expect(visits(v)).toBe(nodes);
      expect(JSON.stringify(v).length).toBeLessThan(minima.conversion / 10);
    }
  });

  it('conversion-over-limit fails an implementation that bounds the text a serialization writes and not the nodes it visits', () => {
    // A bound on the text alone refuses a value whose text grows with its
    // nodes, as a tree of shared references does, so only a value that visits
    // its nodes and writes little tells the two bounds apart. At the minima,
    // where the text bound is as large as the node bound.
    const minima = { output: 100000, read: 100000, conversion: 100000, nesting: 8 };
    const textBound = ({ payload }: Resolution): Resolved => {
      const text = JSON.stringify((payload as { v: unknown }).v);

      return text.length >= minima.conversion ? { output: 'D', reports: [{ code: 'unserializable-value', origin: 'payload', id: 'limits' }] } : { output: text, reports: [] };
    };

    expect(textBound({ message: '{{v; default:D}}', payload: { v: decode({ $curly: 'nodes', count: minima.conversion + 1 }) } }).output).toBe('D');
    expect(build('conversion-over-limit', textBound, minima).outcome).toMatchObject({ ok: false, reason: 'The output differs.', expected: 'D' });
  });

  it('conversion-over-limit fails an implementation that counts a shared object once, or skips the members it omits', () => {
    const counting = (count: (value: unknown) => number) => ({ payload }: Resolution): Resolved => count((payload as { v: unknown }).v) > limits.conversion
      ? { output: 'D', reports: [{ code: 'unserializable-value', origin: 'payload', id: 'limits' }] }
      : { output: JSON.stringify((payload as { v: unknown }).v), reports: [] };
    const once = (value: unknown) => {
      const seen = new Set<unknown>();
      let count = 0;

      JSON.stringify(value, (_, entry) => {
        if (typeof entry === 'object' && entry !== null) {
          if (seen.has(entry)) return undefined;
          seen.add(entry);
        }
        count += 1;

        return entry;
      });

      return count;
    };
    const written = (value: unknown) => visits(JSON.parse(JSON.stringify(value)));

    expect(build('conversion-over-limit', counting(visits)).outcome).toEqual({ ok: true });
    expect(build('conversion-over-limit', counting(once)).outcome).toMatchObject({ ok: false, reason: 'The output differs.', expected: 'D' });
    expect(build('conversion-over-limit', counting(written)).outcome).toMatchObject({ ok: false, reason: 'The output differs.', expected: 'D' });
  });

  it('conversion-over-limit-continues refuses a value whose text runs past R, and expects the placeholder after it carried', () => {
    const unserializable = { code: 'unserializable-value', origin: 'payload', id: 'limits' } as const;
    const { input, outcome } = build('conversion-over-limit-continues', () => ({ output: 'Dtail', reports: [unserializable] }));
    const { v, w } = input.payload as { v: string[]; w: string };

    expect(input).toMatchObject({ message: '{{v; default:D}}{{w}}', id: 'limits' });
    expect(v).toEqual(Array.from({ length: 7 }, () => 'xx'));
    expect(visits(v)).toBe(8);
    expect(v.join('').length).toBeGreaterThan(7);
    expect(w).toBe('tail');
    expect(outcome).toEqual({ ok: true });
    // A refused serialization charged to the read budget leaves none for the placeholder after it.
    expect(build('conversion-over-limit-continues', () => ({ output: 'D', reports: [unserializable, { code: 'read-limit', origin: 'limit', id: 'limits', limit: 7 }] })).outcome).toEqual({ ok: false, reason: 'The output differs.', expected: 'Dtail', actual: 'D' });
  });

  it('nesting-at-limit nests exactly N levels and expects the innermost option', () => {
    const { input, outcome } = build('nesting-at-limit', () => ({ output: 'settled', reports: [] }));

    expect(input).toEqual({ message: '{{v; a:{{v; a:{{v; a:settled; default:fallback;}};}};}}', payload: { v: 'a' }, id: 'limits' });
    expect(outcome).toEqual({ ok: true });
  });

  it('nesting-over-limit nests one level more and expects the fallback with a nesting-limit report of message origin', () => {
    const { input, outcome } = build('nesting-over-limit', () => ({ output: 'fallback', reports: [{ code: 'nesting-limit', origin: 'message', id: 'limits', limit: 3 }] }));

    expect(input).toEqual({ message: '{{v; a:{{v; a:{{v; a:{{v; a:settled; default:fallback;}};}};}};}}', payload: { v: 'a' }, id: 'limits' });
    expect(outcome).toEqual({ ok: true });
    expect(build('nesting-over-limit', () => ({ output: 'settled', reports: [] })).outcome).toEqual({ ok: false, reason: 'The output differs.', expected: 'fallback', actual: 'settled' });
  });

  it('nesting-chain-over-limit nests inline defaults 20 000 levels past N and expects the innermost text with a nesting-limit report for each', () => {
    const refused = { code: 'nesting-limit', origin: 'message', id: 'limits', limit: 3 } as const;
    const { input, outcome } = build('nesting-chain-over-limit', () => ({ output: 'x', reports: Array.from({ length: 20000 }, () => refused) }));

    expect(input).toEqual({ message: `${'{{v; default:'.repeat(20003)}x${'}}'.repeat(20003)}`, payload: {}, id: 'limits' });
    expect(outcome).toEqual({ ok: true });
    expect(build('nesting-chain-over-limit', () => ({ output: 'x', reports: Array.from({ length: 19999 }, () => refused) })).outcome).toMatchObject({ ok: false, reason: 'Expected 20000 reports, got 19999 reports.' });
    expect(build('nesting-chain-over-limit', () => { throw new RangeError('Maximum call stack size exceeded'); }).outcome).toEqual({ ok: false, reason: 'The adapter raised.', expected: 'x', actual: 'Maximum call stack size exceeded' });
  });

  const refused = { code: 'nesting-limit', origin: 'message', id: 'limits', limit: 3 } as const;
  const spent = { code: 'read-limit', origin: 'limit', id: 'limits', limit: 7 } as const;
  const unserializable = { code: 'unserializable-value', origin: 'payload', id: 'limits' } as const;

  it('nesting-over-limit-converts refuses a placeholder whose value cannot be described, and expects the conversion reported before the refusal', () => {
    const { input, outcome } = build('nesting-over-limit-converts', () => ({ output: 'fallback', reports: [unserializable, refused] }));
    const { w } = input.payload as { w: Record<string, unknown> };

    expect(input).toMatchObject({ message: '{{v; a:{{v; a:{{v; a:{{w; default:fallback;}};}};}};}}', payload: { v: 'a' }, id: 'limits' });
    expect(() => JSON.stringify(w)).toThrow();
    expect(outcome).toEqual({ ok: true });
    // Refused before its value was converted, the placeholder reports nothing of the value.
    expect(build('nesting-over-limit-converts', () => ({ output: 'fallback', reports: [refused] })).outcome).toMatchObject({ ok: false, reason: 'Expected 2 reports, got 1 report.' });
    expect(build('nesting-over-limit-converts', () => ({ output: 'fallback', reports: [refused, unserializable] })).outcome).toMatchObject({ ok: false, reason: 'The code of report 1 differs.' });
  });

  it('nesting-over-limit-reads refuses a placeholder reading past R, and expects the placeholder after it to pay', () => {
    const { input, outcome } = build('nesting-over-limit-reads', () => ({ output: 'fallback', reports: [refused, spent] }));

    expect(input).toEqual({ message: '{{v; a:{{v; a:{{v; a:{{w; default:fallback;}};}};}};}}{{v}}', payload: { v: 'a', w: 'xxxxxxxx' }, id: 'limits' });
    expect(outcome).toEqual({ ok: true });
    // Refused before it read, the placeholder leaves the budget to the one after it.
    expect(build('nesting-over-limit-reads', () => ({ output: 'fallbacka', reports: [refused] })).outcome).toEqual({ ok: false, reason: 'The output differs.', expected: 'fallback', actual: 'fallbacka' });
  });

  it('nesting-over-limit-read-spent reaches a placeholder past N with the budget spent, and expects it resolved to the empty string as read-limit', () => {
    const { input, outcome } = build('nesting-over-limit-read-spent', () => ({ output: '', reports: [refused, spent] }));

    expect(input).toEqual({ message: '{{v; a:{{v; a:{{v; a:{{w:eq; nomatch:X;}}{{v; default:fallback;}};}};}};}}', payload: { v: 'a', w: 'xxxxxxxx' }, id: 'limits' });
    expect(outcome).toEqual({ ok: true });
    // Refused before the read limit was tested, the second placeholder takes its chain.
    expect(build('nesting-over-limit-read-spent', () => ({ output: 'fallback', reports: [refused, refused] })).outcome).toEqual({ ok: false, reason: 'The output differs.', expected: '', actual: 'fallback' });
  });

  it('nesting-over-limit-unknown-modifier refuses a placeholder naming a modifier nobody registered, and expects the refusal alone', () => {
    const { input, outcome } = build('nesting-over-limit-unknown-modifier', () => ({ output: 'fallback', reports: [refused] }));

    expect(input).toEqual({ message: '{{v; a:{{v; a:{{v; a:{{w:zz; default:fallback;}};}};}};}}', payload: { v: 'a', w: 'x' }, id: 'limits' });
    expect(outcome).toEqual({ ok: true });
    // The unknown modifier decided before the nesting limit, the placeholder reports that one instead.
    expect(build('nesting-over-limit-unknown-modifier', () => ({ output: 'fallback', reports: [{ code: 'unknown-modifier', origin: 'message', id: 'limits' }] })).outcome).toMatchObject({ ok: false, reason: 'The code of report 1 differs.' });
  });

  it('nesting-over-limit-missing-options refuses a placeholder selecting from no options, and expects the refusal alone', () => {
    const { input, outcome } = build('nesting-over-limit-missing-options', () => ({ output: 'fallback', reports: [refused] }));

    expect(input).toEqual({ message: '{{v; a:{{v; a:{{v; a:{{w:eq; default:fallback;}};}};}};}}', payload: { v: 'a', w: 'x' }, id: 'limits' });
    expect(outcome).toEqual({ ok: true });
    // Both decided, the placeholder reports one message error more than it meets.
    expect(build('nesting-over-limit-missing-options', () => ({ output: 'fallback', reports: [refused, { code: 'missing-options', origin: 'message', id: 'limits' }] })).outcome).toMatchObject({ ok: false, reason: 'Expected 1 report, got 2 reports.' });
  });

  // The constructions built from the bound on counted reads, at a bound of 2
  // and a nesting limit of 3, and at a bound of 0.
  const kept = (generate: Generator, output: string, reentry = 2) => build(generate, () => ({ output, reports: [] }), limits, reentry);
  const TAKE = '{{x:take; default:F}}';
  const keeps = (count: number, body = TAKE) => `{{x:keep; default:${body}}}`.repeat(count);

  it('hands each construction of kept reads the behaviours that keep an input, afresh for each resolution, over a value that reads nothing', () => {
    const { input } = kept('reentry-at-limit', 'none');
    const again = kept('reentry-at-limit', 'none').input;

    expect(input).toMatchObject({ payload: { x: '' }, id: 'limits' });
    expect(Object.keys(input.modifiers ?? {})).toEqual(['read', 'keep', 'take', 'first']);
    expect(input.modifiers?.read).toBe(behaviours.default);
    expect(input.modifiers?.keep).not.toBe(again.modifiers?.keep);
  });

  it('reentry-at-limit keeps as many inputs as the bound, each taking the one before, and expects every read to produce its text', () => {
    const { input, outcome } = kept('reentry-at-limit', 'none');

    expect(input.message).toBe(`${keeps(2)}${TAKE}`);
    expect(outcome).toEqual({ ok: true });
    // An implementation that counts the resolution as well refuses the last read.
    expect(kept('reentry-at-limit', '').outcome).toEqual({ ok: false, reason: 'The output differs.', expected: 'none', actual: '' });
    expect(kept('reentry-at-limit', 'none', 0)).toMatchObject({ input: { message: TAKE }, outcome: { ok: true } });
  });

  it('reentry-over-limit keeps one input more, and expects the read past the bound refused, failing nothing', () => {
    const { input, outcome } = kept('reentry-over-limit', '[empty]');

    expect(input.message).toBe(`${keeps(1)}${keeps(1, `[${TAKE}]`)}${keeps(1)}${TAKE}`);
    expect(outcome).toEqual({ ok: true });
    // An implementation that lets one read more through, one whose refusal
    // fails the modifier, one whose refusal ends the modifier that made the
    // read, and one that reports it.
    expect(kept('reentry-over-limit', '[none]').outcome).toMatchObject({ ok: false, reason: 'The output differs.', expected: '[empty]' });
    expect(kept('reentry-over-limit', '[F]').outcome).toMatchObject({ ok: false, reason: 'The output differs.', expected: '[empty]' });
    expect(kept('reentry-over-limit', '[]').outcome).toMatchObject({ ok: false, reason: 'The output differs.', expected: '[empty]' });
    expect(build('reentry-over-limit', () => ({ output: '[empty]', reports: [{ code: 'failed-modifier', origin: 'message', id: 'limits' }] }), limits, 2).outcome).toMatchObject({ ok: false, reason: 'Expected 0 reports, got 1 report.' });
    expect(kept('reentry-over-limit', 'empty', 0)).toMatchObject({ input: { message: `${keeps(1)}${TAKE}` }, outcome: { ok: true } });
  });

  it('reentry-refused-not-recorded reads the refused input again, and expects it produced', () => {
    const { input, outcome } = kept('reentry-refused-not-recorded', '[empty]none');

    expect(input.message).toBe(`${keeps(1)}${keeps(1, `[${TAKE}]`)}${keeps(1)}${TAKE}{{x:first; default:F}}`);
    expect(outcome).toEqual({ ok: true });
    // An implementation that records the refused read's empty string.
    expect(kept('reentry-refused-not-recorded', '[empty]empty').outcome).toEqual({ ok: false, reason: 'The output differs.', expected: '[empty]none', actual: '[empty]empty' });
    expect(kept('reentry-refused-not-recorded', 'emptyempty', 0).outcome).toEqual({ ok: true });
  });

  it('reentry-own-reads-free produces a stack of own reads inside as many counted reads as the bound, and expects every one resolved', () => {
    const { input, outcome } = kept('reentry-own-reads-free', 'z');
    const own = '{{x:read; default:{{x:read; default:z}}}}';

    expect(input.message).toBe(`${keeps(1, own)}${keeps(1)}${TAKE}`);
    expect(outcome).toEqual({ ok: true });
    // An implementation that counts own reads toward the bound refuses the innermost.
    expect(kept('reentry-own-reads-free', '').outcome).toMatchObject({ ok: false, reason: 'The output differs.', expected: 'z' });
    expect(kept('reentry-own-reads-free', 'z', 1)).toMatchObject({ input: { message: `${keeps(1, own)}${TAKE}` }, outcome: { ok: true } });
  });

  it('expects of the constructions of kept reads an output that does not grow with the bound, over a value that reads nothing', () => {
    const expected = { 'reentry-at-limit': 'none', 'reentry-over-limit': '[empty]', 'reentry-refused-not-recorded': '[empty]none', 'reentry-own-reads-free': 'z' } as const;

    for (const [generate, output] of Object.entries(expected) as [Generator, string][]) {
      expect(kept(generate, output, 40000)).toMatchObject({ input: { payload: { x: '' } }, outcome: { ok: true } });
    }
  });

  // An implementation that reads section 13 as the cases do passes every
  // construction at every bound, and each way to read it wrongly fails one.
  const reading = (bound: number, mutant?: Mutant) => (generate: Generator) => build(generate, resolver({ bound, mutant }), { ...limits, nesting: 4 }, bound).outcome.ok;
  const CONSTRUCTIONS: Generator[] = ['reentry-at-limit', 'reentry-over-limit', 'reentry-refused-not-recorded', 'reentry-own-reads-free'];

  it('passes an implementation that keeps the bound it states at every construction of kept reads', () => {
    for (const bound of [0, 1, 2, 3]) expect(CONSTRUCTIONS.filter((generate) => bound > 0 || generate !== 'reentry-own-reads-free').map(reading(bound))).toEqual(CONSTRUCTIONS.filter((generate) => bound > 0 || generate !== 'reentry-own-reads-free').map(() => true));
  });

  it('fails each way to read the bound on counted reads wrongly at a construction of kept reads', () => {
    const failing = (mutant: Mutant) => [1, 2, 3].map((bound) => CONSTRUCTIONS.filter((generate) => !reading(bound, mutant)(generate)));
    const each = (...constructions: Generator[]) => [constructions, constructions, constructions];

    // A bound kept one lower than stated, or one higher, or none.
    expect(failing('bound-short')).toEqual(each(...CONSTRUCTIONS));
    expect(failing('bound-long')).toEqual(each('reentry-over-limit', 'reentry-refused-not-recorded'));
    expect(failing('unbounded')).toEqual(each('reentry-over-limit', 'reentry-refused-not-recorded'));
    // A refused read recorded, one that fails the modifier that made it, and
    // one that ends that modifier's call with nothing reported.
    expect(failing('refusal-recorded')).toEqual(each('reentry-refused-not-recorded'));
    expect(failing('refusal-raises')).toEqual(each('reentry-over-limit', 'reentry-refused-not-recorded'));
    expect(failing('refusal-aborts')).toEqual(each('reentry-over-limit', 'reentry-refused-not-recorded'));
    expect(['reentry-over-limit', 'reentry-refused-not-recorded'].map((generate) => reading(0, 'refusal-aborts')(generate as Generator))).toEqual([false, false]);
    // Own reads counted toward the bound.
    expect(failing('own-reads-counted')).toEqual(each('reentry-own-reads-free'));
    // A read of a default in production is the written case's to pin.
    expect(failing('in-progress-read')).toEqual(each());
  });
});
