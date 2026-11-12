import type { ModifierBehaviour, Report, Resolution, Resolved } from '@curly-message/conformance';

// A resolver of the messages the cases of kept reads write, as section 13
// reads them: what a counted read is, the bound it meets, the refusal of a
// read whose own production is in progress, and the record a read leaves.
// It reads placeholders of a key, a host-defined modifier and options, and
// nothing else the format holds; each mutant is one way to read section 13
// wrongly, for a case to be held to telling it apart.

export type Mutant =
  | 'bound-short'
  | 'bound-long'
  | 'unbounded'
  | 'refusal-recorded'
  | 'refusal-raises'
  | 'refusal-aborts'
  | 'in-progress-read'
  | 'in-progress-raises'
  | 'own-reads-counted';

type Part = string | Placeholder;

type Placeholder = { key: string; modifier?: string; options: { key: string; value: Part[] }[]; fallback: Part[] };

// The end of the placeholder opening at `from`, past its closing braces.
const close = (text: string, from: number) => {
  let depth = 0;

  for (let at = from; at < text.length;) {
    if (text.startsWith('{{', at)) {
      depth += 1;
      at += 2;
    } else if (text.startsWith('}}', at)) {
      depth -= 1;
      at += 2;

      if (depth === 0) return at;
    } else {
      at += 1;
    }
  }

  throw new Error(`An unclosed placeholder in ${text}.`);
};

// The text split at each `;` no nested placeholder holds.
const segments = (text: string) => {
  const found: string[] = [];
  let start = 0;

  for (let at = 0; at < text.length;) {
    if (text.startsWith('{{', at)) {
      at = close(text, at);
    } else {
      if (text[at] === ';') {
        found.push(text.slice(start, at));
        start = at + 1;
      }

      at += 1;
    }
  }

  return [...found, text.slice(start)];
};

const parse = (text: string): Part[] => {
  const parts: Part[] = [];
  let start = 0;

  for (let at = text.indexOf('{{'); at !== -1; at = text.indexOf('{{', start)) {
    const end = close(text, at);
    const [selector, ...rest] = segments(text.slice(at + 2, end - 2));
    const [key, modifier] = selector.trim().split(':');
    const written = rest.filter((segment) => segment.trim()).map((segment) => {
      const colon = segment.indexOf(':');

      return { key: segment.slice(0, colon).trim(), value: parse(segment.slice(colon + 1)) };
    });

    parts.push(text.slice(start, at), {
      key,
      modifier,
      options: written.filter((option) => option.key !== 'default'),
      fallback: written.find((option) => option.key === 'default')?.value ?? [],
    });
    start = end;
  }

  return [...parts, text.slice(start)];
};

// What a refusal that unwinds the modifier that made the read throws: that
// modifier's placeholder resolves to the empty string, and nothing reports.
const ABORTED = new Error('A refused read.');

type Reading = {
  /** The bound on counted reads the implementation keeps. */
  bound: number;
  mutant?: Mutant;
  /** Called where a modifier's input is read after the call it was handed to returned. */
  late?: () => void;
};

export const resolver = ({ bound, mutant, late }: Reading) => ({ message, payload, id, modifiers = {} }: Resolution): Resolved => {
  const reports: Report[] = [];
  const values = (payload ?? {}) as Record<string, unknown>;
  // The placeholders whose modifiers are in their calls, the innermost last.
  const current: Placeholder[] = [];
  const limit = mutant === 'unbounded' ? Infinity : bound + (mutant === 'bound-short' ? -1 : mutant === 'bound-long' ? 1 : 0);
  let counted = 0;

  const render = (parts: Part[]): string => parts.map((part) => typeof part === 'string' ? part : resolve(part)).join('');

  // A read of a placeholder's default: the walk's where that placeholder's
  // modifier is current and the default is not being produced, and counted
  // otherwise.
  const reader = (placeholder: Placeholder, call: { returned: boolean }) => {
    const production: { text?: string; producing: number } = { producing: 0 };

    return () => {
      if (call.returned) late?.();

      if (production.text !== undefined) return production.text;

      if (production.producing && mutant !== 'in-progress-read') {
        if (mutant === 'in-progress-raises') throw new Error('A read in progress.');

        if (mutant === 'refusal-aborts') throw ABORTED;

        return '';
      }

      const counts = current.at(-1) !== placeholder || production.producing > 0 || mutant === 'own-reads-counted';

      if (counts && counted + 1 > limit) {
        if (mutant === 'refusal-raises') throw new Error('A read past the bound.');

        if (mutant === 'refusal-aborts') throw ABORTED;

        if (mutant === 'refusal-recorded') production.text = '';

        return '';
      }

      counted += counts ? 1 : 0;
      production.producing += 1;

      const text = render(placeholder.fallback);

      production.producing -= 1;
      counted -= counts ? 1 : 0;
      production.text = text;

      return text;
    };
  };

  const resolve = (placeholder: Placeholder): string => {
    const { key, modifier, options, fallback } = placeholder;

    if (modifier !== undefined && !Object.hasOwn(modifiers, modifier)) {
      reports.push({ code: 'unknown-modifier', origin: 'message', id });

      return render(fallback);
    }

    if (!Object.hasOwn(values, key)) return render(fallback);

    if (modifier === undefined) return String(values[key]);

    const call = { returned: false };
    const behaviour: ModifierBehaviour = modifiers[modifier];
    let answer: unknown;
    let failed = false;

    current.push(placeholder);

    try {
      answer = behaviour({ value: String(values[key]), options: options.map((option) => ({ key: option.key, value: render(option.value) })), props: {}, default: reader(placeholder, call) });
    } catch (error) {
      if (error === ABORTED) answer = '';
      else failed = true;
    } finally {
      current.pop();
      call.returned = true;
    }

    if (!failed) return String(answer);

    reports.push({ code: 'failed-modifier', origin: 'message', id });

    return render(fallback);
  };

  return { output: render(parse(String(message))), reports };
};
