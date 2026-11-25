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
  id: 'raw',
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

// The characters section 6 reads by their code: its whitespace without its
// line terminators, and its line terminators.
const BLANK = [0x09, 0x0B, 0x0C, 0x20, 0xA0, 0x1680, ...Array.from({ length: 11 }, (_, at) => 0x2000 + at), 0x202F, 0x205F, 0x3000, 0xFEFF];
const LINE = [0x0A, 0x0D, 0x2028, 0x2029];

const either = (patterns) => `(?:${patterns.join('|')})`;
const among = (codes) => `[${codes.map((code) => `\\x{${code.toString(16).toUpperCase()}}`).join('')}]`;

// A code as the digits of an escape sequence, in either case.
const digits = (code, width) =>
  Array.from(code.toString(16).padStart(width, '0'), (digit) => (digit > '9' ? `[${digit}${digit.toUpperCase()}]` : digit)).join('');
const digit = '[0-9a-fA-F]';

// The table of a carrier that writes a character as itself or as an escape
// sequence of its own: every way the carrier has to spell each character the
// format reads, since a parser reads the message the carrier decodes to. A
// placeholder whose brace is written as an escape sequence is a placeholder,
// and one that holds a line feed written as an escape sequence is not.
//
// `bare` says whether a code may stand as itself, `numeric` lists the
// sequences that take a code as digits, each a letter and a width, `named`
// the ones that name a code by a character, and `any` is one character of
// the carrier's string, however it is written.
const escaping = ({ bare, numeric, named, any }) => {
  const lead = '\\\\';
  const spelt = (codes) => {
    const own = codes.filter(bare);
    const by = (code) => [
      ...numeric.filter(([, width]) => code < 16 ** width).map(([letter, width]) => `${lead}${letter}${digits(code, width)}`),
      ...Object.entries(named).filter(([, names]) => names === code).map(([name]) => `${lead}${name}`),
    ];

    return either([...(own.length ? [among(own)] : []), ...codes.flatMap(by)]);
  };
  const line = spelt(LINE);

  return {
    char: `(?:(?!${line})${any(lead)})`,
    backslash: spelt([0x5C]),
    open: spelt([0x7B]),
    close: spelt([0x7D]),
    colon: spelt([0x3A]),
    semicolon: spelt([0x3B]),
    blank: spelt(BLANK),
    line,
  };
};

// Two escape sequences of four digits that write one character between them.
const pair = (lead) => `${lead}u[dD][89abAB]${digit}${digit}${lead}u[dD][c-fC-F]${digit}${digit}`;

/**
 * A string of a JSON document. `host` is the grammar its rules are injected
 * into and `within` the strings of that grammar they colour.
 */
export const json = {
  id: 'json',
  host: 'source.json',
  within: 'string.quoted.double.json',
  ...escaping({
    bare: (code) => code >= 0x20 && code !== 0x22 && code !== 0x5C,
    numeric: [['u', 4]],
    named: { '\\\\': 0x5C, b: 0x08, f: 0x0C, n: 0x0A, r: 0x0D, t: 0x09 },
    any: (lead) => either([pair(lead), `${lead}u${digit.repeat(4)}`, `${lead}["\\\\/bfnrt]`, '[^"\\\\\\x{00}-\\x{1F}]']),
  }),
};

// What a YAML document's scalars have in common. A scalar that runs over
// several lines is folded: a line break of the document is a space of the
// message, or nothing of it, and the tokenizer hands the rules one line of the
// document at a time. So but for a block scalar, whose lines are the
// message's, a line feed of the document is no character of the message
// here, and neither ends a part nor is consumed by a backslash. Nor are the
// blanks that end a line characters of it: YAML drops them, which `dropped`
// says, so a backslash before them consumes none.
const yaml = { host: 'source.yaml' };
const trailing = '[ \\t]++\\n';
// A quoted scalar that is a key of a mapping is no value.
const value = (scalar) => `${scalar} - entity.name.tag.yaml`;
const folded = '[\\x{2028}\\x{2029}]';

/** A double-quoted scalar of a YAML document. */
export const yamlDouble = {
  id: 'yaml-double',
  ...yaml,
  within: value('string.quoted.double.yaml'),
  dropped: trailing,
  ...escaping({
    bare: (code) => ![0x0A, 0x0D, 0x22, 0x5C].includes(code),
    numeric: [['x', 2], ['u', 4], ['U', 8]],
    named: {
      '\\\\': 0x5C, 0: 0x00, a: 0x07, b: 0x08, t: 0x09, '\\t': 0x09, n: 0x0A, v: 0x0B, f: 0x0C, r: 0x0D,
      e: 0x1B, ' ': 0x20, '"': 0x22, '/': 0x2F, N: 0x85, _: 0xA0, L: 0x2028, P: 0x2029,
    },
    any: (lead) => either([
      pair(lead),
      `${lead}x${digit.repeat(2)}`,
      `${lead}u${digit.repeat(4)}`,
      `${lead}U${digit.repeat(8)}`,
      `${lead}[0abt\\tnvfre "/\\\\N_LP]`,
      '[^"\\\\\\n\\r]',
    ]),
  }),
};

/** A single-quoted scalar of a YAML document, which writes a quote twice. */
export const yamlSingle = {
  ...raw,
  id: 'yaml-single',
  ...yaml,
  within: value('string.quoted.single.yaml'),
  char: `(?:''|[^'\\n\\r\\x{2028}\\x{2029}])`,
  line: folded,
  dropped: trailing,
};

/**
 * A plain scalar of a YAML document that is a value of a block collection.
 * A blank before `#` and a colon before a blank end the scalar wherever they
 * stand, so neither is a character of a message it holds.
 */
export const yamlPlain = {
  ...raw,
  id: 'yaml-plain',
  ...yaml,
  within: 'string.unquoted.plain.out.yaml',
  char: '(?:(?![ \\t]#|:[ \\t\\n])[^\\n\\r\\x{2028}\\x{2029}])',
  colon: '(?::(?![ \\t\\n]))',
  blank: `(?:[ \\t](?!#)|${among(BLANK.filter((code) => code !== 0x09 && code !== 0x20))})`,
  line: folded,
  // The blanks before a comment end the scalar as those that end the line do.
  dropped: '[ \\t]++[#\\n]',
};

/** A block scalar of a YAML document, whose lines are the message's. */
export const yamlBlock = {
  ...raw,
  id: 'yaml-block',
  ...yaml,
  within: 'string.unquoted.block.yaml',
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
  const { char, backslash, open, close, colon, semicolon, blank, line, dropped } = table;
  // A backslash with a character of the message behind it.
  const lead = dropped ? `${backslash}(?!${dropped})` : backslash;
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
          { match: `${lead}(?:${colon}|${semicolon}|${open}|${close}|${backslash}|${blank}|${line})`, name: scope('constant.character.escape') },
          { match: `${lead}(?!${line})${char}`, name: scope('meta.escape.inert') },
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

/**
 * The grammar that colours the messages a host grammar's strings hold, for
 * an editor to inject into `table.host`. `within` is a scope selector for the
 * strings to colour, which the carrier's own is the widest sound value of:
 * which files and which of their strings hold messages is for whoever ships
 * the grammar to say.
 */
export const injection = (table, within = table.within) => ({
  name: 'Curly Message Format',
  scopeName: `curly-message.injection.${table.id}`,
  // The rules come first where the host has an escape sequence of its own at
  // the same character, and are not injected into a placeholder they opened.
  injectionSelector: `L:(${within}) - ${scope('meta.placeholder')}`,
  ...rules(table),
});

/** Every carrier, by its id. */
export const carriers = Object.fromEntries([raw, json, yamlDouble, yamlSingle, yamlPlain, yamlBlock].map((table) => [table.id, table]));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const id = process.argv[2] ?? raw.id;
  const table = Object.hasOwn(carriers, id) ? carriers[id] : null;

  if (table) process.stdout.write(`${JSON.stringify(table.host ? injection(table) : grammar(table), null, 2)}\n`);
  else {
    process.stderr.write(`No carrier \`${id}\`: the carriers are ${Object.keys(carriers).join(', ')}.\n`);
    process.exitCode = 2;
  }
}
