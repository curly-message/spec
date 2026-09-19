# Changelog

### 1.1.0 (Unreleased)

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
