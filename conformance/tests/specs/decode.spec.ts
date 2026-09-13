import { describe, expect, it } from 'vitest';
import { decode } from '../../src';

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

describe('decode', () => {
  it('leaves plain data as JSON describes it, in a copy', () => {
    const data = { a: [1, 'x', null, true, { b: {} }], c: { d: 'e' } };
    const decoded = decode(data);

    expect(decoded).toEqual(data);
    expect(decoded).not.toBe(data);
  });

  it('decodes the undefined tag', () => {
    expect(decode({ $curly: 'undefined' })).toBeUndefined();
  });

  it('decodes the unserializable tag into a value no conversion can describe', () => {
    const value = decode({ $curly: 'unserializable' }) as Record<string, unknown>;

    expect(value.self).toBe(value);
    expect(() => JSON.stringify(value)).toThrow();
  });

  it('decodes the nodes tag into a tree a serialization visits at least count times', () => {
    [1, 2, 3, 4, 100, 1000, 100001].forEach((count) => {
      const tree = decode({ $curly: 'nodes', count });
      const visited = visits(tree);

      expect(visited).toBeGreaterThanOrEqual(count);
      expect(visited).toBeLessThan(2 * count + 1);
      expect(() => JSON.stringify(tree)).not.toThrow();
    });
  });

  it('builds each level of the tree as an array naming the level below twice', () => {
    const tree = decode({ $curly: 'nodes', count: 7 }) as unknown[][];

    expect(tree).toHaveLength(2);
    expect(tree[0]).toBe(tree[1]);
    expect(tree[0][0]).toBe(tree[0][1]);
    expect(tree[0][0]).toEqual([]);
  });

  it('decodes tags nested inside a payload, props and an id', () => {
    const decoded = decode({
      payload: { v: { value: { $curly: 'undefined' } }, list: [{ $curly: 'nodes', count: 3 }, 'plain'] },
      props: { number: { maximumFractionDigits: { $curly: 'undefined' } } },
      messageId: [{ $curly: 'unserializable' }],
    }) as any;

    expect('value' in decoded.payload.v).toBe(true);
    expect(decoded.payload.v.value).toBeUndefined();
    expect(visits(decoded.payload.list[0])).toBeGreaterThanOrEqual(3);
    expect(decoded.payload.list[1]).toBe('plain');
    expect('maximumFractionDigits' in decoded.props.number).toBe(true);
    expect(decoded.props.number.maximumFractionDigits).toBeUndefined();
    expect(decoded.messageId[0].self).toBe(decoded.messageId[0]);
  });

  it('keeps a __proto__ entry as an own entry', () => {
    const decoded = decode(JSON.parse('{"__proto__":{"polluted":true}}')) as Record<string, unknown>;

    expect(Object.hasOwn(decoded, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
  });

  it('rejects a tag it does not know and a nodes tag without a count', () => {
    expect(() => decode({ $curly: 'nope' })).toThrow('Unknown tag "nope".');
    expect(() => decode({ $curly: 'nodes' })).toThrow('A nodes tag needs a numeric count.');
  });
});
