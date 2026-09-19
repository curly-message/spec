# @curly-message/conformance

The conformance set of the [Curly Message Format](../SPEC.md): fixtures that
an implementation in any language is measured against, and a JavaScript runner
that drives one through the adapter of section 14.3.
[RUNNER.md](./RUNNER.md) states what a runner in another language is held to.

A fixture is a resolution written out — the inputs section 4 lists, and the
output and the reports they must produce. The set is derived from the
specification, and each case names the section it pins, so a failure points at
the sentence the implementation disagrees with.

```json
{
  "id": "fallback/payload-outranks-inline",
  "section": "10",
  "description": "The payload's own default takes precedence over the inline one.",
  "message": "Hello, {{name; default:Guest;}}!",
  "payload": { "default": "Friend" },
  "expected": { "output": "Hello, Friend!" }
}
```

A second kind of file pins the concrete syntax tree of [CST.md](../CST.md)
rather than a resolution: the same message, and the nodes an implementation
that offers a tree describes it with. An implementation conforms without
offering one, and those cases are then left out.

## Status

**Stable**, on npm as `@curly-message/conformance`. The set lives in the
specification's repository because its fixtures are artifacts of the format,
not of any one implementation, and every file states the format version it
targets: this set targets `curly-message-3`. The set carries a version line of
its own, because a case may be corrected without the format changing.

## The fixture files

`fixtures/*.json` groups the cases by the section of the specification they
pin, one file per group, and `index.json` lists the files with the level or the
kind, and the section, each covers. `schema/fixture.schema.json` is the JSON
Schema every file validates against, so a runner in another language checks the
set before it reads it.

Those files are the set. Nothing in them is JavaScript, so an implementation in
another language needs nothing else from this package: every release carries
them as `conformance-<version>.zip` — the fixtures, the manifest, the defect
catalogue, both schemas and the two documents that state what they hold, under
one directory, with its digest in the release notes — attached to the
[release](https://github.com/curly-message/spec/releases) that named it.

A file has a `format`, the versioned identifier of the format it targets; a
`level`, the conformance level of section 2 that requires every case in it;
a `section`, the heading of the specification the file pins; and its `cases`.
A file that pins the tree declares `kind` as `tree` and no level — `CST.md` is
not one of the levels — and its `section` is a heading of that document.

A case is either written out or generated. A written-out case has:

| Field | Meaning |
| --- | --- |
| `id` | Unique across the set: the file's group, a slash, and a slug. |
| `description` | One sentence naming what the case pins, for the failure it would print. |
| `section` | A more specific heading than the file's, where the case pins one. |
| `message` | The message. Usually text; any other JSON value is a message a host wrote as something else (section 4), and the `undefined` tag below is a message the caller did not supply, which resolves to the empty string (section 4). |
| `payload` | The payload (section 3). Entries hold values, wrappers (section 4.1) or tagged values. |
| `props` | The caller's formatting properties, grouped by modifier name (section 11.2). |
| `locale` | The locale. |
| `messageId` | The message's id (section 4), spelled out because a case's own `id` names the case. Any JSON value: no step of resolution reads it, and reports name it (section 14.3). |
| `modifiers` | Host-defined modifiers to register (section 11.3): a name to a behaviour from the catalogue below. |
| `defaults` | The implementation-configured defaults, the bottom formatting layer of section 11.2, grouped by modifier name. |
| `expected` | What the resolution must produce: an `output`, or for a locale-dependent one a `format` request; and the `reports`, in the order they are emitted, none where the field is omitted. |

A generated case has an `id`, a `description`, optionally a `section`, and a
`generate` naming one of the constructions under *Generated cases* below. The
runner builds its inputs and its expectation from the limits the adapter
declares.

### Tagged values

A fixture is JSON, and the format takes inputs JSON cannot spell. Three tagged
objects stand in for them, anywhere in a message, a payload, props, an id or
the defaults. A runner decodes each into the host value it names before the
adapter sees it; nothing else is decoded, so a payload entry of any other shape
reaches the implementation as the plain data JSON describes.

A tag is read on a case's **inputs** and nowhere else. An expectation is
compared as written, so a tag in one would be compared as the object it is
spelled as, which no implementation answers with; the schema therefore holds the
id of an expected report to text. A case whose id is not text leaves that id out
of its expectation and the id goes unobserved.

| Tag | Stands for |
| --- | --- |
| `{ "$curly": "undefined" }` | The host's undefined (sections 4.1, 9.2, 10). A message so tagged is one the caller did not supply. |
| `{ "$curly": "unserializable" }` | A value that no conversion can describe (section 4). The JavaScript runner builds a plain object that references itself. |
| `{ "$curly": "nodes", "count": N }` | A value whose serialization visits at least `N` nodes (section 13). The runner builds a tree of shared references — each level an array naming the level below twice — deep enough to visit `N`. |

### Host-defined modifiers

A case at the Extensions level may register modifiers. It cannot ship code, so
it names behaviours from a catalogue every runner implements in its own
language and hands to the adapter as functions of section 11's inputs: the
value and the default as text, the options as the placeholder wrote them, the
props composed under the modifier's own name, and the locale the caller
supplied, as it supplied it (section 11.3). The adapter wraps each into its
implementation's own modifier signature.

| Behaviour | Answers with |
| --- | --- |
| `upper` | The value with its ASCII letters uppercased. |
| `echo` | The value, unchanged. |
| `empty` | The empty string — an answer, not the absence of one. |
| `nothing` | The host's nothing: no answer, so the placeholder takes the fallback chain (section 11). |
| `raise` | Nothing; it raises, and the failure must be contained (section 11.3). |
| `default` | The default, read through the chain (section 10). |
| `options` | The options in the order they were handed over, each `key=value`, joined by commas: `a=A,b=,c=c` (section 9.4). |
| `props` | The props it received, each own property `name=value` with the value as JSON, sorted by name and joined by commas: `maximumFractionDigits=1,useGrouping=true` (sections 11.2, 11.3). |
| `locale` | The locale it received, or `none` where it received none. An empty locale answers empty. |
| `object` | A plain object holding the value under `answer`, so the answer serializes (section 11): `{"answer":"X"}`. |

### Locale-dependent expectations

The formatting modifiers of section 11.2 delegate to the host's
internationalization facilities, whose output varies with the host's locale
data. A case for one therefore states the formatting request rather than its
result: which facility, the options it is constructed with, and the input the
modifier hands it. The options are the properties the facility reads, as the
layers of section 11.2 compose them and the modifier pins them — `number`'s
default maximum, `currency`'s style, `ago`'s `numeric` — and not the format's
own `ratio` and `format`, which the input already reflects. The runner performs
that request on the host it runs on and expects the implementation's output to
match it, so the case pins what the specification pins — the request — and the
locale data stays the host's.

| `api` | `input` | The request |
| --- | --- | --- |
| `NumberFormat` | a number | `Intl.NumberFormat(locale, options).format(input)` |
| `DateTimeFormat` | milliseconds since the epoch | `Intl.DateTimeFormat(locale, options).format(input)` |
| `RelativeTimeFormat` | `[value, unit]` | `Intl.RelativeTimeFormat(locale, options).format(value, unit)` |

The locale is the case's own. The message of such a case is the placeholder
alone, so that the whole output is the request's result. A date case names a
`timeZone` in its props, because a request without one formats in the host's,
which the fixture cannot know.

An implementation whose locale data is not the runner's cannot be held to the
text, and section 11.2 lets it expose the request it made instead. An adapter
that answers with `formats` is measured on that: such a case compares the
facility, the properties and the input, and the locale data on each side stays
its own. One that leaves `formats` undefined is measured on the text, which is
what an implementation sharing the runner's host can be held to.

A property the host's facility cannot express is a different matter, and
section 11.2 has such an implementation document what it cannot express. The
adapter states it as `unexpressible`, and every case whose request reads one of
those properties is left out — listed among the skipped, the way an unclaimed
level's cases are.

### Generated cases

Section 13 lets an implementation permit more than its minima and requires it
to document what it permits, so a case at a limit cannot be written out: it is
built from the limits the adapter declares, and exercises the implementation at
the bounds it documents. `L` is the declared output limit, `R` the read limit,
`C` the conversion limit, `N` the nesting limit, and every generated case
reports under the id `limits`.

Each construction spends one budget and leaves the others room, so a case
built at one limit cannot be failed by another: the output constructions write
from an option value, which is the message's own text and costs no reading,
and the read construction selects nothing, so the value it spends the read
budget on never reaches the output.

| `generate` | Message and payload | Expected |
| --- | --- | --- |
| `output-at-limit` | `{{v; a:<x × L>;}}`, with `v` holding `a`. | `x` repeated `L` times, no reports. |
| `output-over-limit` | `A{{v; a:<x × (L + 1)>;}}B`, with `v` holding `a`. | `AB` — the placeholder resolved to the empty string, and the message's own text around it is the caller's and counts against nothing — and one `output-limit` report of origin `limit`. |
| `output-over-limit-continues` | The same placeholder followed by `{{w}}`, with `w` holding `tail`. | `tail` and one `output-limit` report: a result the output has no room for spends nothing, so what follows it still resolves. |
| `read-at-limit` | `{{v:eq; nomatch:X; default:ok;}}`, with `v` holding `x` repeated `R` times. | `ok`, no reports. |
| `read-over-limit` | The same placeholder followed by `{{w}}`, with `v` one character longer and `w` holding `tail`. | `ok` and one `read-limit` report of origin `limit`: the budget is tested before a placeholder reads, so the one that spent it past the limit still resolves and the one after it pays. |
| `conversion-over-limit` | `{{v; default:D}}`, with `v` a `nodes` value of `C + 1`. | `D` and one `unserializable-value` report of origin `payload`: a serialization that reaches the limit describes nothing, so the placeholder takes the chain. |
| `nesting-at-limit` | `N` placeholders, each selecting the option that holds the next; the innermost is `{{v; a:settled; default:fallback;}}`. `v` holds `a`. | `settled`, no reports. |
| `nesting-over-limit` | The same nesting one level deeper. | `fallback` and one `nesting-limit` report of origin `message`: the innermost placeholder is refused and takes its fallback chain, and every level around it selects the option that holds it. |

An adapter whose reports carry a `limit` is held to the declared limit on the
`output-limit`, `read-limit` and `nesting-limit` reports.

### Tree cases

A file whose `kind` is `tree` pins the concrete syntax tree of
[`CST.md`](../CST.md): what an implementation that offers one answers for a
message. Such a case carries no input beyond the message, because a tree is a
function of the message alone.

| Field | Meaning |
| --- | --- |
| `id`, `description`, `section` | As above, except that the `section` is a heading of `CST.md`. |
| `message` | The message, as text. |
| `expected` | The children of the root node, in order. |
| `resolves` | What the same message resolves to over no payload, where the case pins that the tree and the resolution read the same placeholders (section 5, property 4). The message then names no modifier, so the expectation holds at the Core level. |

A node of `expected` states what it is and what it spells, never where it is:

| Field | Meaning |
| --- | --- |
| `type` | The kind, as section 6 of `CST.md` spells it. |
| `text` | The text the node spans. |
| `name` | For a name kind: the span unescaped. |
| `cancels` | For an escape: which of the two readings of section 7 the sequence takes. |
| `nodes` | The children, in order, wherever the case reads into the node. |

The span is the one thing a case does not write. Section 4 of `CST.md` lets an
implementation count its spans in whatever unit its strings are indexed by, so
a case that wrote numbers would pin one implementation's unit on every other.
A case writes the text instead, and the runner reads that text off the span the
implementation answered with, in the unit the adapter declared. The declaration
is thereby observable: an implementation that counts UTF-16 code units and
states it counts code points fails the case whose message holds a character
outside the basic multilingual plane.

The properties of section 5 are checked on every tree case before its own
expectation is compared, because a tree that is wrong about the message is
wrong whatever the case says of its nodes: the leaves tile the message in order
and spell it back, no span boundary falls inside a code point, no node lies
outside the one that holds it, and two parses of one message agree.

## The adapter

Section 14.3 has the conformance set observe an implementation through an
adapter the implementation supplies. It is three things:

```ts
import type { Adapter } from '@curly-message/conformance';

export const adapter: Adapter = {
  levels: ['core', 'intl', 'extensions'],
  limits: { output: 100000, read: 100000, conversion: 100000, nesting: 8 },
  resolve: ({ message, payload, props, locale, id, modifiers, defaults }) => {
    // Call the implementation and answer with what it produced.
    return { output, reports };
  },
};
```

`levels` is the statement section 2 requires: the levels the implementation
satisfies. The runner selects the fixtures those levels require and skips the
rest, and the skipped cases are listed, not hidden. `limits` is the statement
section 13 requires, and is what the generated cases are built from. An adapter
MAY make a third statement, `unexpressible`: the formatting properties the
host's facility cannot express (section 11.2), under the request that reads
them, which leaves out the cases that would measure the host rather than the
implementation.

An adapter MAY offer a fourth thing, `cst`: the concrete syntax tree of
[`CST.md`](../CST.md), as the `unit` its spans are counted in — `utf-8`,
`utf-16` or `code-point` — and the `parse` that produces one. An adapter that
leaves it out has every tree case left out with that reason rather than failed,
because an implementation conforms without offering a tree. A `cst` whose unit
is none of the three is an error rather than a skip, the way an unknown level
is: a tree whose unit is unstated says nothing about where anything is.

`resolve` is handed one resolution's inputs, decoded into host values, and
answers with the `output` and the `reports` the implementation produced. The
output is compared exactly. A report is compared by its `code`; its `origin`,
`id` and `limit` are compared where the adapter's reports carry them, since
the specification prescribes no shape for a report, only what a code names and
which origin it declares. Reports are compared in order, because section 14.3
has an implementation report in the pass where the condition was met and
section 9 resolves a pass in source order. An adapter that leaves `reports`
undefined says the implementation does not report at all — reporting is a
SHOULD — and every expectation about reports is then skipped, and said to be:
such a case passes on its output alone with an outcome of
`{ ok: true, unobserved: 'reports' }`, `run` lists it under `unobserved`
beside `passed`, and the command counts those cases in its summary.

`resolve` MAY answer with `formats` as well, the formatting requests the
resolution made, in the order it made them. A case that states a request is
then compared on that request rather than on the output, as the section above
describes; a case that states an output is compared on its output whether the
adapter answers with `formats` or not.

## Running the set

The set is a development dependency of the implementation it assesses:

```bash
npm install --save-dev @curly-message/conformance
```

From a test:

```ts
import { check, plan, run } from '@curly-message/conformance';

check(adapter);          // throws with the list of failures, if any

const result = run(adapter);   // { passed, failed, skipped, unobserved }

for (const planned of plan(adapter).cases) {
  test(planned.id, () => {
    const outcome = planned.execute();

    expect(outcome).toMatchObject({ ok: true });
  });
}
```

`plan` is for a test framework: one entry per case the adapter's levels
require, each carrying its `id`, `file`, `section`, `description`, the `level`
and the `document` where the case has them, and an `execute` that runs it and
answers with an outcome — `{ ok: true }`, or the reason it failed beside what was expected and
what came back. `run` executes a
plan and sorts the outcomes. Both take options: `fixtures`, to run a set other
than the shipped one, and `levels`, to run a subset of the levels the adapter
claims. An adapter must claim `core`, and `levels` must name only levels it
claims; anything else is an error rather than a skip. A case at a level that
does not run is skipped with a reason naming the level, and a tree case is
skipped wherever the adapter offers no `cst`.

The package also exports what those are built from: `fixtures()` reads the
shipped set and `load(directory)` any directory of fixture files, both sorted
by file name, which is what the `fixtures` option takes; `summarize(result)`
renders what the command prints; and `decode` and `behaviours` are the tagged
values and the catalogue as this runner implements them, for an adapter's own
tests to reuse.

From the command line, with a module that exports the adapter as `adapter` or
as its default export:

```bash
npx curly-message-conformance ./adapter.mjs
npx curly-message-conformance ./adapter.mjs --levels core,intl
npx curly-message-conformance ./adapter.mjs --fixtures ./my-fixtures
```

The command prints one line per failure and a summary, and exits non-zero where
anything failed. `--fixtures` points at a directory of fixture files, so a set
under development runs against an implementation before it ships.

## Auditing a runner

A runner is trusted with a verdict, so it needs one of its own: a runner that
compares nothing passes every implementation, including the ones that are
wrong, and reports the same summary either way. `defects.json` is the catalogue
of ways an adapter can be wrong, each with what a correct runner answers where
it is present, and `schema/defect.schema.json` describes the file.

```ts
import { audit } from '@curly-message/conformance';

const missed = audit(adapter).filter(({ outcome }) => outcome !== 'caught');
```

`audit` takes an adapter that passes the set, applies each defect to it in
turn, and answers one entry per defect: what the catalogue expected, what this
runner observed, and whether that counts as `caught`, `missed` or
`unreachable`. The last is for a defect the adapter gives the runner nothing to
catch — what an implementation that observes no reports does to every defect of
its reports, one that claims Core alone to every defect of a level it does not
claim, and one that offers no tree to every defect of the tree. A defect names
the `section` it pins and, where that is a heading of `CST.md` rather than of
the specification, the `document` it is a heading of. `defects()` reads the
catalogue and `mutations` carries it, so a runner's own tests can reach one
defect without running them all.

[RUNNER.md](./RUNNER.md) states what each defect pins.

## Writing a fixture

A case pins a sentence of the specification, and states which: the `section`
is what a failure points at. Its expectation follows from the text, not from
what an implementation happens to do, so a behaviour the specification leaves
to the host — how its numeric conversion reads a literal, which text its date
parsing accepts, what a host type converts to — is not a case. Where the
specification lets two conforming implementations differ, the set does not
choose between them.

The narrow reading of section 4 falls there as well. That a value of a type an
application declared or derived converts as a string rather than as JSON is
normative, but the string is the host's own, and a case that stated one would
pin it on every other host. So the set pins the values that do serialize, and
an implementation that reads section 4 too widely passes it.

The reference implementation is what the set is checked against before it
lands, and the set is what the reference is checked against in turn. Where
the two disagree, the specification decides which is wrong.

`npm run manifest` regenerates `index.json` from the files, and a version bump
runs it; the tests fail where it is stale, where an `id` repeats, where a file
does not validate against the schema, or where a `section` names no heading of
the document its file reads against.

## Development

```bash
npm install
npm test         # builds, typechecks, lints, then runs vitest
npm run lint:fix # applies what the lint step only reports
```

Requires Node.js 22 or newer.

## License

[MIT](./LICENSE)
