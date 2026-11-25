# Grammar

A [TextMate grammar](https://macromates.com/manual/en/language_grammars) for
the Curly Message Format: the colours an editor gives a message before
anything has parsed it.

It states the syntax of [`SPEC.md`](../SPEC.md), sections 6 and 7, a second
time, in regular expressions, because that is the only form an editor's
tokenizer reads. It is an approximation with stated edges (see *Divergences*)
and nothing normative: where it and the specification disagree, the grammar is
wrong. A tool that has a parser at hand colours from the tree of
[`CST.md`](../CST.md) instead, as the site does, and never from this.

## Building

The grammar is built, not written, and the JSON it builds is not committed:

```sh
node grammar/grammar.mjs > curly-message.tmLanguage.json
node grammar/grammar.mjs json > curly-message.injection.json.tmLanguage.json
node grammar/grammar.mjs yaml-plain > curly-message.injection.yaml-plain.tmLanguage.json
```

The argument is a carrier's id, and each carrier below has one. With none it
builds `raw`; with a word that is no carrier's it writes the ids to standard
error and exits 2.

`grammar.mjs` needs nothing but Node, and exports what it prints:

```js
import { carriers, grammar, injection } from './grammar.mjs';

grammar(); // { name, scopeName: 'text.curly-message', patterns, repository }
injection(carriers.json); // { name, scopeName, injectionSelector, patterns, repository }
```

## Carriers

A message reaches an editor inside a carrier: a file of its own, a string of a
JSON document, or a scalar of a YAML one. A carrier spells the characters of the message its own
way, and a parser reads the message the carrier decodes to, so the rules are
written once, over a table that says how a carrier spells each character the
format reads: a brace, a colon, a semicolon, a backslash, a blank, a line
terminator, and any character at all. A carrier is a table:

| Carrier | Scope name | What it is |
| --- | --- | --- |
| `raw` | `text.curly-message` | a file, or a line, whose whole text is a message, every character spelled as itself |
| `json` | `curly-message.injection.json` | a string of a JSON document, each character as itself or as any escape sequence JSON has for it |
| `yaml-double` | `curly-message.injection.yaml-double` | a double-quoted scalar of a YAML document, each character as itself or as any escape sequence YAML has for it: `\x7b`, `\u007b`, `\U0000007b`, `\t`, `\_`, `\L` |
| `yaml-single` | `curly-message.injection.yaml-single` | a single-quoted scalar, every character as itself but a quote, written twice |
| `yaml-plain` | `curly-message.injection.yaml-plain` | a plain scalar, every character as itself, which ends at a blank before `#` and at a colon before a blank |
| `yaml-block` | `curly-message.injection.yaml-block` | a block scalar, literal (`\|`) or folded (`>`), every character as itself |

So `"\u007b{name}}"` is drawn as the placeholder it decodes to, and
`"{{a\nb}}"`, which decodes to braces around a line feed, as the text it is.
The colon of `"{{a\\:b}}"` is drawn as cancelled, because the two
backslashes are one in the message.

`grammar(table)` builds a grammar that stands alone, which is what `raw` is
for. `injection(table)` builds one an editor injects into another grammar:
`table.host` names that grammar, which the injection has to be registered
for (VS Code's `injectTo`), and the injection's selector says which of the
host's scopes its rules run in. The rules take priority over the host's own
there (`L:`), since both have a rule for a backslash, and are kept out of a
placeholder they opened themselves.

`injection(table, within)` takes that selector's scopes as a parameter. The
default, `table.within`, is the widest sound one: the string values of a JSON
document, and not its property names. A document's grammar cannot say which
documents hold messages, nor which of their strings do, so the default colours
every `{{...}}` in every string value of every document the host grammar
colours. Which files those are, and whether a narrower selector suits them,
is for whoever ships the grammar in an editor to decide.

### YAML

A YAML document writes a scalar four ways, the host's grammar gives each a
scope of its own, and each spells a message differently, so each is a carrier
and all four are registered for `source.yaml`. Their default selectors take
the scalars that are values: a quoted scalar that is not a key, and a plain
scalar of a block collection (`string.unquoted.plain.out.yaml`). A plain
scalar of a flow collection is left alone, since a brace there is a
mapping's. A block scalar that is a key (`? |`) has the scope of one that is
a value in the host's grammar, so it is drawn as a value is.

In a plain scalar the rules read what YAML reads. `k: Hi {{v; a: A}}` is no
scalar that holds a placeholder but an error, a colon before a blank being a
key's, and `k: Hi {{v; a:x #y}}` ends at the blank before `#`; neither is
drawn. A plain scalar cannot open on a brace either, so `k: {{name}}` is a
flow mapping to YAML and to the host's grammar, and is not drawn.

A scalar written over several lines is folded, but for a literal block one: a
line break of the document is a space of the message, a line feed of it, or
nothing. A tokenizer reads a line of the document at a time, so what a fold
runs through is not recognised (see *Divergences*); a message on one line,
which a catalogue's mostly are, is not concerned.

The blanks a line of the document ends on are no characters of the message,
but in a block scalar: YAML drops them, and with them those before a comment
that ends a plain scalar. So the backslash of `k: x\` before such blanks
consumes nothing and is drawn as text, as the backslash that ends the message
it is.

**`{{` is not the format's alone in YAML.** A GitHub Actions workflow writes
`${{ github.ref }}`, a Helm chart `{{ .Values.name }}`, an Ansible playbook
`"{{ item }}"`, and nothing in a document says which of them it is. Injected
into every YAML document, the rules draw those as placeholders. The grammar
does not guess: whoever ships it decides which documents it is injected into,
by a language of their own for catalogues, by the files the injection is
registered for, or by a narrower `within`.

## Scopes

Every scope ends in `.curly-message`, left out below. The names are **not yet
frozen**: until the grammar is released to an editor, a theme that selects one
may have to follow a rename.

| Scope | What it covers |
| --- | --- |
| `text` | the message |
| `meta.placeholder` | a placeholder, from `{{` to `}}` |
| `punctuation.definition.placeholder.begin`, `punctuation.definition.placeholder.end` | `{{` and `}}` |
| `punctuation.separator` | the `:` before a modifier or an option's value, and the `;` before an option |
| `variable.other.key` | the key |
| `support.function.modifier` | the modifier |
| `constant.other.option-key` | an option's key |
| `string.unquoted.option-value` | an option's value, the placeholders it holds included |
| `constant.character.escape` | a backslash and the character it cancels: `:`, `;`, `{`, `}`, a backslash or whitespace |
| `meta.escape.inert` | a backslash and a character it has nothing to cancel in, both of which stay in the text |
| `meta.padding` | the whitespace section 8 trims: around a part, inside the braces |

An inert escape sequence is not under `constant.character.escape`, so a theme
does not draw as cancelled a character the format leaves as written. Padding
has a scope of its own, inside the part it pads or beside it, so that it can
be told from the whitespace a part keeps.

Outside a placeholder only escape sequences are scoped; the rest of the
message is `text` alone. An injected grammar has no `text`: what it does not
scope keeps the scopes the host gave the string.

## Divergences

[`divergences.json`](./divergences.json) names each class of message the
grammar draws otherwise than a parser reads it, with where it happens, what
the grammar draws there and why, and which carriers it happens in:

- **`nesting`.** A placeholder is recognised only once it is known to be
  complete, and a regular expression cannot follow nesting to any depth, so
  that proof is unrolled 8 placeholders deep, the depth every implementation
  resolves (`SPEC.md`, section 13). A placeholder that holds placeholders more
  than 8 deep, itself counted, is the one lost: what it writes itself is drawn
  as text, its escape sequences excepted, and every placeholder in it that
  nests 8 deep or less is drawn as the placeholder it is. Every carrier has
  it.
- **`trailing-backslash`.** A tokenizer reads a line at a time and ends each
  with a line feed, so a backslash that ends the message, which is text, is
  drawn as the escape sequence a backslash before a line feed is. The raw
  carrier and a YAML block scalar have it, whose lines are the message's. A
  JSON string writes a line feed as an escape sequence and ends on a quote,
  and in the other YAML scalars a line break of the document is no line feed
  of the message, so their rules consume none.
- **`folded-placeholder`.** In a YAML scalar written over several lines, a
  placeholder that a line break of the document stands in is one the proof
  cannot read to its end, since it reads one line: `'{{name;` and
  `one:x}}'` on two lines are the placeholder `{{name; one:x}}`, drawn as
  text. Its escape sequences and the placeholders in it that stand on one
  line are drawn as what they are. Every YAML carrier has it, a block scalar
  only where it is folded (`>`).
- **`folded-escape`.** In the same scalars, a backslash that ends a line of
  the document, or stands before nothing but the blanks that end it, which
  YAML drops, consumes the space the line break folds into, or the character
  that opens the next line behind a line break a double-quoted scalar escapes.
  No rule sees both, so the backslash is drawn as text. The double-quoted,
  single-quoted and plain scalars have it, and a block scalar does not: there
  a backslash before a line break is drawn as an escape sequence, which it is
  whether the break is a line feed or folds into a space.

The test holds the list both ways: a message in a class is drawn exactly as
the class says, and a message in none is drawn as the site draws it. Which
messages a class holds is a fact about a message's tree, which JSON cannot
state, so each class's predicate is in the test, under the class's `id`, and
the test fails where the two lists of ids differ.

## Long lines

A tokenizer gives up on a line it finds too long: VS Code tokenises none past
20,000 characters by default (`editor.maxTokenizationLineLength`), and draws
such a line uncoloured, which is every message of a catalogue written as one
line. No rule here changes that. Up to that length the grammar reads a line
in one pass: every repetition in it is possessive, and the test holds each
expression to that, and holds the searches a line takes to twice its
characters, beside those the host's grammar makes of a YAML document, which
are its own.

## Tests

The grammar has no package of its own. Its test is
[`site/tests/grammar.test.mjs`](../site/tests/grammar.test.mjs), run by
`npm test` in [`site/`](../site), which holds the colouring it is compared
with: every message of the conformance set, and a set written to break a
scanner, tokenised by `vscode-textmate` over `vscode-oniguruma` a line at a
time, as an editor cuts lines, and compared with the site's colouring one
UTF-16 unit at a time.

A carrier is tested on the same messages, each written into a document the
ways the carrier can spell it, by an encoder that records where it put each
character and whose output the carrier's own parser has to read back as the
message. The document is tokenised by the grammar VS Code ships for it
([`site/tests/grammars/`](../site/tests/grammars)) with the injection
registered, and the colours are read back through the encoder's map and
compared with the site's colouring of the message.

`JSON.parse` reads a JSON document back, and the `yaml` package a YAML one.
A YAML encoder refuses the message it does not write: one its scalar cannot
hold — a character YAML does not print in a single-quoted one, a plain one
that would open on a brace — and, where it folds a single-quoted or a plain
scalar, some the scalar can hold, such as one that ends in a line feed. The
test fails where one refuses more of the conformance set's messages than the
share it states. Each scalar is written on one line and over
several, a block one literal and folded, and the others with blanks that end
their lines. What a fold does to a placeholder and to an escape sequence is
pinned besides by documents written by hand.
