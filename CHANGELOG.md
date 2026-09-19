# Changelog

Revisions of the specification, tagged `v<version>` in this repository. The
major is the version of the format: within one version of it what a message
resolves to does not change, so a revision under that version adds only what
leaves the messages written for it alone — a modifier under a name no earlier
revision
defines, a conformance level an implementation opts into, and wording that
states more precisely what the body already required. That promise is about
messages: what an implementation answers where there is no message to resolve
is outside it.

The conformance set keeps its own changelog under `conformance/`, and releases
on its own line: it may release against a document that has not changed, and
the document may be revised without it moving.

## 2.0.0

**Version 2 of the format. It is not compatible with version 1.**

Message text is syntax, and payload text is data. Version 1 resolved a message
by repeated passes of substitution over the whole current text, so whatever a
payload value contributed was read back as message source on the next pass: a
value could name a payload entry the message never named, add an option to a
construct the message wrote, or close that construct early. Version 2 resolves
a message in one walk and reads nothing it has emitted, and a placeholder nests
where the message spells it nesting rather than where a payload arranges one.

Appendix C of `SPEC.md` is the migration, and lists every change with what each
costs a message written against version 1. In short: stop composing messages
through the payload, stop building a key, an option key or a modifier name out
of it, and stop escaping payload values — those backslashes now render.

* Section 5 is rewritten. A message is resolved in **one walk**: section 6
  parses it once, and the walk emits the message's own text and what section 9
  resolves each placeholder to. The walk reaches the outermost placeholders
  first, and a placeholder written inside an option value is reached only where
  the enclosing placeholder selects the option holding it — so an option the
  modifier passes over is never rendered, nothing in it is resolved, no payload
  entry it names is read, no modifier it names is called, and no report it
  would have made is made.
* Section 6's `value` production admits a placeholder, and two notes are added.
  Note 10 says a placeholder derives inside an option value and nowhere else,
  so a `{{` in a key, an option key or a modifier name opens none; and that a
  `{{` in a value must open a **complete** placeholder or the construct around
  it does not derive at all. Nesting is not otherwise limited. Note 11 says a
  verdict is final — whether a placeholder derives at a position is a function
  of the message and that position alone — which licenses the record that keeps
  the scan linear in the length of the message.
* Section 7 gains **Payload text is not escaped text**. Escape sequences are
  removed once, when the message is parsed, from the message's own text and the
  names it writes, and from nothing else. A value, a props value, a payload
  `default`, a wrapper's `default` and a modifier's answer are data, and a
  backslash any of them carries is a backslash. A serialization therefore
  reaches the output parsable as the conversion made it, where version 1 read
  its backslashes as escape sequences; section 4 says so too, and names the
  one exception: a message is not a value the walk reads but the text the walk
  is over, so what section 5 converted it to is the message's own text and is
  parsed and unescaped like any other.
* Section 8 reads its rules over the **spelling**, before anything is resolved.
  A placeholder an option value holds is content wherever it stands, and the
  text it resolves to is never padding however it is spelled.
* Sections 9.2 to 9.4 and section 11 make an option's value and the inline
  default **lazy**: collecting an option does not read its value, and a value
  and the default reach a modifier unread. What a modifier answers with is
  data, and nothing parses or unescapes it.
* Section 12 is rewritten around nesting the message spells, and says which
  construct a semicolon belongs to.
* Section 13 states **four** limits: output, read, conversion and nesting. The
  **pass limit is gone**, and with it the `pass-limit` report code — one walk
  has no passes, and what the limit held back a payload can no longer do. A
  **read limit** bounds the value text a resolution reads whether or not any of
  it reaches the output. A **nesting limit** of at least eight levels bounds
  resolution and not derivation: a placeholder nested deeper is a message error
  that takes its fallback chain. No limit raises and none ends the walk.
* Section 14.1 adds two properties: **Data is not syntax**, and **Bounded
  work** — an implementation must derive a message in time bounded by a
  polynomial in the length of that message.
* Section 14.2 states **eight** report codes where it stated seven:
  `unknown-modifier`, `missing-options` and `nesting-limit` declare the origin
  `message`; `failed-modifier`, `unserializable-value` and `missing-locale`
  declare `payload`; `output-limit` and `read-limit` declare `limit`.
* Section 14.3 identifies a placeholder for every condition, limits included,
  fixes the order reports are emitted in as **walk order**, and bounds the
  count by the message: at most one report per placeholder per condition.
* Appendix C is added: what changed from version 1.
* `CST.md` revises with the document. An `option-value` node carries children,
  `placeholder` among them, and no longer carries `name`; the name kinds are
  `key`, `modifier` and `option-key`. Agreement and determinism cover every
  level of nesting, and the tree does not depend on a host's nesting limit.

## 1.1.0

Nothing a message resolves to changes. A companion document is added, and what
otherwise changes is what a document written against one language left an
implementation in another to guess.

* `CST.md` is added: a concrete syntax tree for a message, for a tool that
  shows a message rather than resolving it — a highlighter, an editor that
  completes a key, a linter, a formatter. It is a companion to `SPEC.md` and
  adds nothing to the format: sections 6, 7 and 8 already say where every
  character of a message belongs, and the tree only gives that answer a shape
  two implementations can hand to the same tool. It is not one of the
  conformance levels of section 2, and an implementation conforms without
  offering a tree. Section 1 points to it, section 2 of it points at the
  conformance set that holds an implementation to it, and it travels with
  revisions of this document rather than on a line of its own.
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
