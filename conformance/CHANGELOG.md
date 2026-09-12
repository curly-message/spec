# Changelog

## Unreleased

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
