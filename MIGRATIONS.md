# Migrating between versions of the format

A version of the Curly Message Format is a version of it because a message or
a payload written against the one before can resolve differently. This document
is the path: what each step changes, what it costs, and what to do about it.

[`SPEC.md`](./SPEC.md) states the current version and nothing else.
[`CHANGELOG.md`](./CHANGELOG.md) records every revision of it, and each entry
that opens a version points back here.

There are two steps, and they are written newest first. Something written
against version 1 takes both, the lower one first.

## Version 2 to version 3

Version 2 read **plain object** narrowly and by the value's own type, so a
value of a keyed type an application declared converted as a string rather than
as JSON. It said nothing of the kind about an array: a value of any array type
serialized. Version 3 holds both shapes to one test (section 4).

Nothing a message spells changes, so **no message needs migrating**. The walk,
the grammar, the escaping, the limits and the tree are version 2's unaltered.

### What changes

| A payload value of | Version 2 | Version 3 |
| --- | --- | --- |
| the host's own sequence type | serializes | serializes |
| a sequence type derived from it | serializes | converts as a string |
| a sequence built in another realm | serializes | converts as a string |
| the host's own keyed type | serializes | serializes |
| a class, a struct, a record | converts as a string | converts as a string |

### What it costs

A payload that passes a value of a derived sequence type where a modifier reads
its JSON back gets the host's ordinary string conversion of it instead: in
ECMAScript a value of a class extending `Array` holding `a` and `b` converts to
`a,b` where it serialized to `["a","b"]`. A caller that wants the serialization
passes the host's own type — copying the entries into one is enough — and a
value that already is one is untouched. An option comparison over such a value
compares that same text, so an option key written against the serialization no
longer matches it.

Which conversion describes a value is also which one may fail to, so a report
can move with it. A value the serialization could not describe — one that holds
itself, or one that visits more nodes than section 13 allows — is one the
string conversion may describe perfectly well, and is a value here where it was
absent and reported; a value whose string conversion raises is absent and
reported here where it serialized. What moved is which conversion is asked:
section 4 treats either failure as absence and section 14.2 reports either, as
both already did.

The parameters a message names and the tree describing it read as they did. The
whole of the cost falls on a payload carrying a sequence that is not of the
host's own type, and on nothing else.

## Version 1 to version 2

Message text is syntax, and payload text is data. Version 1 resolved a message
by repeated passes of substitution over the whole current text, so whatever a
payload value contributed was read back as message source on the next pass.
Version 2 resolves a message in one walk and reads nothing it has emitted, and
a placeholder nests where the message spells it nesting rather than where a
payload arranges one.

In short: stop composing messages through the payload, stop building a key, an
option key or a modifier name out of it, and stop escaping payload values —
those backslashes now render. Everything below follows from that one change.

### What a payload can no longer do

| A value carrying | Version 1 | Version 2 |
| --- | --- | --- |
| `{{apiKey}}` | read that payload entry | renders `{{apiKey}}` |
| `; live:DELETED` | added an option to the construct around it | renders as text |
| `}}` | closed the enclosing construct early | renders as text |
| `{{` | kept the enclosing construct from deriving | renders as text |
| `\;`, `\:`, `\\` | the backslash was removed | renders as written |
| a trailing `\` | it escaped the next message character | renders as written |

```curly
{{state:eq; draft:{{note}}; live:Published; default:?;}}
```

Over `{ state: 'live', note: 'X; live:Leaked' }` version 1 rendered `Leaked`
and version 2 renders `Published`. Version 1 substituted the payload's text
first, and the option that text wrote outranked the one the message spelled;
version 2 never reads `note` at all, because the option holding it was not the
one selected.

The same holds of a props value, a payload `default`, a wrapper's `default` and
a modifier's answer. A caller that escaped its payload values to protect them
from the format must stop: those backslashes now render.

### What a message can now do

A placeholder may hold a placeholder in an
option value. In version 1 such a construct was not a placeholder at all — the
inner one resolved first and the outer was scanned again on a later pass, over
text the payload had a hand in. Most such messages rendered correctly and still
do, but three things change for them:

- An option the modifier passes over is no longer evaluated. A placeholder in
  it is not resolved, a modifier it names is not called, and a report it would
  have made is not made.
- The enclosing key is now extractable. A tool reading a message statically
  reports every key it names, nested and enclosing alike, where version 1 could
  see only the innermost.
- What the message renders no longer depends on what the payload happens to
  contain.

### What breaks

A `{{` in a **key**, an **option key** or a **modifier name**
opens no placeholder, and the construct around it does not derive. Version 1
resolved the inner construct and then re-read the result as a placeholder, so
these rendered:

```curly-example
{{a; {{b}}:x;}}    payload { a: 'k', b: 'k' }    v1 "x"    v2 "{{a; k:x;}}"
{{a:{{m}};}}       payload { a: 'A', m: 'eq' }   v1 ""     v2 "{{a:eq;}}"
```

Both were a payload choosing a message's structure, which is what version 2
exists to stop. A message that wrote either must name its key, its option key
and its modifier itself.

An option value that resolves to nothing but whitespace is no longer trimmed
away, because whitespace is read over the spelling: `{{a; x:{{b}};}}` over a
`b` of three spaces renders three spaces where version 1 rendered none.

### Limits and reports

The **pass limit** is gone, and so is the `pass-limit`
report code; an implementation that emits it does not conform to version 2 or
later. A **read limit** and a **nesting limit** take its place, with the codes
`read-limit` (origin `limit`) and `nesting-limit` (origin `message`), so the
vocabulary is eight codes where it was seven. The **output limit** no longer
discards a pass whole: a placeholder whose result would carry the output past
it resolves to the empty string and the walk carries on, so the message's own
text still renders. A condition is reported at most once per placeholder, a
placeholder the walk never reaches is never reported, and reports are emitted
in **walk order** — version 1 ordered them by the pass that met the condition
and then by source position, so a report from a placeholder the payload had
written could precede one the message spelled. There are no passes to order by
now.
