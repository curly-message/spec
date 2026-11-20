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

// The message `nest` asks a resolution of, the one `keep-nest` does, and the
// one `keep-nest-ne` does, whose `ne` is the format's own: `x` holds the
// empty string, which differs from `b`, so it selects that option and
// produces it during its call.
const NESTED = '{{x:take; default:F}}';
const NESTED_TAKING = '{{x:taking; default:F}}';
const NESTED_DEFINED = '{{x:ne; b:{{x:taking; default:F}}}}';

// The message `descend` asks a resolution of while it has further to go.
export const DESCEND = '{{x:descend; default:F}}';

// The message `renest` asks a resolution of: the one it is registered in.
export const RENESTED = '[{{x:renest; default:F}}]';

/**
 * The `renest` of README.md, which asks `adapter` for a resolution of the
 * message it is registered in, with itself registered, and answers its
 * output. It raises where that resolution answered none, which is how an
 * adapter shows one its implementation refused. One level past what `bound`
 * lets stand it asks for nothing and answers `unrefused`, so an
 * implementation that refuses nothing fails the case in place of nesting
 * until its host ends it.
 */
export const renesting = (adapter: Pick<Adapter, 'resolve'>, bound: number): ModifierBehaviour => {
  let standing = 0;

  const renest: ModifierBehaviour = () => {
    if (standing > bound) return 'unrefused';

    standing += 1;

    try {
      const resolved: unknown = adapter.resolve({ message: RENESTED, payload: { x: '' }, modifiers: { renest } });
      const output = resolved !== null && typeof resolved === 'object' ? (resolved as { output?: unknown }).output : undefined;

      if (typeof output !== 'string') throw new Error('The resolution renest asked for answered no output.');

      return output;
    } finally {
      standing -= 1;
    }
  };

  return renest;
};

// Where a `descend` among the behaviours over one list leads: through `hops`
// resolutions one inside another, the innermost of them of `inner`.
type Descent = { hops: number; inner: string };

const over = (adapter: Pick<Adapter, 'resolve'>, descent?: Descent): Record<Keeping, ModifierBehaviour> => {
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

  // The output of a resolution of `message` asked of the adapter, over these
  // same behaviours.
  const nested = (message: string) => {
    const resolved: unknown = adapter.resolve({ message, payload: { x: '' }, modifiers: registered });
    const output = resolved !== null && typeof resolved === 'object' ? (resolved as { output?: unknown }).output : undefined;

    if (typeof output !== 'string') throw new Error('The resolution nest asked for answered no output.');

    return output;
  };

  let descending = 0;

  // With fewer calls in progress than the descent has hops, the next hop;
  // with as many, the message the descent leads to.
  const descend = ({ hops, inner }: Descent): ModifierBehaviour => () => {
    descending += 1;

    try {
      return nested(descending < hops ? DESCEND : inner);
    } finally {
      descending -= 1;
    }
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
    nest: () => nested(NESTED),
    'keep-nest': ({ default: read }) => {
      kept.push(read);

      return nested(NESTED_TAKING);
    },
    'keep-nest-ne': ({ default: read }) => {
      kept.push(read);

      return nested(NESTED_DEFINED);
    },
  };

  // What a resolution asked for from here is handed: the behaviours under
  // their own names, and `descend` beside them where a descent is under way.
  const registered: Record<string, ModifierBehaviour> = descent ? { ...record, descend: descend(descent) } : record;

  return registered;
};

/**
 * The behaviours of README.md over one list of what was kept. Each call builds
 * them afresh, so what one resolution kept is read by no other but the one a
 * `nest`, a `keep-nest` or a `keep-nest-ne` among them asks `adapter` for
 * while its call is in progress, handing it these same behaviours: a runner
 * calls it once per resolution it asks for, with the adapter it asks.
 */
export const keeping = (adapter: Pick<Adapter, 'resolve'>): Record<Keeping, ModifierBehaviour> => over(adapter);

/**
 * Those behaviours with the `descend` of README.md beside them, which asks
 * `adapter` for `hops` resolutions one inside another, each handed these same
 * behaviours and `descend`, the innermost of them of `inner`.
 */
export const descending = (adapter: Pick<Adapter, 'resolve'>, hops: number, inner: string) => over(adapter, { hops, inner }) as Record<Keeping | 'descend', ModifierBehaviour>;
