// The grammar colours a message as the site does, but for what it says it
// cannot.
//
// `grammar/` states the format's syntax a second time, in regular
// expressions, for an editor that colours before anything has parsed. The
// site colours with the parser, so the site is what the grammar is held to:
// every message of the conformance set and a set written to break a scanner
// is tokenised as an editor tokenises it and compared with the site's
// colouring, character for character. Where the two differ, the difference
// is one `grammar/divergences.json` names, and is exactly what it says.
//
// A message in a carrier is held to the same colouring: the message is
// written as the carrier spells it, by an encoder that knows where it put
// each character and that the carrier's own parser is held to, and the
// colours the host's grammar and the injected rules give the document are
// read back through that map.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cst } from '@curly-message/parser';
import oniguruma from 'vscode-oniguruma';
import textmate from 'vscode-textmate';
import { parseDocument } from 'yaml';
import { carriers, DEPTH, grammar, injection } from '../../grammar/grammar.mjs';
import { highlight } from '../highlight.js';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const { classes } = JSON.parse(readFileSync(join(repo, 'grammar/divergences.json'), 'utf8'));

await oniguruma.loadWASM(readFileSync(createRequire(import.meta.url).resolve('vscode-oniguruma/release/onig.wasm')));

// The tokenizer an editor runs, over a scanner that counts its searches.
let searches = 0;
const scanner = (patterns) => {
  const inner = new oniguruma.OnigScanner(patterns);

  return {
    findNextMatchSync: (...args) => {
      searches++;

      return inner.findNextMatchSync(...args);
    },
    dispose: () => inner.dispose(),
  };
};
const onigLib = Promise.resolve({ createOnigScanner: scanner, createOnigString: (text) => new oniguruma.OnigString(text) });

// The tokenizer of the grammar named `root`, among `grammars` by their scope
// names, with the grammars named in `injected` injected into it.
const tokenizerOf = (root, grammars, injected = []) =>
  new textmate.Registry({
    onigLib,
    loadGrammar: async (name) => grammars[name] ?? null,
    getInjections: (name) => (name === root ? injected : undefined),
  }).loadGrammar(root);

// A grammar an editor ships, as `tests/grammars/` holds it.
const shipped = (path) => JSON.parse(readFileSync(new URL(`./grammars/${path}`, import.meta.url), 'utf8'));

// A host's tokenizer with every grammar its carriers inject, as an extension
// would register them.
const hostOf = (root, grammars) => {
  const injected = Object.values(carriers).filter((table) => table.host === root).map((table) => injection(table));

  return tokenizerOf(root, Object.fromEntries([...grammars, ...injected].map((built) => [built.scopeName, built])), injected.map((built) => built.scopeName));
};

const YAML = ['yaml', 'yaml-1.0', 'yaml-1.1', 'yaml-1.2', 'yaml-1.3', 'yaml-embedded'].map((name) => shipped(`yaml/${name}.tmLanguage.json`));

const TOKENIZERS = {
  raw: await tokenizerOf(grammar().scopeName, { [grammar().scopeName]: grammar() }),
  json: await hostOf('source.json', [shipped('json/JSON.tmLanguage.json')]),
  yaml: await hostOf('source.yaml', YAML),
};

// The class the site draws each scope as. A character in a placeholder that
// no rule read falls to the placeholder's own scope, which the site has no
// class for, so it fails the comparison rather than passing as text.
const CLASSES = {
  'punctuation.definition.placeholder.begin.curly-message': 'ink-brace',
  'punctuation.definition.placeholder.end.curly-message': 'ink-brace',
  'punctuation.separator.curly-message': 'ink-brace',
  'variable.other.key.curly-message': 'ink-key',
  'support.function.modifier.curly-message': 'ink-modifier',
  'constant.other.option-key.curly-message': 'ink-option-key',
  'string.unquoted.option-value.curly-message': 'ink-option-value',
  'constant.character.escape.curly-message': 'ink-escape',
  'meta.escape.inert.curly-message': 'ink-escape ink-inert',
  'meta.padding.curly-message': 'ink-text',
  'meta.placeholder.curly-message': 'unread',
};

// What no rule of the format scoped is text, in a message and in a host's
// string alike.
const drawn = (scopes) => CLASSES[scopes.findLast((name) => Object.hasOwn(CLASSES, name))] ?? 'ink-text';

// A class per UTF-16 unit, as a tokenizer draws a text. An editor hands the
// tokenizer a line at a time, cut at each line feed, carriage return or pair
// of them, and draws none of the three, so they have no class here.
const draw = (tokenizer, text) => {
  const out = [];
  let stack = textmate.INITIAL;

  for (const line of text.split(/(\r\n|\r|\n)/)) {
    if (/^[\r\n]/.test(line)) {
      out.push(...Array.from(line, () => null));
      continue;
    }

    const read = tokenizer.tokenizeLine(line, stack, 0);

    stack = read.ruleStack;
    for (const token of read.tokens)
      for (let unit = token.startIndex; unit < Math.min(token.endIndex, line.length); unit++) out.push(drawn(token.scopes));
  }

  return out;
};

// The same, as the site draws it.
const bySite = (message) => {
  const out = [];
  const stack = [highlight(message, 'curly', cst)];

  while (stack.length) {
    const piece = stack.pop();

    if (Array.isArray(piece)) stack.push(...piece.toReversed());
    else if (piece.nodes) stack.push(piece.nodes);
    else for (let unit = 0; unit < piece.text.length; unit++) out.push(piece.cls);
  }

  return out;
};

/* The divergences ------------------------------------------------------------
 *
 * `grammar/divergences.json` names each class and says why it is one. Which
 * messages are in a class is a fact about a message's tree, which JSON cannot
 * state, so the predicate is here, under the class's id: it rewrites the
 * site's colouring into what the grammar is said to draw, and says whether it
 * rewrote anything. A class that comes of how a document is cut into lines
 * reads `lines`: for each UTF-16 unit of the message the line of its document
 * it is written on, or null where what writes it holds a line break. */

// How many placeholders deep a node nests, itself counted where it is one.
const depths = new WeakMap();
const depth = (node) => {
  if (!depths.has(node)) depths.set(node, Math.max(0, ...(node.nodes ?? []).map(depth)) + (node.type === 'placeholder' ? 1 : 0));

  return depths.get(node);
};

// Whether what a node holds is written on more than one line.
const broken = (node, lines) => new Set(lines.slice(node.start, node.end)).size > 1;

// A placeholder the grammar does not recognise is drawn as text, but for its
// escape sequences and for the placeholders in it that the grammar does.
const losing = (loses) => (message, colours, lines) => {
  let met = false;
  const walk = (node, lost) => {
    if (node.type === 'placeholder') lost = loses(node, lines);
    if (node.nodes) for (const child of node.nodes) walk(child, lost);
    else if (lost && node.type !== 'escape') colours.fill('ink-text', node.start, node.end);
    met ||= lost;
  };

  walk(cst(message), false);

  return met;
};

const DIVERGE = {
  nesting: losing((node) => depth(node) > DEPTH),
  'trailing-backslash': (message, colours) => {
    const met = message.endsWith('\\') && colours.at(-1) === 'ink-text';

    if (met) colours[colours.length - 1] = 'ink-escape';

    return met;
  },
  'folded-placeholder': losing(broken),
  'folded-escape': (message, colours, lines) => {
    let met = false;
    const walk = (node) => {
      if (node.nodes) node.nodes.forEach(walk);
      else if (node.type === 'escape' && broken(node, lines)) {
        colours.fill('ink-text', node.start, node.end);
        met = true;
      }
    };

    walk(cst(message));

    return met;
  },
};

// What the grammar is said to draw of a message a carrier holds, and the
// classes the message is in there.
const stated = (message, carrier, lines) => {
  const colours = bySite(message);
  const met = classes.filter(({ id, carriers: held }) => held.includes(carrier) && DIVERGE[id](message, colours, lines)).map(({ id }) => id);

  return { colours, met };
};

// Holds what a tokenizer drew of a message to what the grammar is said to
// draw of it, and says which classes the message is in. A unit the tokenizer
// was handed no character for is held to nothing.
const hold = (got, message, carrier, shown = message, lines = []) => {
  const want = stated(message, carrier, lines);
  const seen = (colours) => colours.map((colour, at) => got[at] && colour);

  assert.deepEqual(got, seen(want.colours), JSON.stringify(shown));
  // A message in a class differs from the site as the class says, and one in
  // none does not differ: `want` is the site's colouring until a class
  // rewrites it.
  if (want.met.length) assert.notDeepEqual(seen(want.colours), seen(bySite(message)), JSON.stringify(shown));

  return want.met;
};

/* The carriers ---------------------------------------------------------------
 *
 * A spelling is a message cut into pieces, each with the text a carrier
 * writes it as, so where each character of the message stands in the
 * document is known by construction and no decoder is written. The carrier's
 * own parser is then asked what the document holds, which is the message or
 * the spelling is wrong. */

// A run of characters each written as itself is a string, and a piece
// written otherwise a pair.
const pieces = (spelling) => spelling.flatMap((piece) => (typeof piece === 'string' ? piece.split('').map((unit) => [unit, unit]) : [piece]));

const breaks = (text) => text.split(/\r\n|\r|\n/).length - 1;

// The text a spelling writes, and for each UTF-16 unit of its message the
// units of that text it was written as and the line they stand on.
const written = (spelling, before) => {
  let source = before;
  let line = breaks(before);
  const map = [];
  const lines = [];

  for (const [piece, text] of pieces(spelling)) {
    for (let unit = 0; unit < piece.length; unit++) {
      map.push([source.length, source.length + text.length]);
      lines.push(breaks(text) ? null : line);
    }
    source += text;
    line += breaks(text);
  }

  return { message: pieces(spelling).map(([piece]) => piece).join(''), source, map, lines };
};

// A class per UTF-16 unit of a message, as a tokenizer draws the document
// that holds it. One character of the message is one colour, however many
// characters spell it, and a character written with a line break, which an
// editor draws no part of, has none.
const through = (tokenizer, document, map) => {
  const colours = draw(tokenizer, document);

  return map.map(([from, to]) => {
    const held = new Set(colours.slice(from, to));

    if (held.has(null)) return null;
    assert.deepEqual(held.size, 1, `${JSON.stringify(document)} at ${from}`);

    return colours[from];
  });
};

const escaped = (unit, upper) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, '0')[upper ? 'toUpperCase' : 'toLowerCase']()}`;

// A fixed sequence of choices, so a run that fails fails again.
const chooser = () => {
  let seed = 12345;

  return (below) => (seed = (seed * 1103515245 + 12345) % 2147483648) % below;
};

// A message as a JSON string may write it: the shortest way, every character
// as an escape sequence, and each character one of the ways JSON has for it.
const JSON_SHORT = { '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r', '"': '\\"', '\\': '\\\\', '/': '\\/' };
const JSON_SPELLINGS = {
  shortest: (message) => Array.from(message, (char) => [char, JSON.stringify(char).slice(1, -1)]),
  escaped: (message) => Array.from({ length: message.length }, (_, at) => [message[at], escaped(message[at], at % 2)]),
  mixed: (message, next) =>
    Array.from({ length: message.length }, (_, at) => {
      const unit = message[at];
      const ways = [escaped(unit, false), escaped(unit, true)];

      if (JSON_SHORT[unit]) ways.push(JSON_SHORT[unit]);
      if (unit >= ' ' && unit !== '"' && unit !== '\\' && !(unit >= '\uD800' && unit <= '\uDFFF')) ways.push(unit, unit);

      return [unit, ways[next(ways.length)]];
    }),
};

const inJson = (spelling) => {
  const { message, source, map } = written(spelling, '{"k": "');
  const document = `${source}"}`;

  assert.equal(JSON.parse(document).k, message, document);

  return { message, document, map };
};

/* A scalar of a YAML document, each of the four ways YAML writes one. An
 * encoder refuses the message it does not write that way, which is null
 * here, and what it does not refuse the YAML parser has to read back. */

// What a YAML document holds as itself (YAML 1.2.2, production 1).
const PRINTABLE = /^[\t\n\r\x20-\x7E\x85\xA0-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]*$/u;

// The escape sequences of a double-quoted scalar that name a character.
const YAML_NAMED = {
  '\0': ['\\0'], '\x07': ['\\a'], '\b': ['\\b'], '\t': ['\\t', '\\\t'], '\n': ['\\n'], '\v': ['\\v'], '\f': ['\\f'], '\r': ['\\r'], '\x1B': ['\\e'],
  ' ': ['\\ '], '"': ['\\"'], '/': ['\\/'], '\\': ['\\\\'], '\x85': ['\\N'], '\xA0': ['\\_'], '\u2028': ['\\L'], '\u2029': ['\\P'],
};

// The ones that give its code, which only the four-digit one can pair into a
// character outside the Basic Multilingual Plane.
const numbered = (unit, upper) => {
  const code = unit.charCodeAt(0);
  const digits = (width) => code.toString(16).padStart(width, '0')[upper ? 'toUpperCase' : 'toLowerCase']();

  return [...(code < 0x100 ? [`\\x${digits(2)}`] : []), `\\u${digits(4)}`, ...(code >= 0xD800 && code <= 0xDFFF ? [] : [`\\U${digits(8)}`])];
};

// Whether a double-quoted scalar may hold a character as itself.
const bare = (char) => PRINTABLE.test(char) && !'"\\\n\r'.includes(char);

const quoted = (spelling) => ({ before: 'k: "', spelling, after: '"' });

// The blanks a line may end on, which YAML drops from every scalar but a
// block one.
const ENDS = ['', ' ', '\t', '  ', ' \t'];

// A message written over several lines, as a scalar folds them: a space
// between two characters that are no blanks as a line break, and a run of
// line feeds as one line break more. What follows a line break is not `#`,
// which would open a comment, and what precedes one is not `:`, which would
// end a key.
const folds = (message, next, { spell = (char) => char, feeds = true, ends = ENDS } = {}) => {
  const units = Array.from(message);
  const stands = (char) => char !== undefined && !/[ \t\n]/.test(char);

  return units.map((unit, at) => {
    const end = `${ends[next(ends.length)]}\n`;

    if (unit === ' ' && stands(units[at - 1]) && units[at - 1] !== ':' && stands(units[at + 1]) && units[at + 1] !== '#' && !next(3)) return [unit, `${end}  `];
    if (unit === '\n' && feeds) return [unit, units[at - 1] === '\n' ? '\n  ' : `${end}\n  `];

    return [unit, spell(unit)];
  });
};

// Whether a message's line feeds stand where `folds` can write them: in runs
// between two characters that are no blanks.
const foldable = (message) => PRINTABLE.test(message) && !/\r|^\n|\n$|[ \t:]\n|\n[ \t#]/.test(message);

// What a plain scalar cannot be: empty, or read as other than the text of a
// scalar, for an indicator or a blank where one may not stand, the end of the
// scalar before its end, a value that is no string.
const UNPLAIN = /^$|^[ \t\-?:,[\]{}#&*!|>'"%@`]|[ \t]$|[ \t]#|:[ \t\n]|:$|^(?:~|null|true|false|[-+.\d].*)$/i;

const YAML_SPELLINGS = {
  // The shortest way, every character by its code, and each character one of
  // the ways the scalar has for it. Nothing is refused: what YAML does not
  // print has a code.
  'yaml-double': [
    (message) => quoted(Array.from(message, (char) => [char, bare(char) ? char : (YAML_NAMED[char]?.[0] ?? numbered(char, true)[0])])),
    (message) =>
      quoted(Array.from({ length: message.length }, (_, at) => {
        const ways = numbered(message[at], at % 2);

        return [message[at], ways[at % ways.length]];
      })),
    (message, next) =>
      quoted(Array.from({ length: message.length }, (_, at) => {
        const unit = message[at];
        const ways = [...numbered(unit, false), ...numbered(unit, true), ...(YAML_NAMED[unit] ?? [])];

        if (bare(unit)) ways.push(unit, unit, unit);

        return [unit, ways[next(ways.length)]];
      })),
    (message, next) => quoted(folds(message, next, { spell: (char) => (bare(char) ? char : (YAML_NAMED[char]?.[0] ?? numbered(char, true)[0])), feeds: false })),
  ],
  // No escape sequence, so nothing YAML does not print, and a line break only
  // where a fold leaves one. On one line, then over several.
  'yaml-single': [
    (message) =>
      PRINTABLE.test(message) && !/[\n\r]/.test(message) ? { before: 'k: \'', spelling: Array.from(message, (char) => [char, char === '\'' ? '\'\'' : char]), after: '\'' } : null,
    (message, next) => (foldable(message) ? { before: 'k: \'', spelling: folds(message, next, { spell: (char) => (char === '\'' ? '\'\'' : char) }), after: '\'' } : null),
  ],
  // The same, and nothing a plain scalar cannot be. The second ends on what
  // may follow a plain scalar on its line.
  'yaml-plain': [
    (message) => (PRINTABLE.test(message) && !/[\n\r]/.test(message) && !UNPLAIN.test(message) ? { before: 'k: ', spelling: [message] } : null),
    (message, next) =>
      foldable(message) && !UNPLAIN.test(message) ? { before: 'k: ', spelling: folds(message, next), after: [...ENDS, '  # note', '\t#'][next(ENDS.length + 2)] } : null,
  ],
  // A literal one, whose lines are the message's behind an indentation, with
  // the line feeds the message ends on kept; the same with the indentation
  // left for YAML to read off the first line that is not empty; and a folded
  // one, which keeps the blanks its lines end on. A carriage return would end
  // a line too, the parser reads a last line of blanks alone as empty, and a
  // folded one keeps the line break before a line that opens on a blank.
  'yaml-block': [
    (message) =>
      PRINTABLE.test(message) && !/\r|(?:^|\n)[ \t]+$/.test(message)
        ? { before: `k: |2${message.endsWith('\n') ? '+' : '-'}\n  `, spelling: Array.from(message, (char) => [char, char === '\n' ? '\n  ' : char]) }
        : null,
    (message) =>
      PRINTABLE.test(message) && !/\r|(?:^|\n)[ \t]+$|^\n*[ \t]/.test(message)
        ? { before: `k: |${message.endsWith('\n') ? '+' : '-'}\n  `, spelling: Array.from(message, (char) => [char, char === '\n' ? '\n  ' : char]) }
        : null,
    (message, next) => (foldable(message) && !/^[ \t]/.test(message) ? { before: 'k: >2-\n  ', spelling: folds(message, next, { ends: [''] }) } : null),
  ],
};

// A plain scalar cannot open on a brace, so a message is held there after a
// word.
const WORDED = { 'yaml-plain': (message) => `Say ${message}` };

// The least share of the conformance set's messages each way of writing has
// to hold, so that an encoder that refuses too much fails.
const SHARE = { 'yaml-double': 1, 'yaml-single': 0.95, 'yaml-plain': 0.9, 'yaml-block': 0.95 };

const inYaml = ({ before, spelling, after = '' }) => {
  const { message, source, map, lines } = written(spelling, before);
  const document = `${source}${after}`;
  const read = parseDocument(document);

  assert.deepEqual([...read.errors, ...read.warnings], [], JSON.stringify(document));
  assert.equal(read.toJS().k, message, JSON.stringify(document));

  return { message, document, map, lines };
};

/* The messages ------------------------------------------------------------- */

const fixtures = () => {
  const found = new Set();
  const read = (value) => {
    if (Array.isArray(value)) value.forEach(read);
    else if (value && typeof value === 'object')
      for (const [key, held] of Object.entries(value)) {
        if (key === 'message' && typeof held === 'string') found.add(held);
        else read(held);
      }
  };
  const dir = join(repo, 'conformance/fixtures');

  for (const file of readdirSync(dir)) read(JSON.parse(readFileSync(join(dir, file), 'utf8')));

  return [...found];
};

const nested = (levels, inner = 'x') => `${'{{a; k:'.repeat(levels)}${inner}${'}}'.repeat(levels)}`;

// Written to break a scanner: every reading sections 6 and 7 settle by a
// rule a regular expression is apt to get wrong.
const WRITTEN = [
  nested(DEPTH - 1),
  nested(DEPTH),
  nested(DEPTH + 1),
  nested(DEPTH + 4),
  nested(DEPTH, '{{u'),
  nested(3, '{{u'),
  nested(DEPTH + 1, '\\}'),
  `{{a; k:\\:${nested(DEPTH)}; l: ${nested(2)} }}`,
  `{{a; k:${nested(DEPTH + 1)}`,
  '{{a}}}',
  '{{v\\}}}',
  '{{a}b}}',
  '{{\\{v}}',
  '\\{{v}}',
  '{\\{v}}',
  '{{v}\\}',
  '{{v\\}}',
  '{{a{{b}}',
  '{{{{a}}',
  '{{v; a:{{n}}',
  '{{v; a:{{n}}; default:D}}',
  '{{a;b:x}};c}}',
  '{{a:m:n;b:c:d}}',
  '{{a:{{b}}}}',
  '{{a;{{b}}:c}}',
  '{{ a : m ; k : v ; }}',
  '{{a;b: {{c}} }}',
  '{{a;b: x  y }}',
  '{{a  b : m  n ; k  l }}',
  '{{a;b:  }}',
  '{{  }}',
  '{{}}',
  '{{:}}',
  '{{;}}',
  '{{;:}}',
  '{{a\\',
  'a\\',
  '\\',
  'a\\\\',
  '{{a\\\nb}}',
  '{{a\nb}}',
  '{{a\rb}}',
  '{{a\u2028b}}',
  '{{a\u2029b}}',
  'x\\\ny',
  'x\\\ny\\',
  'x\\\ry',
  'x\\\u2028y',
  '{{a}}\r{{b}}',
  '{{a}}\n{{b}}',
  '{{a\\\u2028}}',
  '{{a;b:\\{{c}}}}',
  '{{a;b:{\\{c}}}}',
  '{{a;b:c\\}}}',
  '{{a;b:c}\\}}}',
  '{{a;b:\\;}}',
  '{{a\\:b:c\\;d;e\\:f:g}}',
  '{{\u{1F600}\\\u{1F600}}}',
  '\\\u{1F600}x',
  '{{a\u00A0}}',
  '{{a \\ }}',
  '{{a\\  }}',
  '{{a;b:\\d \\  }}',
  '{{a;b:{{c;d:{{e}}}}',
  '{{a;b:{{c;d:{{e}}}}}}',
  '{{a;b:}}}}',
  '{{a;b:}}}',
  '{{a}}}}',
  '}}{{a}}{{',
  '{{{a}}}',
  '{{{{a}}}}',
  '{{a;b:{{{c}}}}}',
];

// The same shapes at random, from the characters the format reads. The
// sequence is fixed, so a run that fails fails again.
const random = (count, alphabet) => {
  let seed = 12345;
  const next = (below) => (seed = (seed * 1103515245 + 12345) % 2147483648) % below;

  return Array.from({ length: count }, () => Array.from({ length: 1 + next(24) }, () => alphabet[next(alphabet.length)]).join(''));
};

const READ = ['{{', '}}', '{', '}', ':', ';', '\\', ' ', 'a', 'd', '{{', '}}', ';', ':'];
const LINES = [...READ, '\n', '\r', '\u2028', '\u2029', '\u00A0'];

test('states every class of divergence it tests, and tests every class stated', () => {
  assert.deepEqual(classes.map(({ id }) => id).sort(), Object.keys(DIVERGE).sort());
  // The depth is stated in prose there, and is the builder's to decide.
  assert.match(classes.find(({ id }) => id === 'nesting').where, new RegExp(`\\b${DEPTH} deep\\b`));
});

test('draws every message as the site does, but for the divergences stated', () => {
  const held = fixtures();

  // A set read wrong would hold nothing to compare.
  assert.ok(held.length > 400, `${held.length} messages read from the conformance set`);

  const met = Object.fromEntries(classes.filter(({ carriers: among }) => among.includes('raw')).map(({ id }) => [id, 0]));

  for (const message of [...held, ...WRITTEN, ...random(5000, READ), ...random(5000, LINES)])
    for (const id of hold(draw(TOKENIZERS.raw, message), message, 'raw')) met[id]++;

  for (const [id, count] of Object.entries(met)) assert.ok(count > 0, `no message met the class ${id}`);
});

// What a carrier's escape sequences can do to a message: write a character
// the format reads, so that what is no placeholder as written is one as read,
// and the other way about.
const JSON_WRITTEN = [
  [['{', '\\u007b'], '{name}}'],
  ['{', ['{', '\\u007B'], 'name}}'],
  [['{{', '\\u007b\\u007b'], 'name', ['}}', '\\u007d\\u007D']],
  ['{{name}', ['}', '\\u007d']],
  ['{{a', [':', '\\u003a'], 'b}}'],
  ['{{a', [';', '\\u003b'], 'b', [':', '\\u003A'], 'c}}'],
  [['\\', '\\u005c'], '{{a}}'],
  [['\\', '\\\\'], '{{a}}'],
  [['\\\\', '\\u005C\\\\'], '{{a}}'],
  ['{{a', ['\\', '\\u005c'], '}}}'],
  ['{{a', ['\\', '\\\\'], [':', '\\u003a'], 'b}}'],
  ['{{a', ['\n', '\\n'], 'b}}'],
  ['{{a', ['\n', '\\u000a'], 'b}}'],
  ['{{a', ['\r', '\\r'], 'b}}'],
  ['{{a', ['\u2028', '\\u2028'], 'b}}'],
  ['{{a\u2029b}}'],
  ['{{a}}', ['\n', '\\n'], '{{b}}'],
  ['{{a;b:{{c}}', ['\n', '\\n'], '}}'],
  ['x', ['\\', '\\\\'], ['\n', '\\n'], 'y'],
  ['x', ['\\', '\\\\'], ['\n', '\\u000A'], 'y'],
  ['{{a', ['\t', '\\t'], 'b', ['\t', '\\u0009'], '}}'],
  ['{{', [' ', '\\u0020'], 'a', ['\u00A0', '\\u00a0'], ['\f', '\\f'], '}}'],
  ['{{a;b:', ['\u3000', '\\u3000'], 'c', ['\uFEFF', '\\ufeff'], '}}'],
  [['\\', '\\\\'], [' ', '\\u0020'], 'x'],
  [['\\', '\\\\'], ['\t', '\\t'], 'x'],
  ['{{a', ['"', '\\"'], 'b}}'],
  ['{{a', ['\\', '\\\\'], ['"', '\\"'], 'b}}'],
  ['{{a;b:', ['"', '\\"'], 'q', ['"', '\\"'], '}}'],
  ['{{a/b', ['/', '\\/'], 'c}}'],
  ['{{', ['\u{1F600}', '\\ud83d\\ude00'], '}}'],
  [['\\', '\\\\'], ['\u{1F600}', '\\uD83D\\uDE00'], 'x'],
  [['\\', '\\\\'], '\u{1F600}x'],
  ['{{a', ['\uD83D', '\\ud83d'], '}}'],
  ['x', ['\\', '\\\\']],
  ['{{a', ['\\', '\\u005c']],
  ['{{a', ['\b', '\\b'], '}}'],
];

test('draws every message a JSON string holds as the site does, however it is spelled', () => {
  const next = chooser();
  const met = { nesting: 0 };
  const spellings = [
    ...JSON_WRITTEN,
    ...[...fixtures(), ...WRITTEN, ...random(2000, READ), ...random(2000, LINES)].flatMap((message) =>
      Object.values(JSON_SPELLINGS).map((spell) => spell(message, next)),
    ),
  ];

  for (const spelling of spellings) {
    const { message, document, map } = inJson(spelling);

    for (const id of hold(through(TOKENIZERS.json, document, map), message, 'json', document)) met[id]++;
  }

  assert.ok(met.nesting > 0, 'no message met the class nesting');
});

test('draws nothing in a JSON string that holds no value', () => {
  const document = '{"{{a}} \\\\: b": 1, "c": ["{{d}}"]}';
  const colours = draw(TOKENIZERS.json, document);

  assert.deepEqual(new Set(colours.slice(0, document.indexOf('": 1'))), new Set(['ink-text']));
  assert.deepEqual(colours.slice(document.indexOf('{{d'), document.indexOf('"]')), ['ink-brace', 'ink-brace', 'ink-key', 'ink-brace', 'ink-brace']);
});

// A line break of the document that is a space of the message, as every
// scalar but a literal one folds it.
const FOLD = [' ', '\n  '];

// The same behind blanks that end the line, which YAML drops from every
// scalar but a block one.
const DROPPED = [' ', ' \t\n  '];

// Documents written by hand. What only a scalar written over several lines
// can do to a message: a placeholder or an escape sequence that a fold runs
// through, and beside each the one a fold leaves whole. And what a scalar's
// own way of writing a character does to one the format reads.
const YAML_WRITTEN = {
  'yaml-double': [
    [['{', '\\x7b'], ['{', '\\u007B'], 'a', ['}', '\\U0000007d'], '}'],
    ['{{a', ['\n', '\\n'], 'b}}'],
    ['{{a', ['\u2028', '\\L'], 'b}}'],
    ['{{a', ['\t', '\\\t'], [':', '\\x3a'], 'm', ['\u00A0', '\\_'], '}}'],
    [['\\', '\\\\'], ['\u{1F600}', '\\ud83d\\ude00'], 'x'],
    ['{{a', ['"', '\\"'], '}}'],
    ['x', ['\\', '\\x5C']],
    ['{{a;', FOLD, 'b:c}}'],
    ['{{a;', ['', '\\\n  '], 'b:c}}'],
    ['{{a;', ['', '\\\n  '], ['\n', '\\n'], 'b:c}}'],
    [['{', '\\x7b'], '{a; b:{{c}}', FOLD, '}}'],
    ['{{a; b:{{c;', FOLD, 'd:e}} }}'],
    ['x', ['\\', '\\\\'], FOLD, 'y'],
    ['x', ['\\', '\\\\'], ['', '\\\n  '], ':y'],
    ['{{a', ['\\', '\\x5c'], FOLD, 'b}}'],
    ['{{a}} and', FOLD, '{{b}}', ['\\', '\\\\'], ':'],
    ['x', ['\\', '\\\\'], DROPPED, 'y'],
    ['{{a', ['\\', '\\\\'], DROPPED, 'b}}'],
    ['{{a}} ', ['\\', '\\\\'], DROPPED, '{{b}}'],
    ['{{a}}', ['\n', '\n\n  '], '{{b}}'],
  ].map(quoted),
  'yaml-single': [
    ['{{a;b:it', ['\'', '\'\''], 's}}'],
    ['{{', ['\'', '\'\''], '}} x\\', ['\'', '\'\''], 'y'],
    ['{{a;', FOLD, 'b:c}}'],
    ['{{a;', FOLD, 'b:it', ['\'', '\'\''], 's}}'],
    ['{{a; b:{{c}}', FOLD, '}}'],
    ['{{a; b:{{c;', FOLD, 'd:e}} }}'],
    ['x\\', FOLD, 'y'],
    ['{{a\\', FOLD, 'b}}'],
    ['{{a}} and', FOLD, '{{b}}\\:'],
    ['x\\', DROPPED, 'y'],
    ['{{a\\', DROPPED, 'b}}'],
    ['{{a}} \\', DROPPED, '{{b}}'],
    ['{{a}}', ['\n', '\n\n  '], '{{b}}'],
  ].map((spelling) => ({ before: 'k: \'', spelling, after: '\'' })),
  'yaml-plain': [
    ['Hi {{a;', FOLD, 'b:c}} there'],
    ['Hi {{a; b:{{c}}', FOLD, '}}'],
    ['Hi {{a; b:{{c;', FOLD, 'd:e}} }}'],
    ['x\\', FOLD, 'y'],
    ['Hi {{a\\', FOLD, 'b}}'],
    ['Hi {{a}} and', FOLD, '{{b}}\\:x'],
    ['x\\', DROPPED, 'y'],
    ['Hi {{a\\', DROPPED, 'b}}'],
    ['Hi {{a}} \\', DROPPED, '{{b}}'],
    ['Hi {{a}}', ['\n', '\n\n  '], '{{b}}'],
  ].map((spelling) => ({ before: 'k: ', spelling })).concat(
    // A backslash that ends the scalar, before blanks that are none of it.
    [' ', '\t', ' \t ', '  # note', '\t#', ' \nl: y'].flatMap((after) => [{ before: 'k: ', spelling: ['x\\'], after }, { before: 'k: ', spelling: ['Hi {{name}} \\'], after }]),
  ),
  // A folded block scalar is a block scalar to the host's grammar, so the
  // rules of a literal one read it.
  'yaml-block': [
    ['{{a;', FOLD, 'b:c}}'],
    ['{{a; b:{{c}}', FOLD, '}}'],
    ['{{a; b:{{c;', FOLD, 'd:e}} }}'],
    ['x\\', FOLD, 'y'],
    ['{{a\\', FOLD, 'b}}'],
    ['{{a}} and', FOLD, '{{b}}\\:'],
    ['{{a}}', ['\n', '\n\n  '], '{{b}}'],
    ['x\\ \t', FOLD, 'y'],
    ['{{a}} \\  ', ['\n', '\n\n  '], '{{b}}'],
    ['x\\'],
  ].map((spelling) => ({ before: 'k: >2-\n  ', spelling })),
};

test('draws every message a YAML scalar holds as the site does, but for the divergences stated', () => {
  const next = chooser();
  const held = fixtures();
  const messages = [...held, ...WRITTEN, ...random(2000, READ), ...random(2000, LINES)];

  for (const [carrier, spellers] of Object.entries(YAML_SPELLINGS)) {
    const met = Object.fromEntries(classes.filter(({ carriers: among }) => among.includes(carrier)).map(({ id }) => [id, 0]));
    const worded = WORDED[carrier] ?? ((message) => message);
    const spelled = (message) => spellers.map((spell) => spell(message, next)).filter(Boolean);
    const share = held.filter((message) => spelled(worded(message)).length).length / held.length;

    assert.ok(share >= SHARE[carrier], `${carrier} holds ${share} of the conformance set's messages`);

    for (const put of [...YAML_WRITTEN[carrier], ...[...messages, ...messages.map(worded)].flatMap(spelled)]) {
      const { message, document, map, lines } = inYaml(put);

      for (const id of hold(through(TOKENIZERS.yaml, document, map), message, carrier, document, lines)) met[id]++;
    }

    for (const [id, count] of Object.entries(met)) assert.ok(count > 0, `no message met the class ${id} in ${carrier}`);
  }
});

test('draws nothing in a YAML document but in a scalar that is a value', () => {
  // A key, plain or quoted; a plain scalar of a flow collection, which a
  // brace ends; a comment; and a plain scalar that ends, at a blank before
  // `#` or at a colon before a blank, inside what would be a placeholder.
  const none = [
    'a {{b}}: 1',
    '"{{a}} \\\\: b": 1',
    '\'{{a}} \\: b\': 1',
    'k: [x {{a}} y]',
    '# {{a}} \\:',
    'k: Hi {{v; a:x #y}} z',
    'k: Hi {{v; a:x\t#y}} z',
    'k: Hi {{v; a: A}} z',
    'k: Hi {{v:\tm}} z',
    'k: x\\ #{{a}}',
    'k: Hi {{v; a:x\\ #y}}',
  ];

  for (const document of none) assert.deepEqual(new Set(draw(TOKENIZERS.yaml, document)), new Set(['ink-text']), document);

  const document = 'k: Hi {{a}} # {{b}}\n"l": "{{c}}"\n\'m\': \'{{d}}\'\nn: [x, "{{e}}"]';
  const colours = draw(TOKENIZERS.yaml, document);
  const placeholder = ['ink-brace', 'ink-brace', 'ink-key', 'ink-brace', 'ink-brace'];

  for (const key of 'acde') assert.deepEqual(colours.slice(document.indexOf(`{{${key}`), document.indexOf(`{{${key}`) + 5), placeholder, key);
  assert.equal(colours.filter((colour) => colour === 'ink-key').length, 4);
});

/* Cost ------------------------------------------------------------------------
 *
 * An editor tokenises on every keystroke, and the text is whatever a
 * catalogue holds. Neither library counts the steps of a search, so the cost
 * is held two ways: by how many searches a line takes, and by what the
 * expressions are made of. */

// Lines a scanner reads at its worst: one that fails late, one that restarts
// often, one that nests, one that is nearly a placeholder throughout.
const SHAPES = {
  'an opener never closed': (n) => `{{a;b:${'x'.repeat(n)}`,
  'escapes before an opener never closed': (n) => `${'\\d'.repeat(n / 4)}{{a;b:${'x'.repeat(n / 2)}`,
  'placeholders before an opener never closed': (n) => `${'{{x}}'.repeat(n / 10)}{{a;b:${'x'.repeat(n / 2)}`,
  'openers alone': (n) => '{{a;b:'.repeat(n / 6),
  'a nest deeper than is recognised': (n) => nested(Math.floor(n / 9)),
  'nests as deep as is recognised': (n) => nested(DEPTH).repeat(Math.floor(n / (9 * DEPTH))),
  'opening braces alone': (n) => '{{'.repeat(n / 2),
  'an opener never closed holding placeholders': (n) => `{{a;b:${'{{x}}'.repeat(n / 5)}`,
  'openers never closed before placeholders': (n) => `${'{{a;b:'.repeat(DEPTH - 1)}${'{{x}}'.repeat(n / 5)}`,
  'braces that close nothing': (n) => `{{a;b:${'}{'.repeat(n / 2)}`,
  'escaped braces in an opener never closed': (n) => `{{a;b:${'\\}'.repeat(n / 2)}`,
  'a key of escapes': (n) => `{{${'\\:'.repeat(n / 2)}}}`,
  'a key of blanks': (n) => `{{a${' '.repeat(n)}b}}`,
  'a value of blanks': (n) => `{{a;b:c${' '.repeat(n)}d}}`,
  'a key of words': (n) => `{{${'ab '.repeat(n / 3)}}}`,
  'options alone': (n) => `{{a${';b:c'.repeat(n / 4)}}}`,
  'options that hold nothing': (n) => `{{a${';:'.repeat(n / 2)}}}`,
  'text alone': (n) => 'x'.repeat(n),
};

// A document as each carrier writes it, the shape its message, the tokenizer
// that reads it and the sizes it is read at. In a YAML scalar a shape stands
// behind a word and before a stop, since a plain one cannot open on a brace
// or end on a colon. The YAML grammar itself, with nothing injected, reads a
// long run of blanks in a time that grows with its square, so its documents
// are shorter.
const SIZES = [2500, 5000, 10000, 20000];
const DOCUMENTS = {
  raw: { read: TOKENIZERS.raw, sizes: SIZES, write: (message) => message },
  json: { read: TOKENIZERS.json, sizes: SIZES, write: (message) => inJson(JSON_SPELLINGS.shortest(message)).document },
  ...Object.fromEntries(Object.entries(YAML_SPELLINGS).map(([carrier, [spell]]) => [
    carrier,
    { read: TOKENIZERS.yaml, sizes: [1250, 2500], write: (message) => inYaml(spell(`Say ${message}.`)).document },
  ])),
};

// The YAML grammar with nothing injected, whose searches are its own cost.
const YAML_ALONE = await tokenizerOf('source.yaml', Object.fromEntries(YAML.map((built) => [built.scopeName, built])));

const searched = (tokenizer, document) => {
  let stack = textmate.INITIAL;

  searches = 0;
  for (const line of document.split('\n')) stack = tokenizer.tokenizeLine(line, stack, 0).ruleStack;

  return searches;
};

// A search ends the line or matches a rule. A rule that matches takes a
// character at least, but for the end of an option or of a value, which takes
// none and follows a beginning that took one; the JSON grammar's one rule
// that may take none ends a value the same way. So a line is searched twice
// for each character at most, the line feed the tokenizer ends it with
// included, and once more to find nothing left.
//
// The YAML grammar's rules are not held to that, being its own. Inside a
// placeholder only the format's rules are searched, as in a message; outside
// one each step searches the host's rules and those of the one carrier whose
// scalar it is in, so the rules add a search to each the host makes. A line
// of a YAML document is therefore held to the same bound beside twice what
// the host takes of the document with nothing injected.
test('searches a line no more than twice for each character', () => {
  for (const [carrier, { read, sizes, write }] of Object.entries(DOCUMENTS))
    for (const [name, shape] of Object.entries(SHAPES))
      for (const size of sizes) {
        const document = write(shape(size));
        const lines = document.split('\n');
        const most = lines.reduce((sum, line) => sum + 2 * (line.length + 1) + 1, 0) + (read === TOKENIZERS.yaml ? 2 * searched(YAML_ALONE, document) : 0);
        const took = searched(read, document);

        assert.ok(took <= most, `${carrier}, ${name}, ${document.length} characters: ${took} searches`);
      }
});

// Every expression the grammar holds.
const expressions = (value) => {
  if (Array.isArray(value)) return value.flatMap(expressions);
  if (!value || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, held]) => (['match', 'begin', 'end'].includes(key) ? [held] : expressions(held)));
};

// An expression cut into what stands at its top level: a group or a class
// with all it holds, an escape, or one character.
const atoms = (source) => {
  const found = [];
  let at = 0;

  while (at < source.length) {
    const from = at;

    if (source[at] === '\\') at = source.startsWith('x{', at + 1) ? source.indexOf('}', at) + 1 : at + 2;
    else if (source[at] === '[') {
      for (at++; source[at] !== ']'; at++) if (source[at] === '\\') at++;
      at++;
    } else if (source[at] === '(') {
      for (let open = 0; at < source.length; at++) {
        if (source[at] === '\\') at++;
        else if (source[at] === '[') while (source[at] !== ']') at += source[at] === '\\' ? 2 : 1;
        else if (source[at] === '(') open++;
        else if (source[at] === ')' && !--open) break;
      }
      at++;
    } else at++;
    found.push(source.slice(from, at));
  }

  return found;
};

// What a group holds, without the prefix that says what kind it is.
const inside = (group) => group.slice(group.match(/^\((?:\?(?:<?[=!]|:))?/)[0].length, -1);

test('builds expressions that give nothing back', () => {
  const built = Object.values(carriers).flatMap((table) => expressions(table.host ? injection(table) : grammar(table)));

  assert.ok(built.length > 10 * Object.keys(carriers).length, `${built.length} expressions read from the grammars`);

  // Every repetition is possessive, at every level, so a search that fails
  // has read what it read once.
  const possessive = (source) => {
    const cut = atoms(source);

    for (const [at, atom] of cut.entries()) {
      if ('*+?'.includes(atom) && !'*+?'.includes(cut[at - 1])) assert.equal(cut[at + 1], '+', `${atom} is not possessive in ${source}`);
      // An interval has no possessive form in every syntax Oniguruma reads,
      // and a brace the format reads is written escaped, so no brace stands
      // bare.
      assert.notEqual(atom, '{', `an interval in ${source}`);
      if (atom.startsWith('(')) possessive(inside(atom));
    }
  };

  built.forEach(possessive);

  // A search tries an expression from every character on. One that opens
  // with a repetition and may still fail after it reads the run again from
  // each character the run holds, unless the run alone is its last resort.
  for (const source of built) {
    const branches = atoms(source).reduce((all, atom) => (atom === '|' ? [...all, []] : [...all.slice(0, -1), [...all.at(-1), atom]]), [[]]);
    const [first, ...rest] = branches[0];
    const run = first?.startsWith('(') && !first.startsWith('(?') ? inside(first) : first;
    const repeats = rest[0] === '+' || rest[0] === '*' ? first + rest.slice(0, 2).join('') : /[*+]\+$/.test(run ?? '') ? run : null;

    if (!repeats || branches[0].join('') === first + (first === run ? rest.slice(0, 2).join('') : '')) continue;
    assert.equal(branches.at(-1).join('').replace(/^\((.*)\)$/, '$1'), repeats, `${source} may fail after the run it opens with`);
  }
});

test('writes the grammar it builds when it is run', () => {
  const run = (...carrier) => JSON.parse(execFileSync(process.execPath, [join(repo, 'grammar/grammar.mjs'), ...carrier], { encoding: 'utf8' }));

  assert.deepEqual(run(), grammar());
  for (const table of Object.values(carriers)) assert.deepEqual(run(table.id), table.host ? injection(table) : grammar(table));

  for (const id of ['yaml', 'toString']) {
    const { status, stdout, stderr } = spawnSync(process.execPath, [join(repo, 'grammar/grammar.mjs'), id], { encoding: 'utf8' });

    assert.deepEqual([status, stdout], [2, ''], id);
    assert.equal(stderr, `No carrier \`${id}\`: the carriers are ${Object.keys(carriers).join(', ')}.\n`);
  }
});
