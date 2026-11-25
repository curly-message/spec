// A TextMate grammar for the Curly Message Format, built rather than written.
//
// The format's grammar (SPEC.md, section 6) is stated over the characters of
// a message, and a message reaches an editor inside a carrier that spells
// those characters its own way. So the rules are written once, over a table
// that says how a carrier spells each character the format reads, and a
// carrier is a table.

import { fileURLToPath } from 'node:url';

const scope = (name) => `${name}.curly-message`;

// How many placeholders deep a placeholder is recognised. A regular
// expression cannot follow section 12's nesting to any depth, so the proof
// that a placeholder is complete is unrolled this far: the depth every
// implementation resolves (SPEC.md, section 13).
export const DEPTH = 8;

/**
 * The carrier that spells every character as itself: a file, or a line,
 * whose whole text is a message. Each entry is a pattern that stands as one
 * atom wherever it is written.
 */
export const raw = {
  // One character of the message that is no line terminator.
  char: '[^\\n\\r\\x{2028}\\x{2029}]',
  backslash: '\\\\',
  open: '\\{',
  close: '\\}',
  colon: ':',
  semicolon: ';',
  // The whitespace class of section 6 without its line terminators, which is
  // what a placeholder can hold of it.
  blank: '[\\t\\x{0B}\\x{0C} \\x{A0}\\x{1680}\\x{2000}-\\x{200A}\\x{202F}\\x{205F}\\x{3000}\\x{FEFF}]',
  line: '[\\n\\r\\x{2028}\\x{2029}]',
};

// Every repetition is possessive: each boundary of a placeholder is forced by
// a character class (section 6, note 7), so nothing a repetition took is ever
// given back, and a search that fails does so in one pass.
const many = (unit) => `(?:${unit})*+`;
const some = (unit) => `(?:${unit})++`;

// A complete placeholder, as section 6 derives one, to DEPTH levels.
const complete = (table) => {
  const { char, backslash, open, close, colon, semicolon, line } = table;
  const escape = `${backslash}(?!${line})${char}`;
  const ends = `${open}${open}|${close}${close}|${semicolon}|${backslash}|${line}`;
  const name = many(`${escape}|(?!${ends}|${colon})${char}`);
  const unit = `${escape}|(?!${ends})${char}`;
  let placeholder = null;

  for (let level = 0; level < DEPTH; level++) {
    const value = many(placeholder ? `${unit}|${placeholder}` : unit);

    placeholder = `${open}${open}${name}(?:${colon}${many(unit)})?+(?:${semicolon}${name}(?:${colon}${value})?+)*+${close}${close}`;
  }

  return placeholder;
};

const rules = (table) => {
  const { char, backslash, open, close, colon, semicolon, blank, line } = table;
  const closing = `${close}${close}`;
  const afterName = `${colon}|${semicolon}|${closing}`;
  const afterValue = `${semicolon}|${closing}`;
  const padding = { name: scope('meta.padding') };
  const separator = { 1: { name: scope('punctuation.separator') }, 2: padding };

  // Blank before what ends a part is padding, and any other blank belongs to
  // the part. Both are one rule, so the run is taken where it starts whichever
  // it is, and a search never tries it again from each blank it holds.
  const blanks = (ends, part) => ({
    match: `(${some(blank)})(?=${ends})|(${some(blank)})`,
    captures: { 1: padding, ...(part ? { 2: { name: part } } : {}) },
  });

  // A name is drawn by rules of its own; a part that holds more than text is
  // a range the text takes its colour from.
  const name = (part) => [
    blanks(afterName, part),
    { include: '#escape' },
    { match: some(`(?!${afterName}|${backslash}|${blank})${char}`), name: part },
  ];
  const range = (part, holds) => ({
    begin: `(${colon})(${many(blank)})`,
    beginCaptures: separator,
    end: `(?=${afterValue})`,
    contentName: part,
    patterns: [blanks(afterValue), { include: '#escape' }, ...holds],
  });

  const body = [
    {
      begin: `(${semicolon})(${many(blank)})`,
      beginCaptures: separator,
      end: `(?=${afterValue})`,
      patterns: [range(scope('string.unquoted.option-value'), [{ include: '#nested' }]), ...name(scope('constant.other.option-key'))],
    },
    range(scope('support.function.modifier'), []),
    ...name(scope('variable.other.key')),
  ];

  const placeholder = (proof) => ({
    begin: `${proof}(${open}${open})(${many(blank)})`,
    beginCaptures: { 1: { name: scope('punctuation.definition.placeholder.begin') }, 2: padding },
    end: closing,
    endCaptures: { 0: { name: scope('punctuation.definition.placeholder.end') } },
    name: scope('meta.placeholder'),
    patterns: body,
  });

  return {
    patterns: [{ include: '#escape' }, { include: '#placeholder' }],
    repository: {
      escape: {
        patterns: [
          { match: `${backslash}(?:${colon}|${semicolon}|${open}|${close}|${backslash}|${blank}|${line})`, name: scope('constant.character.escape') },
          { match: `${backslash}(?!${line})${char}`, name: scope('meta.escape.inert') },
        ],
      },
      placeholder: placeholder(`(?=${complete(table)})`),
      // A placeholder in an option value is one the proof already read, so it
      // opens on its braces alone.
      nested: placeholder(''),
    },
  };
};

/** The grammar of a message written in the carrier `table` describes. */
export const grammar = (table = raw) => ({
  name: 'Curly Message Format',
  scopeName: scope('text'),
  ...rules(table),
});

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(`${JSON.stringify(grammar(), null, 2)}\n`);
