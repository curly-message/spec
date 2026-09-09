# Changelog

## Unreleased

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
