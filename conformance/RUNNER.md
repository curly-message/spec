# Writing a runner

This package ships the conformance set of the
[Curly Message Format](../SPEC.md) and a runner for it in JavaScript. The
fixtures are the artifact; the runner is one reading of them. An
implementation in another language needs a runner in that language, and this
document is what such a runner is held to.

[README.md](./README.md) states what a fixture file holds and what an adapter
supplies. This document states what a runner does with them, and how a runner
is measured before it is trusted to measure anything.

## What a runner does

A runner reads the fixture files, drives an implementation through the adapter
of section 14.3, and answers, case by case, whether what the implementation
produced is what the specification requires. It decides nothing else. Where an
implementation and a case disagree, the specification says which is wrong, and
a runner that resolves the disagreement itself has stopped measuring
conformance and started defining it.

That makes the runner's correctness load-bearing in a way its convenience is
not. A runner that compares nothing passes every implementation, including the
ones that are wrong, and reports the same green summary either way. The
catalogue described under [Auditing the runner](#auditing-the-runner) is how a
runner is kept honest.

## Reading the set

The set ships as JSON: `index.json` lists the fixture files with their level —
or, for a file that pins the tree rather than a resolution, their kind — their
section and their case count, and each file under `fixtures/` holds the
cases. `schema/fixture.schema.json` describes a file. A runner reads the
manifest, or the directory; both are sorted by file name, and a runner reports
in that order so two runs of the same set line up.

`format` in every file is the versioned identifier of the format the file
targets, and is `curly-message-1` for version 1. A file whose `format` a runner
does not know is a file it must refuse rather than skip: a set a runner could
not read is not a set an implementation passed.

## Decoding a case's inputs

A case's inputs are JSON, and the format's data model (section 4) is not. Three
constructions cannot be written as JSON, and a case writes each as an object
carrying a `$curly` key, which a runner replaces with the host value the tag
names:

| Tag | The host value |
| --- | --- |
| `{ "$curly": "undefined" }` | The host's own absence: what a caller passes where it passes nothing. |
| `{ "$curly": "unserializable" }` | A value the host's serialization cannot describe. On a host whose serialization follows references, an object holding itself is one. |
| `{ "$curly": "nodes", "count": N }` | A value whose serialization visits at least `N` nodes, holding no cycle. A tree that doubles per level reaches any count in few levels. |

The replacement is by the value's own shape, everywhere in the inputs and at
every depth, and nowhere in the expectations: an expectation names text, and a
tagged value read in one would name something a case cannot state.

Each tag is host-specific by design, which is why it is a tag and not a
literal. A host with no notion of absence, or whose serialization never
follows a reference twice, has its own answer for what stands in, and the set
does not prescribe one.

## The adapter

The adapter is the implementation's side of the contract, and its shape in
another language is that language's business; what it must carry is not.
README.md states it. Three things are worth repeating here, because they are
what a runner reads before it runs anything:

* `levels` selects the fixtures. An adapter must claim `core`.
* `limits` builds the generated cases.
* `unexpressible`, where the adapter supplies it, leaves out the cases whose
  formatting request reads a property the host's facility cannot express.
* `cst`, where the adapter supplies it, is the tree of [`CST.md`](../CST.md):
  the `unit` its spans are counted in, and the call that produces one. An
  adapter that supplies none has the tree cases left out.

A claim outside the vocabulary of sections 2, 11.2 and 13, or of section 4 of
`CST.md` — a level that is not one of the three, a limit that is not a positive
count, a facility the format does not name, a span unit that document does not
name — is an error, and the runner refuses the whole run. It is not a
skip and not a failure: an adapter that cannot say what it satisfies has not
been measured, and a run that reports a number for it reports a number that
means nothing.

## Planning: what runs and what is left out

A case runs where its file's level is one the adapter claims. A case left out
is listed with the reason it was left out, never dropped silently: a set whose
skipped cases are invisible is a set whose coverage cannot be read off the
summary.

Four reasons leave a case out, and no others:

* Its level is one the adapter does not claim, or one the caller excluded.
* It is the `output-over-limit-stops` construction and the Extensions level is
  not running. That construction registers a host-defined modifier, so it
  needs Extensions whatever the level of the file it is written in.
* Its formatting request reads a property the adapter declared it cannot
  express (section 11.2).
* It pins the tree and the adapter offers none. A tree file declares no level,
  because `CST.md` is not one of them; whether the adapter offers a tree is
  what selects its cases.

## Building a generated case

Section 13 states minima and requires an implementation to document what it
permits, so a case at a limit cannot be written out: the runner builds it from
the limits the adapter declared. README.md gives the six constructions, the
message and payload each builds, and what each expects. A runner builds them
from the adapter's own numbers, not from section 13's minima; an
implementation that permits more is exercised at what it documents.

One of the six carries a check the comparison cannot make.
`output-over-limit-stops` registers a modifier on a placeholder past the output
limit and requires that the modifier is never called: an implementation that
resolves the pass and then discards it produces the same text as one that
stopped, and only the call tells them apart. A runner that omits the check
passes both.

## Executing a case

A runner hands the adapter one resolution's inputs and compares what came back,
in this order. The first mismatch is the failure; what follows it is not
reached.

1. **The answer's shape.** An adapter that raised, or answered with something
   that is not a resolution — on a host that has them, a promise of one is not
   — has failed that case, and only that case. A raise from the implementation
   is a result, not an accident: the run continues and the next case is put to
   the same adapter.
2. **The output, or the formatting request.** Below.
3. **The case's own check**, where the construction carries one.
4. **The reports**, where the adapter observes any.

### The output

The output is compared exactly: character for character in the host's own
string unit, with nothing trimmed, collapsed or normalized. Section 8 makes
whitespace significant text, and a runner that trims an output before comparing
it passes an implementation that loses it. This is the single easiest way to
write a runner that measures nothing, because the trimming reads as tidiness.

### A formatting request

A case at the Intl level states a request — the facility, its properties and
its input — rather than the text a host makes of it. Section 11.2 lets an
implementation expose the requests a resolution made, and where the adapter
does, the case is compared on the request and not on the output. That is what
lets an implementation whose locale data is not the runner's conform: the
request is what the specification pins, and the text is what two hosts' CLDR
data would have to agree on.

Where the adapter exposes no request, the runner performs the case's request on
its own host and compares the text. Both readings are correct; they measure
different things, and a runner supports both.

A request is compared by its entries and never by the text a serialization
makes of it, because the order of a request's properties is the host's. A case
that states a request writes the placeholder alone, so the resolution it
describes makes exactly one request: more than one, or none, is a failure.

### The reports

Reports are compared in order. Section 14.3 has an implementation report in the
pass where the condition was met, and section 9 resolves a pass in source
order, so the order is part of what a case pins and comparing them as a set
loses it. The count is compared as written: a report more is a failure, and so
is a report fewer.

A report is compared by its `code`, always. Its `origin`, its `id` and its
`limit` are compared where the adapter's report carries them and the case
expects something of them, because the specification prescribes a report no
shape — only what a code names and which origin it declares. A field the
adapter does not carry is not a failure and not a pass; it is unobserved.

An adapter that supplies no reports at all says the implementation does not
report, which section 14.3 permits: reporting is a SHOULD. Every expectation
about reports is then skipped — and said to be. A case that passed without its
reports checked passed less than one that passed with them, and a runner that
reports the two alike overstates what it measured.

## Executing a tree case

A file whose `kind` is `tree` pins the concrete syntax tree of
[`CST.md`](../CST.md) rather than a resolution. Its cases run wherever the
adapter offers a tree. A runner puts the message to that tree and compares what
came back, in this order; again, the first mismatch is the failure.

1. **The answer's shape.** An adapter that raised, or answered with something
   that is not a `message` node, has failed that case.
2. **The root's span**, which is the whole message.
3. **Every node**, in document order: its kind is one section 6 of that
   document names, its span is a pair of offsets whose `end` is at or after its
   `start`, it lies within the message and within the node that holds it,
   neither boundary falls inside a code point, a name kind carries a `name`,
   and an escape carries `cancels`.
4. **The properties of section 5**: the leaves tile the message in order and
   spell it back.
5. **The case's own expectation**, node by node.
6. **Determinism**: the same message put to the tree again answers the same
   tree.
7. **Agreement**, where the case states `resolves`: the same message put
   through `resolve` produces that output. The tree and the resolution then
   read the same placeholders, which is what property 4 requires and what a
   second scan written separately is how an implementation loses.

The order is what makes a failure legible. A tree whose leaves do not tile the
message is wrong about the message whatever the case says of its nodes, so that
is what the failure names.

Two of those need care in a port.

**A runner reads spans in the unit the adapter declared, and in no other.** A
case states the text a node spans rather than a number, so that one
implementation's unit is not pinned on every other. A runner turns the declared
unit into offsets into the string its own host holds, once per message, and
reads each span through that; where a boundary has no offset, because it falls
inside a code point, the case fails, which is what section 4 requires. An
implementation that counts one unit and declares another fails on the first
message that tells the two apart.

**A tree is a structure the implementation supplies, and nothing stops it
holding itself.** A runner walks it under a bound derived from the message — a
tree describes the message, so it holds no more nodes than the message can
spell — and a cyclic answer fails that case rather than hanging the run.

## Outcomes

A runner answers one of four things for a case, and a summary that cannot say
which is a summary that cannot be acted on:

| Outcome | What it says |
| --- | --- |
| Passed | The output, or the request, and the reports were what the case states. |
| Passed, reports unobserved | The output or the request matched; the adapter observes no reports, so the case's report expectation went unchecked. |
| Failed | The first mismatch, beside what was expected and what came back, and the section the case pins. |
| Skipped | The case was left out, and why. |

A failure names the section, because a failure is a disagreement with a
sentence and the section is where that sentence is, and names the document too
wherever that is `CST.md` rather than the specification — the two number their
sections separately. A failure that only says which case failed makes the
reader find it.

## Auditing the runner

A runner is trusted with a verdict, so it needs a verdict of its own. This
package ships `defects.json`: a catalogue of ways an adapter can be wrong, each
with what a correct runner answers where it is present.
`schema/defect.schema.json` describes the file.

The procedure is the same in any language. Take an adapter that passes the set.
Apply one defect to it — wrap it, so the adapter is correct in every way but
one. Run the set again. A correct runner answers what the catalogue states; a
runner that answers nothing has found a hole in itself.

`expects` says what that answer is:

| `expects` | The runner must |
| --- | --- |
| `error` | Refuse the run: the adapter's claims are outside the vocabulary of sections 2, 11.2 and 13. |
| `fail` | Fail at least one case the same adapter passed without the defect. |
| `skip` | Leave out at least one case it ran without the defect, and fail none. |
| `unobserved` | Pass every case it passed without the defect, and say of at least one that its reports went unchecked. |

A defect that the adapter never gives the runner anything to catch is neither
caught nor missed. An implementation that observes no reports cannot carry a
defect of its reports; one that claims Core alone cannot carry a defect of a
level it does not claim. A defect is **unreachable** where applying it changed
nothing the adapter answers, and an audit that calls those missed sends a port
hunting for holes that are not there. The catalogue is most informative against
an adapter that claims every level its implementation satisfies and observes
what it reports.

The defects are in `defects.json`, a sentence each, in five families: whether
an adapter answers at all (it raises, or answers with nothing), what it answers
for the output (truncated, trimmed), what it answers for the reports (dropped,
added, reordered, each field altered in turn, or withheld entirely), what it
states about itself and about a formatting request, and what it answers for the
tree (a node dropped, a node retyped, a span moved, a name left as the message
spells it, an escape read the other way, and the unit misdeclared or unnamed).
Each defect names the `section` it pins, and a defect of the tree names the
`document` that section is a heading of. Each one pins a decision
a runner makes, and a runner that misses one is a runner making that decision
by not making it.

This package's own runner carries the catalogue as `mutations` and runs it
through `audit`:

```ts
import { audit } from '@curly-message/conformance';

const missed = audit(adapter).filter(({ outcome }) => outcome !== 'caught');
```

`audit` answers one entry per defect: what the catalogue expected, what this
runner observed, and whether that counts as caught, missed or unreachable. It
requires an adapter that passes the set, because a defect is measured by what
it changes and a baseline that already fails changes nothing legible.

## What a runner does not decide

A runner does not decide what the format means. Where a case and an
implementation disagree, [SPEC.md](../SPEC.md) decides which is wrong, and the
answer is a change to the set, to the implementation, or to the document —
never to the runner. A runner that special-cases a case to make it pass has
made the set measure that runner instead of the format.

A runner also does not extend the set. A behaviour the specification leaves to
the host is not a case, and a runner that adds one has made an implementation
non-conformant for doing what the document allows.
