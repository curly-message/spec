import type { Adapter, Behaviour, Keeping, ModifierBehaviour } from './types';

/** The catalogue of README.md, each behaviour a function of section 11's inputs. */
export const behaviours: Record<Behaviour, ModifierBehaviour> = {
  upper: ({ value }) => value.replace(/[a-z]/g, (letter) => letter.toUpperCase()),
  echo: ({ value }) => value,
  empty: () => '',
  nothing: () => undefined,
  raise: () => {
    throw new Error('The raise behaviour raised.');
  },
  default: ({ default: read }) => read(),
  options: ({ options }) => options.map(({ key, value }) => `${key}=${value}`).join(','),
  props: ({ props }) => Object.keys(props).sort().map((name) => `${name}=${JSON.stringify(props[name])}`).join(','),
  locale: ({ locale }) => locale ?? 'none',
  object: ({ value }) => ({ answer: value }),
};

// A read that answered the empty string, as a modifier that goes on with it
// answers: never empty, so a modifier that did not go on shows.
const shown = (text: string) => text || 'empty';

// What `taking` answers. A class instance is converted by the host's ordinary
// string conversion (section 4), which runs `toString`, where a plain object
// with a `toString` of its own would be serialized instead, to `{}`.
class Taking {
  readonly #read: () => string;

  constructor(read: () => string) {
    this.#read = read;
  }

  toString() {
    return this.#read();
  }
}

// The message `nest` asks a resolution of.
const NESTED = '{{x:take; default:F}}';

/**
 * The behaviours of README.md over one list of what was kept. Each call builds
 * them afresh, so what one resolution kept is read by no other but the one a
 * `nest` among them asks `adapter` for while its call is in progress, handing
 * it these same behaviours: a runner calls it once per resolution it asks for,
 * with the adapter it asks.
 */
export const keeping = (adapter: Pick<Adapter, 'resolve'>): Record<Keeping, ModifierBehaviour> => {
  const kept: (() => string)[] = [];
  const claimed = new Set<number>();

  // The most recently kept input no `take` has claimed, claimed before it is
  // read, so a read that reaches `take` again finds the one kept before it.
  const claim = () => {
    for (let index = kept.length - 1; index >= 0; index--) {
      if (!claimed.has(index)) {
        claimed.add(index);

        return kept[index];
      }
    }

    return undefined;
  };

  const take = () => {
    const read = claim();

    return read ? shown(read()) : 'none';
  };

  const record: Record<Keeping, ModifierBehaviour> = {
    keep: ({ default: read }) => {
      kept.push(read);

      return '';
    },
    'keep-default': ({ default: read }) => {
      kept.push(read);

      return read();
    },
    take,
    first: () => kept.length ? shown(kept[0]()) : 'none',
    taking: () => new Taking(take),
    nest: () => {
      const resolved: unknown = adapter.resolve({ message: NESTED, payload: { x: '' }, modifiers: record });
      const output = resolved !== null && typeof resolved === 'object' ? (resolved as { output?: unknown }).output : undefined;

      if (typeof output !== 'string') throw new Error('The resolution nest asked for answered no output.');

      return output;
    },
  };

  return record;
};
