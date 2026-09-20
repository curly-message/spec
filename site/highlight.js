// The site's colouring, drawn once for both the pages and the playground.
//
// A Curly message is coloured by the format's own parser: the tree
// `CST.md` specifies is walked and every leaf drawn by what the parse made
// of it, so the colouring on a page cannot disagree with the colouring in
// the playground, and neither can disagree with resolution. The other
// languages the site writes — JSON, TypeScript, shell and the grammar's
// EBNF — are scanned rather than parsed, because a fence is a few lines
// long and a reader can check every one of them by eye.
//
// Nothing here touches a document or a parser: a call answers with pieces,
// and the caller draws them. `build.mjs` writes them as HTML and the
// playground builds them as nodes, which is the whole of the difference
// between a page and the one page that runs.

// A piece is text under a class, or a class holding more pieces. A class of
// `null` is text the colouring has nothing to say about.
const ink = (cls, text) => ({ cls, text });

// Runs an ordered set of rules over a string. The first rule that matches
// where the scan stands takes the text; where none does, the character is
// text and the scan moves one along. Every pattern is sticky, so a rule
// matches at the scan's position or not at all.
const scan = (source, rules) => {
  const out = [];
  let plain = '';
  let at = 0;
  const flush = () => {
    if (plain) out.push(ink(null, plain));
    plain = '';
  };
  while (at < source.length) {
    let taken = null;
    for (const [cls, pattern] of rules) {
      pattern.lastIndex = at;
      const found = pattern.exec(source);
      if (!found || !found[0]) continue;
      taken = ink(typeof cls === 'function' ? cls(found, source, at) : cls, found[0]);
      break;
    }
    if (!taken) {
      plain += source[at++];
      continue;
    }
    flush();
    out.push(taken);
    at += taken.text.length;
  }
  flush();
  return out;
};

// Applies a rule set line by line, which is how a rule that has to know it
// stands at the start of a line is spelled without a pattern that can see
// behind itself.
const byLine = (source, line) =>
  source.split('\n').flatMap((text, n) => (n ? [ink(null, '\n'), ...line(text)] : line(text)));

/* The format ---------------------------------------------------------------
 *
 * The parts a placeholder is made of. Each holds text and escapes rather
 * than characters of its own, so a leaf under one is coloured by the part
 * it lies in rather than by being text. */
const ROLES = new Set(['key', 'modifier', 'option-key', 'option-value']);

// Every leaf is drawn by its own type, except text, which has no colour of
// its own and takes the part it lies in. Whatever neither names — the
// spacing a placeholder is allowed inside it, an empty message — is text.
const LEAVES = {
  open: 'ink-brace',
  close: 'ink-brace',
  separator: 'ink-brace',
  key: 'ink-key',
  modifier: 'ink-modifier',
  'option-key': 'ink-option-key',
  'option-value': 'ink-option-value',
  text: 'ink-text',
};

// One piece per leaf of the tree. The leaves tile the message and spell it
// back, so the walk carries no position of its own: each leaf states the
// slice it covers, and the pieces laid end to end are the message.
const walk = (message, node, role) => {
  if (node.nodes?.length) {
    const under = ROLES.has(node.type) ? node.type : role;
    const inside = node.nodes.flatMap((child) => walk(message, child, under));
    return node.type === 'placeholder' ? [{ cls: 'ink-ph', nodes: inside }] : inside;
  }
  const text = message.slice(node.start, node.end);
  if (!text) return [];
  // An escape is drawn as itself whatever it stands in, and the one that
  // cancels nothing is drawn apart from the one that does: they leave
  // different text behind, so colouring them alike would misstate one.
  const cls =
    node.type === 'escape'
      ? `ink-escape${node.cancels ? '' : ' ink-inert'}`
      : (LEAVES[node.type === 'text' ? role : node.type] ?? 'ink-text');
  return [ink(cls, text)];
};

/** Colours a whole message. */
export const curly = (message, cst) => walk(message, cst(message), 'text');

/* An example ---------------------------------------------------------------
 *
 * What a worked example writes beside its message: the arrow, the string an
 * outcome is quoted as, and the aside a line closes with. */
const NOTE = [
  ['tok-note', /\([^)]*\)[ \t]*$/y],
  ['tok-arrow', /->/y],
  ['tok-string', /"[^"\n]*"|'[^'\n]*'/y],
];

// Where a line stops being the format and starts being prose about it: a run
// of two or more spaces that the parse left as plain text, which is how a
// column is spelled here. Spacing inside a placeholder is spacing the format
// allows and never a column, and an indent opens no column either.
//
// A line is read one of three ways. It is all prose where the parse found no
// construct in it at all, and where a column opens before the first
// construct and none opens after the last — because then whatever braces
// the line holds are quoted outcome rather than a message. It is cut where a
// column opens after the last construct. Otherwise it is all message.
const PROSE = -2;
const MESSAGE = -1;

const aside = (line, tree) => {
  const nodes = tree.nodes ?? [];
  if (nodes.every((node) => node.type === 'text')) return PROSE;
  let seen = false;
  let before = MESSAGE;
  for (const node of nodes) {
    if (node.type === 'text') {
      for (const run of line.slice(node.start, node.end).matchAll(/ {2,}/g)) {
        const at = node.start + run.index;
        if (at === 0) continue;
        if (seen) return at;
        if (before === MESSAGE) before = at;
      }
      continue;
    }
    // An escape stands wherever it is written and opens nothing, so only a
    // placeholder settles which side of it a column falls on.
    if (node.type === 'placeholder') seen = true;
    else if (before !== MESSAGE) return before;
  }
  if (!seen) return before;
  return before === MESSAGE ? MESSAGE : PROSE;
};

/** Colours a block of worked examples: a message a line, and what it makes. */
export const curlyExample = (source, cst) =>
  byLine(source, (line) => {
    const at = aside(line, cst(line));
    if (at === PROSE) return scan(line, NOTE);
    if (at === MESSAGE) return curly(line, cst);
    // The cut falls in text the parse found no construct in, so the head
    // reads the same alone as it did in the whole line.
    return [...curly(line.slice(0, at), cst), ...scan(line.slice(at), NOTE)];
  });

/* The other languages ------------------------------------------------------ */

// A name a JSON object gives a member is not the same thing as a string it
// holds, so the two are told apart by what follows.
const MEMBER = (found, source, at) =>
  /^[ \t\n\r]*:/.test(source.slice(at + found[0].length)) ? 'tok-name' : 'tok-string';

// An unterminated string is still coloured as one: the playground scans
// what is being typed, and a field mid-word is the ordinary case there.
const JSON_RULES = [
  [MEMBER, /"(?:\\.|[^"\\\n])*"?/y],
  ['tok-number', /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y],
  ['tok-word', /\b(?:true|false|null)\b/y],
  ['tok-punct', /[{}[\],:]/y],
];

const TS_RULES = [
  ['tok-note', /\/\/[^\n]*/y],
  ['tok-note', /\/\*[\s\S]*?\*\//y],
  ['tok-string', /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/y],
  [
    'tok-word',
    /\b(?:as|async|await|catch|class|const|default|else|export|extends|for|from|function|if|implements|import|in|interface|let|new|of|return|throw|try|type|var)\b/y,
  ],
  ['tok-word', /\b(?:true|false|null|undefined)\b/y],
  ['tok-number', /\b\d[\d_]*(?:\.\d+)?\b/y],
  ['tok-name', /[A-Za-z_$][\w$]*(?=[ \t]*[(:])/y],
  ['tok-punct', /=>|[{}[\]();,:.=|&?]/y],
];

const EBNF_RULES = [
  ['tok-note', /\(\*[\s\S]*?\*\)/y],
  // A special sequence states in words what no rule spells out.
  ['tok-note', /\?[^?]*\?/y],
  ['tok-string', /"[^"\n]*"/y],
  ['tok-name', /[A-Za-z][\w-]*(?=[ \t]*=)/y],
  ['tok-punct', /[=|,;{}[\]()]/y],
];

// What a shell line runs is its first word; the rest is read as it comes. A
// flag stands on its own, so a hyphen inside a word is part of the word.
const SHELL_RULES = [
  ['tok-note', /#[^\n]*/y],
  ['tok-string', /'[^'\n]*'|"(?:\\.|[^"\\\n])*"/y],
  ['tok-word', /(?<![\w@./-])--?[A-Za-z][\w-]*/y],
];

const shell = (source) =>
  byLine(source, (line) => {
    const run = /^([ \t]*)([\w./@-]+)/.exec(line);
    if (!run) return scan(line, SHELL_RULES);
    return [
      ...(run[1] ? [ink(null, run[1])] : []),
      ink('tok-name', run[2]),
      ...scan(line.slice(run[0].length), SHELL_RULES),
    ];
  });

/**
 * Colours a fence. `cst` is the parser's, and is needed only where the
 * fence is the format's own. A language nothing here reads answers with
 * `null`, and the caller writes the fence plain.
 */
export const highlight = (source, language, cst) => {
  switch (language) {
    case 'curly':
      return curly(source, cst);
    case 'curly-example':
      return curlyExample(source, cst);
    case 'json':
      return scan(source, JSON_RULES);
    case 'ts':
      return scan(source, TS_RULES);
    case 'ebnf':
      return scan(source, EBNF_RULES);
    case 'bash':
      return shell(source);
    default:
      return null;
  }
};
