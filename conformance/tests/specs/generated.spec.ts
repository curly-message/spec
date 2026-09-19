import { describe, expect, it } from 'vitest';
import { plan, type Adapter, type Fixture, type Generator, type Resolution, type Resolved } from '../../src';

const limits = { output: 5, read: 7, conversion: 7, nesting: 3 };

const fixture = (generate: Generator): Fixture => ({
  name: 'limits.json',
  file: { format: 'curly-message-2', level: 'core', section: '13', cases: [{ id: `limits/${generate}`, description: `Pins ${generate}.`, generate }] },
});

// Runs one construction through an adapter that answers as scripted, and
// hands back what the adapter was given beside the outcome.
const build = (generate: Generator, answer: (input: Resolution) => Resolved) => {
  let received: Resolution | undefined;
  const adapter: Adapter = {
    levels: ['core', 'extensions'],
    limits,
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

  it('conversion-over-limit holds a value visiting more than C nodes and expects the default with an unserializable-value report', () => {
    const { input, outcome } = build('conversion-over-limit', () => ({ output: 'D', reports: [{ code: 'unserializable-value', origin: 'payload', id: 'limits' }] }));
    const { v } = input.payload as { v: unknown };

    expect(input).toMatchObject({ message: '{{v; default:D}}', id: 'limits' });
    expect(visits(v)).toBeGreaterThanOrEqual(8);
    expect(outcome).toEqual({ ok: true });
    expect(build('conversion-over-limit', () => ({ output: 'D', reports: [] })).outcome).toEqual({ ok: false, reason: 'Expected 1 report, got 0 reports.', expected: [{ code: 'unserializable-value', origin: 'payload', id: 'limits' }], actual: [] });
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
});
