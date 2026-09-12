# Changelog

Revisions of the specification, tagged `v<version>` in this repository. The
major is the version of the format: within `curly-message-1` what a message
resolves to does not change, so a revision under it adds only what leaves the
messages written today alone — a modifier under a name no earlier revision
defined, a conformance level an implementation opts into, and wording that
states more precisely what the body already required.

The conformance set keeps its own changelog under `conformance/`, and releases
on its own line: it may release against a document that has not changed, and
the document may be revised without it moving.

## Unreleased

First stable revision. `SPEC.md` states version 1 of the Curly Message Format:
the grammar, the escaping and whitespace rules, the order a message resolves
in, the modifiers and what each one answers, the fallback chain, the error
behavior, the conformance levels an implementation claims, and the adapter the
conformance set drives an implementation through. Appendix A records each
divergence found while the document was written against the pre-3.0 reference
parser, together with the ruling that resolved it.
