# @curly-message/conformance

The conformance set of the [Curly Message Format](../SPEC.md): fixtures that
an implementation in any language is measured against, and a JavaScript runner
that drives one through the adapter of section 14.3.

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

## Status

**Stable**, on npm as `@curly-message/conformance`. The set lives in the
specification's repository because its fixtures are artifacts of the format,
not of any one implementation, and it is versioned against the specification:
version 1 of the set targets version 1 of the format.

## The fixture files

`fixtures/*.json` groups the cases by the section of the specification they
pin, one file per group, and `index.json` lists the files with the level and
section each covers. `schema/fixture.schema.json` is the JSON Schema every file
validates against, so a runner in another language checks the set before it
reads it.

Those files are the set. Nothing in them is JavaScript, so an implementation in
another language needs nothing else from this package: every release carries
them as `conformance-<version>.zip` — the fixtures, the manifest and the schema
under one directory, with its digest in the release notes — attached to the
[release](https://github.com/curly-message/spec/releases) that named it.

A file has a `format`, the versioned identifier of the format it targets; a
`level`, the conformance level of section 2 that requires every case in it;
a `section`, the heading of the specification the file pins; and its `cases`.

A case is either written out or generated. A written-out case has:

| Field | Meaning |
| --- | --- |
| `id` | Unique across the set: the file's group, a slash, and a slug. |
| `description` | One sentence naming what the case pins, for the failure it would print. |
| `section` | A more specific heading than the file's, where the case pins one. |
| `message` | The message. Usually text; any other JSON value is a message a host wrote as something else (section 4), and the `undefined` tag below is a message the caller did not supply (section 10). |
| `payload` | The payload (section 3). Entries hold values, wrappers (section 4.1) or tagged values. |
| `props` | The caller's formatting properties, grouped by modifier name (section 11.2). |
| `locale` | The locale. |
| `key` | The message's key (section 4). Any JSON value: a key a host wrote as something other than text is echoed as the text it converts to (section 10). |
| `modifiers` | Host-defined modifiers to register (section 11.3): a name to a behaviour from the catalogue below. |
| `defaults` | The implementation-configured defaults, the bottom formatting layer of section 11.2, grouped by modifier name. |
| `expected` | What the resolution must produce: an `output`, or for a locale-dependent one a `format` request; and the `reports`, in the order they are emitted, none where the field is omitted. |

A generated case has an `id`, a `description`, optionally a `section`, and a
`generate` naming one of the constructions under *Generated cases* below. The
runner builds its inputs and its expectation from the limits the adapter
declares.

### Tagged values

A fixture is JSON, and the format takes inputs JSON cannot spell. Three tagged
objects stand in for them, anywhere in a message, a payload, props, a key or
the defaults. A runner decodes each into the host value it names before the
adapter sees it; nothing else is decoded, so a payload entry of any other shape
reaches the implementation as the plain data JSON describes.

A tag is read on a case's **inputs** and nowhere else. An expectation is
compared as written, so a tag in one would be compared as the object it is
spelled as, which no implementation answers with; the schema therefore holds the
key of an expected report to text. A case whose key is not text leaves that key
out of its expectation and the key goes unobserved.

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

### Generated cases

Section 13 lets an implementation permit more than its minima and requires it
to document what it permits, so a case at a limit cannot be written out: it is
built from the limits the adapter declares, and exercises the implementation at
the bounds it documents. `P` is the declared pass limit, `L` the output limit,
`C` the conversion limit, and every generated case reports through the key
`limits`.

| `generate` | Message and payload | Expected |
| --- | --- | --- |
| `passes-at-limit` | `{{p1}}`, with `p1` … `p<P-1>` each holding the placeholder of the next, and `p<P>` holding `settled`. Settling takes exactly `P` passes. | `settled`, no reports. |
| `passes-over-limit` | The same chain one link longer: `p<P>` holds `{{p<P+1>}}` and `p<P+1>` holds `settled`. | `{{p<P+1>}}` — the last settled text, its placeholder unresolved — and one `pass-limit` report of origin `limit`. |
| `output-at-limit` | `{{v}}`, with `v` holding `x` repeated `L` times. | That text, no reports. |
| `output-over-limit` | `{{v}}`, with `v` holding `x` repeated `L + 1` times. | `{{v}}` — the pass was discarded whole, so the message as it reached the first pass is what settled — and one `output-limit` report of origin `limit`. |
| `output-over-limit-stops` | `{{v}}{{w:raise}}`, with `v` as above, `w` holding `w`, and `raise` registered under that name. | `{{v}}{{w:raise}}` and one `output-limit` report: a placeholder past the limit is neither resolved nor reported, and the modifier it names is not called. This case is at the Extensions level. |
| `conversion-over-limit` | `{{v; default:D}}`, with `v` a `nodes` value of `C + 1`. | `D` and one `unserializable-value` report of origin `payload`: a serialization that reaches the limit describes nothing, so the placeholder takes the chain. |

An adapter whose reports carry a `limit` is held to the declared limit on the
`pass-limit` and `output-limit` reports.

## The adapter

Section 14.3 has the conformance set observe an implementation through an
adapter the implementation supplies. It is three things:

```ts
import type { Adapter } from '@curly-message/conformance';

export const adapter: Adapter = {
  levels: ['core', 'intl', 'extensions'],
  limits: { passes: 10, output: 100000, conversion: 100000 },
  resolve: ({ message, payload, props, locale, key, modifiers, defaults }) => {
    // Call the implementation and answer with what it produced.
    return { output, reports };
  },
};
```

`levels` is the statement section 2 requires: the levels the implementation
satisfies. The runner selects the fixtures those levels require and skips the
rest, and the skipped cases are listed, not hidden. `limits` is the statement
section 13 requires, and is what the generated cases are built from.

`resolve` is handed one resolution's inputs, decoded into host values, and
answers with the `output` and the `reports` the implementation produced. The
output is compared exactly. A report is compared by its `code`; its `origin`,
`key` and `limit` are compared where the adapter's reports carry them, since
the specification prescribes no shape for a report, only what a code names and
which origin it declares. Reports are compared in order, because section 14.3
has an implementation report in the pass where the condition was met and
section 9 resolves a pass in source order. An adapter that leaves `reports`
undefined says the implementation does not report at all — reporting is a
SHOULD — and every expectation about reports is then skipped, and said to be:
such a case passes on its output alone with an outcome of
`{ ok: true, unobserved: 'reports' }`, `run` lists it under `unobserved`
beside `passed`, and the command counts those cases in its summary.

## Running the set

The set is a development dependency of the implementation it assesses:

```bash
npm install --save-dev @curly-message/conformance@next
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
require, each carrying its `id`, `file`, `level`, `section`, `description` and
an `execute` that runs it and answers with an outcome — `{ ok: true }`, or the
reason it failed beside what was expected and what came back. `run` executes a
plan and sorts the outcomes. Both take options: `fixtures`, to run a set other
than the shipped one, and `levels`, to run a subset of the levels the adapter
claims. An adapter must claim `core`, and `levels` must name only levels it
claims; anything else is an error rather than a skip. A case at a level that
does not run is skipped with a reason naming the level, and so is
`output-over-limit-stops` wherever `extensions` does not run, whatever the
level of its file.

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

## Writing a fixture

A case pins a sentence of the specification, and states which: the `section`
is what a failure points at. Its expectation follows from the text, not from
what an implementation happens to do, so a behaviour the specification leaves
to the host — how its numeric conversion reads a literal, which text its date
parsing accepts, what a host type converts to — is not a case. Where the
specification lets two conforming implementations differ, the set does not
choose between them.

The reference implementation is what the set is checked against before it
lands, and the set is what the reference is checked against in turn. Where
the two disagree, the specification decides which is wrong.

`npm run manifest` regenerates `index.json` from the files, and a version bump
runs it; the tests fail where it is stale, where an `id` repeats, where a file
does not validate against the schema, or where a `section` names no heading of
`SPEC.md`.

## Development

```bash
npm install
npm test         # builds, typechecks, lints, then runs vitest
npm run lint:fix # applies what the lint step only reports
```

Requires Node.js 22 or newer.

## License

[MIT](./LICENSE)
