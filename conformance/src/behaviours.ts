import type { Behaviour, Keeping, ModifierBehaviour } from './types';

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

/**
 * The behaviours of README.md that keep an input, over one list of what they
 * kept. Each call builds them afresh, so what one resolution kept is never
 * read by another: a runner calls it once per resolution it asks for.
 */
export const keeping = (): Record<Keeping, ModifierBehaviour> => {
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

  return {
    keep: ({ default: read }) => {
      kept.push(read);

      return '';
    },
    'keep-default': ({ default: read }) => {
      kept.push(read);

      return read();
    },
    take: () => {
      const read = claim();

      return read ? shown(read()) : 'none';
    },
    first: () => kept.length ? shown(kept[0]()) : 'none',
  };
};
