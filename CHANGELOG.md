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

Nothing a message resolves to changes. What changes is what a document written
against one language left an implementation in another to guess.

* Section 4 no longer defines a plain object in ECMAScript alone. The reading
  is stated as what that test is an instance of — a value of the type a host
  offers for arbitrary keyed data, carrying no meaning beyond the entries it
  holds — and the prototype test stays as what the reading is in ECMAScript. A
  host without prototypes had no rule to read, only one language's spelling of
  it, and two implementations could spell it back differently; section 4.1
  recognizes a wrapper by the same reading, so the guess reached that far too.
* Section 11.2 says that its property names are ECMAScript's vocabulary used to
  describe a request, which a host reads onto its own facility, and says what an
  implementation does with a property its facility cannot express: it formats
  with the properties the facility does express, the placeholder does not take
  the fallback chain over a property, and the implementation documents what it
  cannot express and states it to the conformance set. The section already let
  an implementation expose the request it makes; what it did not say was what to
  do where the request cannot be made in full.
* Appendix A no longer says that nothing has been released against this
  specification. Releases have been made against it since revision 1.0.0. What
  the passage states is unchanged — no ruling in the appendix is a breaking
  change to a released package, and no migration note is owed to any user —
  because the body has carried every ruling since that first revision, so every
  release made against this document already has them.

## 1.0.1

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
