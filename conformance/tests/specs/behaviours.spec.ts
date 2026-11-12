import { describe, expect, it, vi } from 'vitest';
import { behaviours, keeping, type ModifierInput } from '@curly-message/conformance';

const input = (over: Partial<ModifierInput> = {}): ModifierInput => ({ value: 'v', options: [], props: {}, default: () => 'D', ...over });

describe('behaviours', () => {
  it('upper uppercases the ASCII letters only', () => {
    expect(behaviours.upper(input({ value: 'ab1 é-z' }))).toBe('AB1 é-Z');
  });

  it('echo answers with the value unchanged', () => {
    expect(behaviours.echo(input({ value: 'As Is' }))).toBe('As Is');
  });

  it('empty answers with the empty string', () => {
    expect(behaviours.empty(input())).toBe('');
  });

  it('nothing answers with the host\'s nothing', () => {
    expect(behaviours.nothing(input())).toBeUndefined();
  });

  it('raise raises', () => {
    expect(() => behaviours.raise(input())).toThrow();
  });

  it('default reads the default through the chain, and nothing else does', () => {
    const read = vi.fn(() => 'Chain');

    expect(behaviours.default(input({ default: read }))).toBe('Chain');
    expect(read).toHaveBeenCalledTimes(1);

    (['upper', 'echo', 'empty', 'nothing', 'options', 'props', 'locale', 'object'] as const).forEach((name) => behaviours[name](input({ default: read })));
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('options lists the options in order as key=value, joined by commas', () => {
    const options = [{ key: 'a', value: 'A' }, { key: 'b', value: '' }, { key: 'c', value: 'c' }];

    expect(behaviours.options(input({ options }))).toBe('a=A,b=,c=c');
    expect(behaviours.options(input({ options: [] }))).toBe('');
  });

  it('props lists the own properties as name=json, sorted by name', () => {
    expect(behaviours.props(input({ props: { useGrouping: true, maximumFractionDigits: 1 } }))).toBe('maximumFractionDigits=1,useGrouping=true');
    expect(behaviours.props(input({ props: { unit: 'kg', ratio: null } }))).toBe('ratio=null,unit="kg"');
    expect(behaviours.props(input({ props: {} }))).toBe('');
  });

  it('locale answers with the locale, or none', () => {
    expect(behaviours.locale(input({ locale: 'en-GB' }))).toBe('en-GB');
    expect(behaviours.locale(input())).toBe('none');
  });

  it('object answers with a plain object holding the value under answer', () => {
    const answer = behaviours.object(input({ value: 'X' }));

    expect(answer).toEqual({ answer: 'X' });
    expect(Object.getPrototypeOf(answer)).toBe(Object.prototype);
    expect(JSON.stringify(answer)).toBe('{"answer":"X"}');
  });
});

describe('keeping', () => {
  it('keep keeps the default unread and answers the empty string, and keep-default keeps it and answers what it reads', () => {
    const { keep, 'keep-default': keepDefault, first } = keeping();
    const read = vi.fn(() => 'D');

    expect(keep(input({ default: read }))).toBe('');
    expect(read).not.toHaveBeenCalled();
    expect(keepDefault(input({ default: () => 'E' }))).toBe('E');
    expect(first(input())).toBe('D');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('take claims the input kept last that no take claimed, before it reads it, and answers none where nothing is left', () => {
    const { keep, take } = keeping();
    const order: string[] = [];

    keep(input({ default: () => `<${String(take(input()))}>` }));
    keep(input({ default: () => {
      order.push('second read');

      return `[${String(take(input()))}]`;
    } }));

    expect(take(input())).toBe('[<none>]');
    expect(order).toEqual(['second read']);
    expect(take(input())).toBe('none');
  });

  it('first reads the input kept first without claiming it, and answers none where nothing is kept', () => {
    const { keep, take, first } = keeping();

    expect(first(input())).toBe('none');

    keep(input({ default: () => 'A' }));

    expect(first(input())).toBe('A');
    expect(first(input())).toBe('A');
    expect(take(input())).toBe('A');
    expect(take(input())).toBe('none');
  });

  it('take and first answer empty where the read they make answers the empty string', () => {
    const { keep, take, first } = keeping();

    keep(input({ default: () => '' }));

    expect(first(input())).toBe('empty');
    expect(take(input())).toBe('empty');
  });

  it('keeps what one call kept apart from what another kept, and stays out of the catalogue of behaviours', () => {
    const one = keeping();
    const another = keeping();

    one.keep(input({ default: () => 'A' }));

    expect(another.first(input())).toBe('none');
    expect(another.keep).not.toBe(one.keep);
    expect(Object.keys(behaviours).filter((name) => Object.hasOwn(one, name))).toEqual([]);
  });
});
