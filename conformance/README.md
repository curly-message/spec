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
Schema every file validates against: the set's own tests hold a release's files
to it, and a runner in another language that reads files from anywhere else
checks them against it first ([RUNNER.md](./RUNNER.md)).

Those files are the set. Nothing in them is JavaScript, so an implementation in
another language needs nothing else from this package: every release carries
them as `conformance-<version>.zip` — the fixtures, the manifest, the defect
catalogue, both schemas and the two documents that state what they hold, under
one directory, with its digest in the release notes — attached to the
[release](https://github.com/curly-message/spec/releases) that named it. From
4.2.0 on, the release carries beside it `conformance-<version>.zip.sha256`, the
digest as `sha256sum` writes it.

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
| `keeping` | Host-defined modifiers to register that keep an input and read it in a later call: a name to one of the behaviours below that keep, which the runner builds afresh for each resolution. A case may write it beside `modifiers`, and names no modifier in both. |
| `defaults` | The implementation-configured defaults, the bottom formatting layer of section 11.2, grouped by modifier name. |
| `expected` | What the resolution must produce: an `output`, or for a locale-dependent one a `format` request — for a selection request with the output each of its `categories` selects; and the `reports`, in the order they are emitted, none where the field is omitted. |

A generated case has an `id`, a `description`, optionally a `section`, and a
`generate` naming one of the constructions under *Generated cases* below. The
runner builds its inputs and its expectation from the limits the adapter
declares, or from the bound on counted reads it states.

### Tagged values

A fixture is JSON, and the format takes inputs JSON cannot spell. Four tagged
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
| `{ "$curly": "refusing", "members": [names] }` | An object owning each of `names` as an entry the host raises on where it is read (sections 9.2, 11.2). The JavaScript runner builds a plain object whose members are enumerable getters that throw. |

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
| `nothing` | The host's nothing: what the implementation reads as an answer that is nothing at all — `undefined` in JavaScript — so the placeholder takes the fallback chain (section 11). |
| `raise` | Nothing; it raises, and the failure must be contained (section 11.3). |
| `default` | The default, read through the chain (section 10). |
| `options` | The options in the order they were handed over, each `key=value`, joined by commas: `a=A,b=,c=c` (section 9.4). |
| `props` | The props it received, each own property `name=value` with the value written as ECMAScript's `JSON.stringify` writes it, sorted by name and joined by commas: `maximumFractionDigits=1,useGrouping=true` (sections 11.2, 11.3). That spelling is compact, writes a whole number without a fraction — `1`, not `1.0`, whatever type the implementation hands it on as — and escapes text as `JSON.stringify` does, which leaves `/` and every character outside ASCII as it is, and escapes a lone surrogate. |
| `locale` | The locale it received, or `none` where it received none. An empty locale answers empty. |
| `object` | A plain object holding the value under `answer`, so the answer serializes (section 11): `{"answer":"X"}`. |

Four behaviours more, which a case registers under `keeping`, keep an input —
the default, as the `default` call that reads it — and read it in a later
call, which section 13 counts. They share one list of what was kept, and its
claims, for the length of one resolution: a runner builds them afresh for each
resolution it asks for, and the modifiers handed to `resolve` belong to that
resolution, so an adapter does not cache them, or a parser built from them,
across resolutions. The JavaScript runner builds them with `keeping()`, and
leaves them out of `behaviours`, which holds no state.

| Behaviour | Answers with |
| --- | --- |
| `keep` | The empty string. It keeps its default without reading it. |
| `keep-default` | The default, read through the chain (section 10). It keeps the default first, then reads it. |
| `take` | The text a read of the input kept last that no `take` has claimed answers, or `empty` where it answers the empty string, so a `take` that went on with a refused read shows. It claims that input before it reads it, whatever the read answers, so a read that reaches `take` again finds the one kept before it. Where every input kept is claimed, or none is kept, `none`. |
| `first` | The text a read of the input kept first answers, or `empty` where it answers the empty string, claiming nothing; `none` where nothing is kept. |

`keep` reads nothing it keeps and `first` reads only what an earlier call
kept, so a case that registers either reads a kept input after the modifier
that kept it returned. The set writes no case that reads one so through
`keep-default` and `take` alone: a case that registers neither `keep` nor
`first` reads a kept input, where it reads one, while the modifier that kept
it is current, and the set's own tests hold every case to that.

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
| `PluralRules` | a number | `Intl.PluralRules(locale, options).select(input)` |

The locale is the case's own. The message of such a case is the placeholder
alone, so that the whole output is the request's result. A date case names a
`timeZone` in its props, because a request without one formats in the host's,
which the fixture cannot know.

The plural selections of section 11.5 ask the host for a category rather than
for text, and the category chooses an option. A case for one states the
`PluralRules` request — its options the properties composed under the modifier's
own name, for `plural` over the digit properties it reads from `number` with
`number`'s default maximum applied, and the rule type the modifier pins over
them — and `categories`, the output the resolution must produce for each of the
six categories, a category the placeholder writes no option for included: that
one names what the fallback chain gives. The runner performs the request, reads
the category its host answers, and expects the output the case names for it, so
the choice of option is pinned and the category stays the host's. A case whose
number a key matches exactly asks the host nothing, and states its output as any
other case does.

An implementation whose locale data is not the runner's cannot be held to the
text, and section 11.2 lets it expose the request it made instead. An adapter
that answers with `formats` is measured on that: such a case compares the
facility, the properties and the input, and the locale data on each side stays
its own. One that leaves `formats` undefined is measured on the text, which is
what an implementation sharing the runner's host can be held to.

A selection request is exposed with the `category` the host answered, because
that category and not any text chose the output (section 11.5). The runner
compares the request as it compares any other, and holds the output to the one
the case names for that category: the category is the implementation's host's,
and the option it chose is the format's.

A property the host's facility cannot express is a different matter, and
section 11.2 has such an implementation document what it cannot express. The
adapter states it as `unexpressible`, and every case whose request reads what
it states is left out — listed among the skipped, the way an unclaimed level's
cases are. An entry is a property name, which stands for every value of the
property in every request, or an object naming the `property` and narrowing
it: to the `values` it lists, and to the requests whose properties named in
`when` hold the values given there. A value is compared as a request's are.

```ts
unexpressible: {
  NumberFormat: [
    'roundingMode',
    { property: 'currencyDisplay', values: ['name'] },
    { property: 'maximumFractionDigits', when: { style: 'currency' } },
  ],
},
```

An entry that names no property, lists no value, states an empty condition or
holds a key besides these three is an error rather than a skip, as an unknown
facility is.

### Generated cases

Section 13 lets an implementation permit more than its minima and requires it
to document what it permits, so a case at a limit cannot be written out: it is
built from the limits the adapter declares, and exercises the implementation at
the bounds it documents. `L` is the declared output limit, `R` the read limit,
`C` the conversion limit, `N` the nesting limit, `B` the bound on counted reads
the adapter states as `reentry`, and every generated case is resolved under the
id `limits`.

Each construction spends one budget and leaves the others room, so a case
built at one limit cannot be failed by another: the output constructions write
from an option value, which is the message's own text and costs no reading,
and the read construction selects nothing, so the value it spends the read
budget on never reaches the output. Five nesting constructions meet a second
limit, a report of the payload or a second message error at a placeholder
nested too deep on purpose: they pin the order section 9 decides those in.

| `generate` | Message and payload | Expected |
| --- | --- | --- |
| `output-at-limit` | `{{v; a:<x × L>;}}`, with `v` holding `a`. | `x` repeated `L` times, no reports. |
| `output-over-limit` | `A{{v; a:<x × (L + 1)>;}}B`, with `v` holding `a`. | `AB` — the placeholder resolved to the empty string, and the message's own text around it is the caller's and counts against nothing — and one `output-limit` report of origin `limit`. |
| `output-over-limit-continues` | The same placeholder followed by `{{w}}`, with `w` holding `tail`. | `tail` and one `output-limit` report: a result the output has no room for spends nothing, so what follows it still resolves. |
| `read-at-limit` | `{{v:eq; nomatch:X; default:ok;}}`, with `v` holding `x` repeated `R` times. | `ok`, no reports. |
| `read-over-limit` | The same placeholder followed by `{{w}}`, with `v` one character longer and `w` holding `tail`. | `ok` and one `read-limit` report of origin `limit`: the budget is tested before a placeholder reads, so the one that spent it past the limit still resolves and the one after it pays. |
| `conversion-at-limit` | `{{v:ne; nomatch:ok; default:refused;}}`, with `v` a value whose serialization visits `C` nodes: `s` members referring to one shared object of `s − 1` members, with `s` the largest whole number whose square is at most `C − 1`, and `C − 1 − s²` members more; those members, and every member of the shared object, hold the host's undefined. Section 13 counts each reference to the shared object, and each member the walk visits and then omits, so the serialization writes only the `s` names, each with an empty object. | `ok`, no reports: the value converts, so its text differs from `nomatch` and the option is chosen, where an abandoned conversion would take the chain to `refused`. |
| `conversion-over-limit` | `{{v; default:D}}`, with `v` built the same way to visit `C + 1` nodes. | `D` and one `unserializable-value` report of origin `payload`: a serialization that reaches the limit describes nothing, so the placeholder takes the chain, however short the text it would have written. |
| `conversion-over-limit-continues` | `{{v; default:D}}{{w}}`, with `v` an array of `C` elements, each `x` repeated `ceil(R / C) + 1` times, so its serialization visits `C + 1` nodes and the text it would write runs past `R`, and `w` holding `tail`. | `Dtail` and one `unserializable-value` report of origin `payload`: a value no conversion can describe produces no text and spends none of the read budget, so what follows it still resolves. |
| `nesting-at-limit` | `N` placeholders, each selecting the option that holds the next; the innermost is `{{v; a:settled; default:fallback;}}`. `v` holds `a`. | `settled`, no reports. |
| `nesting-over-limit` | The same nesting one level deeper. | `fallback` and one `nesting-limit` report of origin `message`: the innermost placeholder is refused and takes its fallback chain, and every level around it selects the option that holds it. |
| `nesting-over-limit-converts` | The `N + 1` levels of `nesting-over-limit`, the innermost being `{{w; default:fallback;}}`, with `v` holding `a` and `w` a value that cannot be described. | `fallback`, then one `unserializable-value` report of origin `payload` and one `nesting-limit` report of origin `message`, in that order: the nesting limit is decided after the value is looked up and converted. |
| `nesting-over-limit-reads` | The same message followed by `{{v}}`, with `w` holding `x` repeated `R + 1` times. | `fallback`, then one `nesting-limit` report and one `read-limit` report: the refused placeholder read its value, which spent the budget, so the one after it pays. |
| `nesting-over-limit-read-spent` | The `N + 1` levels of `nesting-over-limit`, the innermost level being two placeholders, `{{w:eq; nomatch:X;}}{{v; default:fallback;}}`, with `v` holding `a` and `w` holding `x` repeated `R + 1` times. | The empty string, then one `nesting-limit` report and one `read-limit` report: the read limit is tested first, so the second placeholder, reached with the budget spent, resolves to the empty string however deeply it nests. |
| `nesting-over-limit-unknown-modifier` | The `N + 1` levels of `nesting-over-limit`, the innermost being `{{w:zz; default:fallback;}}`, with `v` holding `a` and `w` holding `x`. No modifier `zz` is registered. | `fallback` and one `nesting-limit` report of origin `message`, and no `unknown-modifier` report: the nesting limit is the first message error decided, and a placeholder that meets one meets none after it. |
| `nesting-over-limit-missing-options` | The same levels, the innermost being `{{w:eq; default:fallback;}}`. | `fallback` and one `nesting-limit` report of origin `message`, and no `missing-options` report, for the same reason. |
| `nesting-chain-over-limit` | `N + 20000` placeholders `{{v; default:`, each the inline default of the one before it, around `x`, then as many `}}`. The payload is empty. | `x` and 20 000 `nesting-limit` reports of origin `message`: every level takes its chain, whose last link is the next, and each one past the limit is refused and reported once. No limit raises, so the chain resolves however deep it is; a walk that recurses once per level overflows at this depth on some hosts, Node's default stack among them, though not on every one. |
| `reentry-at-limit` | `B` placeholders `{{x:keep; default:T}}`, then `T`, where `T` is `{{x:take; default:F}}`, with `x` holding the empty string, `read` registered as `default`, and `keep`, `take` and `first` registered under `keeping` as the behaviours of those names. | `none`, no reports: the last `take` reads the input kept last, whose `take` reads the one kept before it, and so on, so `B` counted reads stand one inside another and each produces its text; the innermost `take` finds every input claimed, and each answers what it read. |
| `reentry-over-limit` | `B + 1` placeholders that keep, the second of them with the default `[T]` and the others `T`, then `T`; where `B` is 0, `{{x:keep; default:T}}T`. | `[empty]`, no reports: the read past the bound is the one the `take` in the second default makes, and it is refused, produces nothing and answers the empty string; that `take` goes on with it and answers `empty` (section 13), and each read around it answers what it produced. A `take` that fails takes its chain to `F`, and one whose call the refusal ended leaves `[]`. Where `B` is 0, the `take` after them makes the refused read, and the output is `empty`. |
| `reentry-refused-not-recorded` | The same message followed by `{{x:first; default:F}}`. | `[empty]none`, no reports: the refused read was not recorded, so `first` reads the input kept first with nothing in progress, and it produces its text now, its `take` finding every input claimed. Where `B` is 0 that read is refused as well, and the output is `emptyempty`. |
| `reentry-own-reads-free` | `{{x:keep; default:S}}`, then `B − 1` placeholders `{{x:keep; default:T}}`, then `T`, where `S` is `N − 1` levels of `{{x:read; default:…}}`, each default holding the next and the innermost `z`. Left out where `B` is 0. | `z`, no reports: the innermost of `B` counted reads produces `S`, whose modifiers each read their own default, and those reads are the walk's and count toward no bound. |

The four constructions of kept reads are of the Extensions level, since they
register modifiers, and none of them reaches the output, read or nesting limit
whatever `B` is: no placeholder's result is longer than `[empty]`, the value they
read is the empty string, and each read renders a default at the depth the
message writes it, so they nest two levels, and `reentry-own-reads-free` `N`.
They are left out where the adapter states no `reentry`, and where it states
`keeps` as `false`.

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
section 13 requires of its four limits, and is what the generated cases are
built from. Each
limit is the most the implementation lets through: the conversion limit is the
most nodes a serialization may visit and still describe the value, so an
implementation that abandons one on reaching its hundred-thousandth node, as
section 13 allows, declares 99 999. An adapter MAY make a third statement,
`unexpressible`: what the host's facility cannot express (section 11.2) — a
property, or a value of one, in every request or in the requests whose other
properties hold given values — under the request that reads it, which leaves
out the cases that would measure the host rather than the implementation.

Two more statements are about the inputs a host-defined modifier keeps (section
11.3), and an adapter MAY make either. `reentry` is the bound on one thread of
execution that section 13 lets an implementation keep, as it reaches the reads
a kept input is read through: the most counted reads that may be producing
their text at once on one thread of execution during one resolution asked for
where none was in progress, that resolution itself not counted. An
implementation whose documented bound counts that resolution states one less: a
bound of 16 resolutions in progress at once is a `reentry` of 15. Section 13
sets no minimum for the bound, so 0 is one; a `reentry` that is not a whole
number of 0 or more is an error rather than a skip. An adapter that leaves it
out states that the implementation keeps no such bound, and the constructions
built from it are left out. `keeps`, stated as `false`, says that the
implementation hands a modifier inputs that end with its call, so that no
modifier can keep one and read it in a later call; every case that reads a
kept input after the modifier that kept it returned is then left out, and the
one that reads it while that modifier is current still runs.

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
resolution made, in the order it made them. A case that states a formatting
request is then compared on that request rather than on the output, as the
section above describes. A selection request of section 11.5 carries the
`category` the host answered as well, and a case that states one is compared on
the request and then on the output its category selects. A case that states an
output is compared on its output whether the adapter answers with `formats` or
not.

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
renders what the command prints; and `decode`, `behaviours` and `keeping` are
the tagged values and the catalogue as this runner implements them, for an
adapter's own tests to reuse.

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

const missed = audit(adapter).filter(({ outcome }) => outcome === 'missed');
```

`audit` takes an adapter that passes the set, applies each defect to it in
turn, and answers one entry per defect: what the catalogue expected, what this
runner observed, and whether that counts as `caught`, `missed` or
`unreachable`. The last is for a defect the adapter gives the runner nothing to
catch — what an implementation that observes no reports does to every defect of
its reports, one that claims Core alone to every defect of a level it does not
claim, one that offers no tree to every defect of the tree, one that states no
`reentry`, or states `keeps` as `false`, to a bound stated one higher or one
lower than the one it keeps, and one whose own
`unexpressible` already leaves out every case of the run whose request a defect
of what it cannot express covers to that defect. A defect names
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

The order of an object's members is the host's as well: section 4 leaves the
serialization to the host, and one host writes the members in the order they
were inserted while another sorts them. So a case that serializes an object
with several members writes them in an order both produce — sorted by code
point, at every depth — in its inputs and in its expectation alike. ECMAScript
writes a key that is an array index, such as `9` or `10`, ahead of every other
key and in numeric order, whatever order it was inserted in, so such a case
names no member with one.

How deep a value nests before its serialization is refused is the host's too:
section 13 sets no minimum for that depth, and the implementation documents
it. So a case that expects a value serialized nests it at most four levels
deep, counting the outermost object or array as the first. A case that
expects a serialization refused — a `nodes` value, an `unserializable` one —
expects the same outcome whatever depth refuses it, so only an implementation
that documents a shallower depth fails a case for its depth.

The reference implementation is what the set is checked against before it
lands, and the set is what the reference is checked against in turn. Where
the two disagree, the specification decides which is wrong.

`npm run manifest` regenerates `index.json` from the files, and a version bump
runs it; the tests fail where it is stale, where an `id` repeats, where an
object of a JSON file the package ships (a fixture file, the manifest, the
defect catalogue or a schema) repeats a key, where a file does not validate
against the schema, or where a `section` names no heading of the document its
file reads against.

## Development

```bash
npm install
npm test          # builds, typechecks, lints, then runs vitest on the source and on the build
npm run test:bun  # builds, then runs the same suite on Bun
npm run test:deno # builds, then runs the same suite on Deno
npm run lint:fix  # applies what the lint step only reports
npm run bench     # builds, then measures what the build costs
npm run bench -- --compare ../other/conformance  # the same, beside another checkout's build
```

Requires Node.js 22 or newer; the runtime scripts need Bun or Deno 2 as well.

## License

[MIT](./LICENSE)
