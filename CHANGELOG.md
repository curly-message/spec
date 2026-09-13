# Changelog

Revisions of the specification, tagged `v<version>` in this repository. The
major is the version of the format: within `curly-message-1` what a message
resolves to does not change, so a revision under it adds only what leaves the
messages written today alone — a modifier under a name no earlier revision
defined, a conformance level an implementation opts into, and wording that
states more precisely what the body already required. That promise is about
messages: what an implementation answers where there is no message to resolve
is outside it.

The conformance set keeps its own changelog under `conformance/`, and releases
on its own line: it may release against a document that has not changed, and
the document may be revised without it moving.

## Unreleased

The message's key is the message's **id**, and it names the message for
diagnostics only: reports carry it (section 14.3) and no step of resolution
reads it.

* The chain a message that does not exist took — the payload's own `default`
  entry, then the key echoed verbatim — is gone. A caller that supplies no
  message has supplied nothing to resolve, and the resolution is the empty
  string (section 4). What a host shows where its catalogue holds no message is
  the host's own, which section 1 already declined to specify along with the
  catalogue itself, and a host that shows the identifier keeps it out of
  resolution by construction.
* Ruling A.17 is revised rather than dropped. The divergence it records is the
  key being resolved over instead of echoed; the echo it ruled for is what this
  revision removes, and the entry now says what an implementation written
  against revision 1.0.0 does differently.
* What `curly-message-1` settles is stated more precisely in the header: the
  promise is about messages, and a caller that supplied none wrote nothing for
  the document to settle. Every message that exists resolves exactly as it did
  under revision 1.0.0 — the change is observable only where a caller supplies
  no message at all.
* Section 2 no longer says the conformance set is unpublished. It is released
  from this repository.

## 1.0.0

First stable revision. `SPEC.md` states version 1 of the Curly Message Format:
the grammar, the escaping and whitespace rules, the order a message resolves
in, the modifiers and what each one answers, the fallback chain, the error
behavior, the conformance levels an implementation claims, and the adapter the
conformance set drives an implementation through. Appendix A records each
divergence found while the document was written against the pre-3.0 reference
parser, together with the ruling that resolved it.
