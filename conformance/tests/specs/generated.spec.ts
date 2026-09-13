import { describe, expect, it } from 'vitest';
import { behaviours, plan, type Adapter, type Fixture, type Generator, type ModifierInput, type Resolution, type Resolved } from '../../src';

const limits = { passes: 3, output: 5, conversion: 7 };

const fixture = (generate: Generator): Fixture => ({
  name: 'limits.json',
  file: { format: 'curly-message-1', level: 'core', section: '13', cases: [{ id: `limits/${generate}`, description: `Pins ${generate}.`, generate }] },
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

// The message a call raised with, or nothing where it answered.
const raised = (call: () => unknown) => {
  try {
    call();
  } catch (error) {
    return (error as Error).message;
  }

  return undefined;
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
  it('passes-at-limit chains exactly P links to settled', () => {
    const { input, outcome } = build('passes-at-limit', () => ({ output: 'settled', reports: [] }));

    expect(input).toEqual({ message: '{{p1}}', payload: { p1: '{{p2}}', p2: '{{p3}}', p3: 'settled' }, id: 'limits' });
    expect(outcome).toEqual({ ok: true });
  });

  it('passes-at-limit expects settled and no reports', () => {
    expect(build('passes-at-limit', () => ({ output: 'x', reports: [] })).outcome).toEqual({ ok: false, reason: 'The output differs.', expected: 'settled', actual: 'x' });
    expect(build('passes-at-limit', () => ({ output: 'settled', reports: [{ code: 'pass-limit' }] })).outcome).toMatchObject({ ok: false, reason: 'Expected 0 reports, got 1 report.', expected: [] });
  });

  it('passes-over-limit chains one link more and expects the last placeholder with a pass-limit report at the declared limit', () => {
    const { input, outcome } = build('passes-over-limit', () => ({ output: '{{p4}}', reports: [] }));

    expect(input).toEqual({ message: '{{p1}}', payload: { p1: '{{p2}}', p2: '{{p3}}', p3: '{{p4}}', p4: 'settled' }, id: 'limits' });
    expect(outcome).toEqual({ ok: false, reason: 'Expected 1 report, got 0 reports.', expected: [{ code: 'pass-limit', origin: 'limit', id: 'limits', limit: 3 }], actual: [] });
  });

  it('holds a report that carries a limit to the declared one, and one that carries none to nothing', () => {
    expect(build('passes-over-limit', () => ({ output: '{{p4}}', reports: [{ code: 'pass-limit', origin: 'limit', id: 'limits', limit: 3 }] })).outcome).toEqual({ ok: true });
    expect(build('passes-over-limit', () => ({ output: '{{p4}}', reports: [{ code: 'pass-limit' }] })).outcome).toEqual({ ok: true });
    expect(build('passes-over-limit', () => ({ output: '{{p4}}', reports: [{ code: 'pass-limit', limit: 10 }] })).outcome).toMatchObject({ ok: false, reason: 'The limit of report 1 differs.' });
  });

  it('output-at-limit holds L characters and expects them back', () => {
    const { input, outcome } = build('output-at-limit', () => ({ output: 'xxxxx', reports: [] }));

    expect(input).toEqual({ message: '{{v}}', payload: { v: 'xxxxx' }, id: 'limits' });
    expect(outcome).toEqual({ ok: true });
  });

  it('output-over-limit holds L + 1 characters and expects the message with an output-limit report', () => {
    const { input, outcome } = build('output-over-limit', () => ({ output: '{{v}}', reports: [{ code: 'output-limit', origin: 'limit', id: 'limits', limit: 5 }] }));

    expect(input).toEqual({ message: '{{v}}', payload: { v: 'xxxxxx' }, id: 'limits' });
    expect(outcome).toEqual({ ok: true });
    expect(build('output-over-limit', () => ({ output: 'xxxxxx', reports: [] })).outcome).toEqual({ ok: false, reason: 'The output differs.', expected: '{{v}}', actual: 'xxxxxx' });
  });

  it('output-over-limit-stops registers raise from the catalogue and expects the modifier left uncalled', () => {
    const { input, outcome } = build('output-over-limit-stops', () => ({ output: '{{v}}{{w:raise}}', reports: [{ code: 'output-limit', origin: 'limit', limit: 5 }] }));
    const probe: ModifierInput = { value: 'w', options: [], props: {}, default: () => '' };

    expect(input).toMatchObject({ message: '{{v}}{{w:raise}}', payload: { v: 'xxxxxx', w: 'w' }, id: 'limits' });
    expect(raised(() => input.modifiers?.raise(probe))).toBe(raised(() => behaviours.raise(probe)));
    expect(outcome).toEqual({ ok: true });
  });

  it('output-over-limit-stops fails where the modifier past the limit was called', () => {
    const call = (modifiers: Resolution['modifiers']) => {
      try {
        modifiers?.raise({ value: 'w', options: [], props: {}, default: () => '' });
      } catch {
        // A raising modifier is contained, as section 11.3 has it.
      }
    };
    const { outcome } = build('output-over-limit-stops', ({ modifiers }) => {
      call(modifiers);

      return { output: '{{v}}{{w:raise}}', reports: [{ code: 'output-limit' }] };
    });

    expect(outcome).toEqual({ ok: false, reason: 'The modifier past the output limit was called.', expected: 'not called', actual: 'called' });
  });

  it('conversion-over-limit holds a value visiting more than C nodes and expects the default with an unserializable-value report', () => {
    const { input, outcome } = build('conversion-over-limit', () => ({ output: 'D', reports: [{ code: 'unserializable-value', origin: 'payload', id: 'limits' }] }));
    const { v } = input.payload as { v: unknown };

    expect(input).toMatchObject({ message: '{{v; default:D}}', id: 'limits' });
    expect(visits(v)).toBeGreaterThanOrEqual(8);
    expect(outcome).toEqual({ ok: true });
    expect(build('conversion-over-limit', () => ({ output: 'D', reports: [] })).outcome).toEqual({ ok: false, reason: 'Expected 1 report, got 0 reports.', expected: [{ code: 'unserializable-value', origin: 'payload', id: 'limits' }], actual: [] });
  });
});
