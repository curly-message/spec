# Changelog

### 4.2.0 (Unreleased)

The set gains one construction, a chain of inline defaults nested far past the
nesting limit, which an implementation resolves however deeply it nests. It
also stops pinning what the specification leaves to the host, pins what it
settles and no case stated, and says what a runner on a host other than
ECMAScript does with it. Nothing a message resolves to changes.

* `limits/nesting-chain-over-limit`, built from the adapter's declared nesting
  limit like the other limit cases, nests `{{v; default:` twenty thousand levels
  past it around the text `x`. Section 13 says no limit raises: each refused
  placeholder takes its chain, which ends at its inline default, so the message
  resolves to `x` with twenty thousand `nesting-limit` reports of origin
  `message`, one per refused level. The generator is `nesting-chain-over-limit`,
  added to the schema's enum and to the exported `Generator` type.
* `resolution/wrapper-near-miss-is-value` wrote its object's members as
  `value`, then `unit`, and expected them serialized in that order, which is
  ECMAScript's insertion order: a host that writes a mapping's members sorted
  failed it for a serialization section 4 leaves to the host. The case now
  writes `{"unit":"kg","value":1}`, on which insertion and code-point order
  agree, and still pins that an object owning a key beside the wrapper keys
  serializes whole. *Writing a fixture* in the README gains the rule.
* `comparisons/infinity-compares` leaves the set. It wrote an infinity as the
  text `Infinity`, which is ECMAScript's literal: whether a text converts to an
  infinity is the host's numeric conversion (section 11.2), and a host that
  reads no such literal takes the chain over it. That a numeric comparison
  still compares an infinity stays the specification's rule; no case states it
  in one host's spelling.
* `comparisons/nan-key-is-not-numeric` pins that a key whose conversion
  yields NaN is not numeric (section 11.1): `{{v:lt; 10:A; NaN:N; 5:B;
  default:D}}` over `"3"` renders `B`. A host whose conversion reads `NaN`
  as a number could order such a key among the numeric ones, where every
  comparison with it is false and the sort leaves `10` ahead of `5`, and no
  case wrote such a key.
* The runner compares a request's numbers with the sign of zero. It compared
  them as JSON writes them, where `-0` and `0` are one, so an implementation
  that dropped the sign section 11.2 applies to a count of zero, making a
  request that reads `in 0 seconds` where the delta was in the past, passed
  on its request.
  `intl/ago-negative-under-half-second` pins the sign: a delta of -499 under
  `numeric: 'always'` asks for `[-0.0, "second"]`, written so that a decoder
  reading `-0` as an integer keeps the sign. RUNNER.md says so.
* The defect `tree-unit-changed` declares a unit other than the adapter's own.
  It declared code points whatever the adapter counted in, which alters
  nothing for an adapter counting code points, so on such a host the audit
  never measured how its runner reads a misdeclared unit and called the
  defect unreachable. A code-point adapter is now misdeclared as UTF-16, and
  every other one as code points, as before; `defects.json` describes it so,
  and RUNNER.md says a defect is realized as it reads for the adapter in
  hand. The audit's example in the README and RUNNER.md lists the defects
  `missed`, where it listed every one not `caught`, the unreachable among
  them.
* RUNNER.md states what a runner on a typed host does: the adapter states its
  stand-in for the `undefined` tag, and where it states none the runner leaves
  out what holds the tag, which reads alike everywhere but in a wrapper owning
  that member alone; a case may be decoded into a neutral value the adapter
  maps; an implementation whose ids are text hands an id of another shape on
  as none, which no expectation observes; an `unexpressible` or a `cst` its
  adapter cannot leave out and states empty is no claim, while an empty list
  of reports or of requests is measured as it stands; a runner may rely on a
  release's files holding to the schema and repeating no key in an object,
  and checks files from anywhere else for both, by hand where it has no
  schema validator, which the JavaScript runner's `load` and `--fixtures`
  leave to the caller; and one that reads the release's archive checks it
  against its digest. The set's tests now fail where an object of a JSON file
  the package ships, a fixture file, `index.json`, `defects.json` or a schema,
  repeats a key, which `JSON.parse` hid by keeping the last member.
* The README's catalogue spells two behaviours for every host. `props` writes
  each value as ECMAScript's `JSON.stringify` writes it, so a whole number
  reads `1` and not `1.0` whatever type an implementation hands it on as, and
  `nothing` answers what the implementation reads as an answer that is nothing
  at all.

## 4.1.0

The set gains the plural selections of revision 3.1.0 of the specification,
`plural` and `ordinal`, and the one kind of request they make: a request whose
result is a category rather than text.

* `fixtures/plural.json` pins section 11.5 at the Intl level: the cardinal
  categories of Russian, Polish, Arabic, Czech, Latvian, French and English;
  the ordinal ones of English, Swedish, Italian, Welsh and Czech; a number
  winning over a category wherever it is written; keys that are neither; the
  fallback chain where nothing is selected; the locale tested first; the digits
  `plural` reads from `number`, from every layer, beneath its own; the rule type
  pinned; a fraction refused by `ordinal`; and a selection declaring no option
  as a message error.
* A case at the Intl level may state a `PluralRules` request. Its result on the
  running host is a category, and the case names the output each of the six
  categories selects under `categories`, so the choice of option is pinned and
  the category stays the host's. An adapter that exposes its requests exposes a
  selection request with the `category` its host answered, and the output is
  held to the one the case names for it.
* `extensions.json` pins a host's own `plural`: it replaces the format's, is
  handed the props under its own name alone, and is no message error declaring
  no option.
* Four cases of `grammar.json` and `reports.json` named `plural` as a modifier
  nobody registered. The name is now defined, so they name `duration`.

## 4.0.1

Nothing a case states changes: every input, every expected output and every
report is the one 4.0.0 shipped. What changes is where twenty-five of them
point, the heading they pointed at having left the specification.

* Twenty-five cases of `grammar.json` and `whitespace.json` pinned a ruling —
  `section: "A.10"` and the like — as the section they test. A case's section
  is a heading of the specification, and the specification now keeps its
  rulings in a document of its own, so the pins go. Both files already pin a
  section — 6 and 8 — and neither has a subsection to name more precisely, so
  each of the twenty-five reports its file's instead. They were the only pins
  in the set that named a ruling rather than a rule; the other 551 name a
  section of `SPEC.md` or of `CST.md` and are untouched.
* Twelve descriptions in `fallback-intl.json`, `intl.json` and
  `resolution.json` name the rulings they cite as rulings rather than as
  appendix entries.

## 4.0.0

The set targets `curly-message-3`. A runner that reads only `curly-message-2`
refuses it rather than skipping it, which is why this is a major release even
though no case changed.

* Every fixture file, the manifest and the defect catalogue declare
  `curly-message-3`, and both schemas hold them to it.
* **No case changed.** What version 3 revises is which values serialize as
  JSON (specification, section 4): a value of a sequence type an application
  derived, or one built in another realm, converts as a string where it used to
  serialize. A case's inputs are JSON and its expectations are text, so neither
  value can be written down, and neither conversion has a text a case could
  state without pinning one host's string conversion on every other. The narrow
  reading of a plain object, which the document has carried since revision
  1.0.0, is absent from the set for the same reason. An implementation that
  passed the set against version 2 passes it against version 3, and the set
  does not measure what version 3 changed.
* What the set still pins is the half that did not move: a value of the host's
  own sequence type serializes, its serialization is what reaches the output,
  and it is that text an option comparison sees.

## 3.0.0

The set targets `curly-message-2`. Version 2 resolves a message in one walk
over its own text, so every case that turned on a payload value being read as
syntax states the opposite now, and the limits are four rather than three.
An implementation that passes version 1 of the set does not pass this one.

* Every file targets `curly-message-2`, and a runner that reads only
  `curly-message-1` refuses the set rather than skipping it.
* An adapter declares four limits — `output`, `read`, `conversion` and
  `nesting` — in place of `passes`, `output` and `conversion`, and the
  generated constructions are eight rather than six: each limit is built at
  its bound and one past it. Each construction spends one budget alone, so a
  case built at one limit cannot be failed by another.
* The report codes `output-limit` and `pass-limit` become `output-limit`,
  `read-limit` and `nesting-limit`. A nesting limit is a defect of the
  message, so its report declares the `message` origin; the other two declare
  `limit`.
* `output-over-limit-stops` is gone, and with it the one check the comparison
  could not make: a result the output has no room for is now the empty string
  and what follows it still resolves, which is observable in the output.
  A case is left out for three reasons rather than four.
* `fixtures/nesting.json` and `fixtures/escaping.json` are rewritten around
  the rule that a value is data: a placeholder a payload value spells is text
  the output carries, and nothing unescapes a value. `fixtures/grammar.json`
  pins where a placeholder derives — inside an option value and nowhere else
  — and that a refused construct resumes the scan at the very next code point.
* `fixtures/reports.json` pins the walk order of section 14.3: where neither
  of two reporting placeholders holds the other, the one the message writes
  first reports first, and where one holds the other, the inner reports while
  the outer's value is being read.
* `fixtures/cst.json` states no `name` on an `option-value`: a value answers
  to nobody, so it carries the subtree the message spells and no string to
  compare. The runner compares a name on `key`, `modifier` and `option-key`.

## 1.1.0

Two things a set written in one language could not give an implementation in
another: the request a locale-dependent case pins, and a way to tell whether the
runner reading the set is reading it right. The set also reaches a second
document, `CST.md`, which until now had nothing holding an implementation to it.

* `fixtures/cst.json` pins the concrete syntax tree of `CST.md`: the nodes an
  implementation that offers a tree describes a message with. A file declares
  `kind: "tree"` and no level, because that document is not one of the
  conformance levels of section 2; its cases run wherever the adapter offers a
  `cst` and are left out, with that reason, wherever it does not. A case states
  the text a node spans rather than a number, so an implementation is measured
  in the unit it declares rather than in the one the set was written in — which
  is what makes that declaration observable at all.
* An adapter MAY offer `cst`: the unit its spans are counted in and the call
  that produces a tree. A unit outside the three `CST.md` names is an error
  rather than a skip, the way an unknown level is.
* The catalogue gains a fifth family, the defects of the tree: a node dropped,
  a node retyped, a span moved, a name left as the message spells it, an escape
  read the other way, and the unit misdeclared or unnamed. A defect now names
  the `document` its section is a heading of, where that is not `SPEC.md`.

* An adapter MAY answer with `formats`, the formatting requests the resolution
  made — what section 11.2 has always permitted an implementation to expose and
  the contract had no field for. A case that states a request compares that
  request where the adapter supplies one, so a host whose CLDR data differs from
  the runner's is measured on what the specification pins rather than on text
  only the two hosts' data could agree on.
* An adapter MAY declare `unexpressible`, the formatting properties its host's
  facility cannot express, under the request that reads them. Every case whose
  request reads one is skipped rather than failed.
* `RUNNER.md` states what a runner is held to, so a second one can be written
  against the contract rather than against a reading of this package's source:
  what it decodes, what it plans, the order it compares in, what it leaves out
  and why, and what it does not get to decide.
* `defects.json` is the catalogue a runner is audited with: ways an adapter can
  be wrong, each with what a correct runner answers where it is present. A
  runner that compares nothing passes every implementation and reports the same
  summary either way, and until now nothing said so. `schema/defect.schema.json`
  describes the file; `defects()` reads it, `mutations` carries it, and `audit`
  runs it against an adapter that passes the set and answers, defect by defect,
  whether this runner caught it, missed it, or was never given anything to
  catch.
* The release archive carries the catalogue, both schemas and both documents
  beside the fixtures, so a language npm does not reach gets the whole contract
  rather than the data alone.
* A fixture file targeting a format this set does not read is refused rather
  than run, which is what `RUNNER.md` says a runner does. `--fixtures` may point
  at a set of another version, and a run over one this set could not read was
  reported as a run that passed.

## 1.0.1

Targets revision 1.0.1 of the specification, where the message's key became the
message's **id** and stopped reaching the output.

* A case names the message's id under `messageId` rather than `key`, spelled out
  because a case's own `id` names the case, and an expected report names it
  under `id`. An adapter is handed `id` in place of `key`.
* The cases for the chain a missing message took are gone, and section 4's
  cases say what replaces it: a message the caller did not supply resolves to
  the empty string, whatever the payload's `default` holds, and nothing is read
  or reported on its account. An id carrying a placeholder is neither echoed nor
  resolved over, because no step of resolution reads it.
* The release carries the set as `conformance-<version>.zip` — the fixtures,
  the manifest and the schema — so an implementation in a language npm does not
  reach has the same files the runner reads.

## 1.0.0

First stable release. The set targets `curly-message-1` — version 1 of the
Curly Message Format, which the specification states is stable — so what a
fixture expects is settled with it.

* The key of an expected report is text. A tagged value is read on a case's
  inputs and never in its expectations, so one written in an expectation would
  have been compared as the object it is spelled as; the schema now rules it
  out, and a case whose key is not text leaves the key unobserved.
* A case for what a host-defined modifier receives as its locale where the
  caller supplied an empty one, which section 11.3 now states.

## 1.0.0-next.2

* The version bump regenerates the manifest, so `index.json` cannot fall
  behind `package.json` the way the shipped `1.0.0-next.1` does.

## 1.0.0-next.1

Initial version line for `@curly-message/conformance`.

* The fixture set: implementation-independent cases, each the inputs one
  resolution takes and the output and reports it must produce, grouped by the
  section of the specification they pin and marked with the conformance level
  that requires them.
* A JSON Schema for the fixture files and a manifest listing them, so a runner
  in any language validates the set before it reads it.
* A JavaScript runner that drives an implementation through the adapter of
  section 14.3, computes the locale-dependent expectations on the host it runs
  on, derives the cases that sit at the limits the adapter declares, and reports
  what passed, failed and was skipped; usable from a test suite or from the
  `curly-message-conformance` command.
