import { describe, expect, it } from 'vitest';
import { decode } from '@curly-message/conformance';

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

  it('decodes the nodes tag into a value a serialization visits exactly count times', () => {
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 100, 1000, 100000, 100001].forEach((count) => {
      const value = decode({ $curly: 'nodes', count });

      expect(visits(value)).toBe(count);
      expect(() => JSON.stringify(value)).not.toThrow();
    });
  });

  it('builds the value as a tree of arrays each naming the level below twice, padded with zeros', () => {
    const value = decode({ $curly: 'nodes', count: 11 }) as unknown[][][];

    expect(value).toHaveLength(4);
    expect(value[0]).toHaveLength(2);
    expect(value[0][0]).toBe(value[0][1]);
    expect(value[0][0][0]).toBe(value[0][0][1]);
    expect(value[0][0][0]).toEqual([]);
    expect(value.slice(1)).toEqual([0, 0, 0]);
  });

  it('decodes tags nested inside a payload, props and an id', () => {
    const decoded = decode({
      payload: { v: { value: { $curly: 'undefined' } }, list: [{ $curly: 'nodes', count: 3 }, 'plain'] },
      props: { number: { maximumFractionDigits: { $curly: 'undefined' } } },
      messageId: [{ $curly: 'unserializable' }],
    }) as any;

    expect('value' in decoded.payload.v).toBe(true);
    expect(decoded.payload.v.value).toBeUndefined();
    expect(visits(decoded.payload.list[0])).toBe(3);
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
