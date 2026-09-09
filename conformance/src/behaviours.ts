import type { Behaviour, ModifierBehaviour } from './types';

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
