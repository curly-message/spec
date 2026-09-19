# Curly Message Format: the concrete syntax tree

A message of the [Curly Message Format](./SPEC.md) is text with placeholders in
it. Resolving one answers what it renders as. This document answers a different
question — where the parts of the message are — and gives that answer a shape
two implementations can hand to the same tool.

Anything that shows a message rather than resolving it needs that answer: a
syntax highlighter, an editor that completes a payload key, a linter that
reports a modifier nobody registered, a formatter. Today each such tool writes a
grammar of its own, and the places it gets wrong are the places the format is
hardest — a brace a backslash consumed, a colon that is content rather than a
separator, a placeholder written inside another's option value. Those are
settled in sections 6 and 7 of the specification. A tool should be able to read
them off an implementation instead of re-deriving them.

```
Hi {{name; default:you;}}

message  [0,25)
├─ text         [0,3)    "Hi "
└─ placeholder  [3,25)
   ├─ open         [3,5)    "{{"
   ├─ key          [5,9)    "name"
   ├─ separator    [9,10)   ";"
   ├─ space        [10,11)  " "
   ├─ option-key   [11,18)  "default"
   ├─ separator    [18,19)  ":"
   ├─ option-value [19,22)  "you"
   ├─ separator    [22,23)  ";"
   ├─ option-key   [23,23)  ""
   └─ close        [23,25)  "}}"
```

## 1. Scope

This document specifies a **concrete syntax tree** for a Curly message: a
description of the message as it is written, in which every part of the text
has a place.

It is a companion to [`SPEC.md`](./SPEC.md) and adds nothing to the format.
Section 6 of that document is a grammar over the message string, section 7 an
escaping rule over the same string, and section 8 says which of its whitespace
is padding; together they already say where every character of a message
belongs. This document only gives that answer a shape.

It does not specify a host API: how a tree is asked for, what a binding names
it, or how it is held in memory are questions for an implementation. Section 8
of this document gives an interchange encoding, for fixtures and for tools that
cross a process boundary; nothing requires an implementation to hold a tree
that way.

Throughout, a bare *section N* is a section of [`SPEC.md`](./SPEC.md). Where
this document means one of its own, it says so.

## 2. Conformance

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**
and **MAY** are to be interpreted as described in RFC 2119.

This document is **not** one of the conformance levels of `SPEC.md` section 2.
An implementation conforms to the format without offering a tree at all, and
one that offers a tree is not thereby more conformant. An implementation that
states it offers the Curly concrete syntax tree MUST produce the tree specified
here.

An implementation MUST derive the tree from the same scan it resolves a message
with, or MUST otherwise establish that the two agree (property 4 below). A
second scan, written separately, is the divergence this document exists to
prevent.

The [conformance set](./conformance) carries the fixtures that hold an
implementation to this document: a message, the nodes the tree describes it
with, and — where the two readings of it can be compared — what it resolves to.
A case states the text a node spans rather than a number, so an implementation
is measured in the unit it declares rather than in one the fixtures chose.

**Status.** This revision describes version 2 of the format
(`curly-message-2`). It is not the tree the revision before it specified: an
option value now holds children rather than a name, and appendix C of
[`SPEC.md`](./SPEC.md) says what else moved with it.

This document is settled against one implementation. Until a second
offers a tree, a node name or an arrangement MAY change in a revision of it;
the properties below are what will not, because they are the reason to have a
tree at all. Revisions travel with revisions of `SPEC.md` and are recorded in
the same [`CHANGELOG.md`](./CHANGELOG.md); a revision that changes only this
document changes nothing about what a message resolves to, and so does not
touch the version of the format.

## 3. Concrete, not abstract

The tree is **concrete**: it describes the source text. There is no abstract
tree to offer instead, and that is the format rather than an omission.

An abstract tree would keep what a message means and drop how it is written.
For a Curly message there is nothing left to keep. What a placeholder renders
as is a question for a payload, a locale and a registry (section 5 of the
specification), none of which the message carries; drop the spelling and what
remains is a key, which is the spelling. The tree does have a shape — a
placeholder derives inside an option value (section 6, note 10) — but it is the
shape the message writes, not one resolution computes.

What a tree can carry is the spelling, which sections 6, 7 and 8 define —
section 8 included, because which characters are padding is a fact about how
the message is written. Nothing from section 9 on is here, and the last section
of this document says what that leaves out.

## 4. Spans

Every node carries a **span**: a half-open range `[start, end)` over the
message, where `0` is the start of the message and `end` may equal `start`.

The unit is whatever an implementation's string type is indexed by, so that a
caller can slice the message it already holds. An implementation MUST state
which unit it uses. Whatever the unit:

- A span boundary **MUST NOT** fall inside a code point. Where a string is
  indexed by UTF-16 code units, no boundary may fall between the halves of a
  surrogate pair.
- A node's `end` **MUST** be greater than or equal to its `start`.

The grammar of section 6 is defined over code points, and a boundary inside one
would describe a character the message does not contain.

## 5. Properties

These five hold for every tree of every message, and are what a consumer may
rely on.

1. **Tiling.** Every part of the message lies in exactly one **leaf** — a node
   with no children. Leaves do not overlap and leave no gap.

2. **Order.** The leaves appear in the order the message writes them: each
   leaf's `start` equals the previous leaf's `end`, the first leaf starts at
   `0`, and the last ends at the end of the message.

3. **Reconstruction.** Concatenating the leaves' text spells the message back,
   exactly. A consumer may therefore walk the leaves and emit one span per
   leaf without tracking a position of its own.

4. **Agreement.** The `placeholder` nodes are the constructs section 6 derives
   as placeholders — the same set, at the same extents, as the ones resolution
   walks, at every level of nesting. An implementation whose tree names a
   placeholder its resolution does not derive, or misses one it does, is wrong
   about one of the two. A placeholder in an option no modifier selects is
   still derived and still described: which option is selected is not a fact
   about the message (property 5).

5. **Determinism.** The tree is a function of the message alone. It MUST NOT
   depend on a payload, on props, on a locale, or on which modifiers the host
   has registered. Nor on a limit: the nesting limit of section 13 bounds
   resolution and not derivation, so a message nested deeper than a host will
   resolve still has the tree its spelling gives it, and two hosts configured
   differently describe it alike. A name is a name whether or not a modifier
   answers to it (section 6, note 7 of the specification).

## 6. Nodes

A node has a kind, a span, and — for some kinds — children or a further field.

| Kind | Occurs | Carries |
| --- | --- | --- |
| `message` | the root | children: `text`, `escape` and `placeholder` |
| `text` | the message, a name, an option value | characters with no structural meaning where they stand |
| `escape` | the message, a name, an option value | a backslash and the character it consumes, and `cancels` |
| `placeholder` | the message, an option value | children: the kinds below, in the order the message writes them |
| `open`, `close` | a placeholder | the `{{` and the `}}` that delimit it |
| `separator` | a placeholder | a `:` or a `;` that divides |
| `space` | a placeholder | blank padding a name or a value is read without (section 8) |
| `key`, `modifier`, `option-key` | a placeholder | `name`, and children: `text` and `escape` |
| `option-value` | a placeholder | children: `text`, `escape` and `placeholder` |

`key`, `modifier` and `option-key` are together the **name** kinds. An
`option-value` is not one of them: its text is message text rather than a name,
and section 7 of this document says what follows from that.

### 6.1 The message

A `message` node spans the whole message and its children are, in order, the
`text` and `escape` nodes of the text between placeholders and the
`placeholder` nodes themselves.

A construct that section 6 does not derive as a placeholder contributes no
`placeholder` node. Its characters are text like any other, and an escape
sequence inside it is an `escape` node like any other. A construct enclosing
one that does not derive is one of those, and so is a construct whose own
closing pair never arrives — in which case a placeholder it encloses may
stand on its own, because the scan resumes one code point after the opening
brace (section 6, note 7). Appendix A.9 below works that case through.

### 6.2 A placeholder

A `placeholder` node spans from the first character of its opening pair to the
last of its closing pair. Its children are, in order:

1. `open`, spanning the opening pair.
2. The selector: a `key` name, and where the selector holds an unescaped colon,
   a `separator` for that colon followed by a `modifier` name. The colon is the
   first one no escape sequence claims, and the modifier name runs to the end
   of the selector, so a later colon is part of the name (section 6, note 3).
3. For each segment the placeholder declares: a `separator` for the `;` that
   opened it, an `option-key` name, and where the segment holds an unescaped
   colon, a `separator` for that colon followed by an `option-value`. As with
   the selector, the colon is the first unclaimed one and the value runs to the
   end of the segment (section 6, note 4) — which is the first `;` that no
   escape sequence claims and no placeholder in the value encloses (section 6,
   note 5).
4. `close`, spanning the closing pair.

Every segment the grammar derives is described, including an empty one. A
placeholder written `{{name; default:you;}}` declares two segments, because
`{ ";" , segment }` derives one after each semicolon, and the second is empty:
it contributes a `separator` and an `option-key` of no width. That surprises,
and it is what the message says.

A segment that states no value contributes no `option-value` node: the segment
stands for its own key (section 9.4), and the key is where the message writes
it.

Each name and each option value is preceded and followed by a `space` node
wherever section 8 drops padding there, and by none where there is none to
drop. The padding is nodes of its own rather than width the part quietly
covers, so that what is dropped is said rather than omitted. Section 8 decides
that over the spelling, so blank inside a value is padding only where the
message writes it outside every placeholder the value holds.

### 6.3 A name

A name node spans the name **without** its padding, and carries:

- `name`: the span unescaped (section 7).
- children: the `text` and `escape` nodes the span is spelled with.

A name holds no `placeholder` node. Section 6, note 10 derives one inside an
option value and nowhere else, so a `{{` in a key, in a modifier name or in an
option key is text there, which is what keeps all three readable without a
payload.

A name may be empty, and an empty name still has a position: a placeholder that
names no key carries a `key` node of no width where the key would be. Where a
name's whole span is padding, the name node is empty and anchored at the
**start** of that span, and one `space` node follows it. That anchoring is a
convention of this document rather than something section 8 decides; it is
fixed so that a name node's `start` is always where its part begins.

### 6.4 An option value

An `option-value` node spans the value **without** its padding, and carries
children: the `text`, `escape` and `placeholder` nodes the span is spelled
with, divided as section 6.5 below divides the message.

It carries no `name`. A name is a string a consumer compares or hands back
(section 7 below); an option value is message text, and message text with a
placeholder in it is not a string — it is the subtree. A consumer that wants
the value's literal text where it holds no placeholder reads its `text` and
`escape` children, which is the walk it already does for the message.

A value may be empty, and an empty value still has a position, anchored where
section 6.3 anchors an empty name. A segment that states no value contributes
no `option-value` node at all (section 6.2 above).

### 6.5 Text and escape sequences

Within the message, within a name and within an option value, the characters no
child placeholder claims are divided into `text` and `escape` nodes. An
`escape` node spans a backslash and the character it consumes; everything else
is `text`.

A backslash consumes a **character**, which is a code point (section 6). Where
a string is indexed by UTF-16 code units, an escape sequence before a character
outside the basic multilingual plane therefore spans three units, not two.

A backslash with nothing left to consume — one at the end of the message —
consumes nothing and is `text` (section 6, note 7).

An `escape` node carries `cancels`, which says which of section 7's two
readings the sequence takes:

- `true` where the backslash cancels a structural meaning, so that removing the
  sequence leaves the character alone. That is a backslash before `:`, `;`,
  `{`, `}`, `\` or any member of the whitespace class of section 6.
- `false` where the character has no structural meaning there, so the backslash
  denotes itself and both characters stand — `\d`, `\a`.

A consumer that colors the two alike is wrong about one of them.

## 7. Names and what they answer to

`name` is the span unescaped, and the children are how the message spells it,
so `{{my\;key}}` carries a `key` whose `name` is `my;key` and whose children
are a `text`, an `escape` and a `text`.

Section 7 of the specification draws a line through the parts of a placeholder,
and a consumer that feeds one back to the format has to know which side it is
on:

- A `key` and a `modifier` are **matched by name** against something a host
  wrote — a payload entry, a registered modifier — by code-point equality after
  unescaping (section 6, note 2). An `option-key` is unescaped the same way,
  though it looks nothing up: it is compared against the value, by the modifier
  that performs the comparison.
- An `option-value` answers to nobody, and is not a name. It is message text:
  its escapes are removed when the message is parsed, and a placeholder written
  in it derives (section 6, note 10). So it carries no string to compare — it
  carries the subtree — and a consumer that wants to show what the option
  renders as walks that subtree rather than reading a field.

The line matters in the other direction too. What a modifier answers with, and
what a payload entry holds, is **data**: section 5 never reads it as message
text, so none of it is described here. This document describes the message and
nothing that reaches it from outside.

## 8. Interchange

Where a tree crosses a process boundary — a fixture, a language server, a
cache — it is encoded as JSON. A node is an object:

| Field | On | Value |
| --- | --- | --- |
| `type` | every node | the kind, spelled as section 6 spells it |
| `start`, `end` | every node | the span, as numbers |
| `nodes` | `message`, `placeholder`, a name, `option-value` | the children, in order, possibly empty |
| `name` | a name | the span unescaped |
| `cancels` | `escape` | `true` or `false` |

A node carries no field its kind does not take. An `option-value` therefore
carries `nodes` and no `name`; a decoder that expects a `name` there is reading
the version 1 encoding. An encoder MUST state the unit its spans are in,
because the encoding does not carry it.

The message `\{world` — a cancelling escape and five characters of text —
encodes as:

```json
{
  "type": "message", "start": 0, "end": 7,
  "nodes": [
    { "type": "escape", "start": 0, "end": 2, "cancels": true },
    { "type": "text", "start": 2, "end": 7 }
  ]
}
```

## 9. What the tree does not say

Nothing from section 9 of the specification on is here. The tree does not say
which placeholder binds to which payload entry, what an option selects, what a
modifier answers with, which fallback a placeholder takes, or what the message
renders as. None of it is a property of the text, and a tool that needs it is
asking for a resolution rather than a description.

Nor does it say which of its placeholders resolution reaches. A placeholder in
an option a modifier passes over is described exactly like one in the option it
selects, and a message nested deeper than the host resolves is described to the
bottom: which option is selected, and how deep a host will go, are not
properties of the text (property 5).

The tree also does not say whether a name is one the host knows. A `modifier`
node carries the name the message wrote; whether a modifier answers to it is a
question for the registry, and a consumer that wants to report an unknown one
compares the `name` itself (property 5).

## Appendix A: worked examples

Spans are in UTF-16 code units. Only the parts each example is about are
spelled out.

### A.1 A placeholder inside another

```
{{count:gt; 0:{{count:number;}}; default:no;}}
```

One `placeholder` `[0,46)`, with `key` `"count"`, `modifier` `"gt"` and three
segments, the last of them empty. The first declares `option-key` `[12,13)`
`"0"` and `option-value` `[14,31)`, whose one child is the `placeholder`
`[14,31)` that fills it exactly. The `;` at 28 divides that inner placeholder
rather than the segment around it (section 6, note 5); the segment ends at the
`;` at 31.

Resolution derives the same two placeholders at the same extents, so a
highlighter shows what the message does.

### A.2 A brace a backslash consumed

```
\{{v}}      no placeholder: escape [0,2), text [2,6)
{{v\}}      no placeholder: text [0,3), escape [3,5), text [5,6)
{{v\}}}     one placeholder [0,7), key "v}"
```

The backslash takes one brace and the brace left over stands alone, so the pair
never forms (section 6, note 6). In the third, the backslash takes the first
`}` and the remaining two close the placeholder, so the key ends in a brace.

### A.3 A colon that is content

```
{{a:b:c; d:e:f;}}
```

`key` `"a"`, `modifier` `"b:c"`, then a segment with `option-key` `"d"` and
`option-value` `"e:f"`, then the empty segment the final `;` opens. Each
construct's colon is its first unclaimed one and everything after it runs to
the end (section 6, notes 3 and 4).

### A.4 Padding

```
{{ v : number ;}}
```

`space` `[2,3)`, `key` `[3,4)`, `space` `[4,5)`, `separator` `[5,6)`, `space`
`[6,7)`, `modifier` `[7,13)`, `space` `[13,14)`, `separator` `[14,15)`,
`option-key` `[15,15)`, `close` `[15,17)`. The names are `"v"` and `"number"`;
the padding is dropped from them and described beside them (section 8).

### A.5 A name that is all padding

```
{{  }}
```

`open` `[0,2)`, `key` `[2,2)`, `space` `[2,4)`, `close` `[4,6)`. The key is
empty and anchored at the start of its span (section 6.3 above). A placeholder
with nothing to look up is still a placeholder (section 9.1).

### A.6 A line terminator

```
{{v
}}
```

One `text` node spanning the whole message. A placeholder MUST NOT contain a
line terminator, and escaping the terminator does not make it one (section 6,
note 1).

### A.7 An escape sequence before an astral character

A backslash before U+1F600 spans three UTF-16 code units — the backslash and
both halves of the surrogate pair — because it consumes a code point
(section 6.5 above). `cancels` is `false`: the character has no structural
meaning there.

### A.8 An option value that is more than a placeholder

```
{{n:gt; 0:you have {{n}} left; default:none;}}
```

`option-value` `[10,29)`, holding `text` `[10,19)` `"you have "`, `placeholder`
`[19,24)` and `text` `[24,29)` `" left"`. The value's own text and the
placeholder in it are siblings, and neither is padding: section 8 reads padding
off the spelling, so only blank the message writes outside every placeholder
the value holds can be dropped.

### A.9 A `{{` in a value that opens nothing

```
{{a; x:{{b}}
```

`text` `[0,7)`, `placeholder` `[7,12)`. The `{{` at 7 opens a placeholder that
closes at 12, and the construct that began at 0 is then never closed, so it
does not derive (section 6, note 10). The scan resumes one code point after its
opening brace, finds no opening pair until 7, and takes the verdict it already
reached there (section 6, notes 7 and 11). So the outer braces are text and the
construct they enclosed is the placeholder. Version 1 read the same message the
other way round: one placeholder `[0,12)` whose option value was the text
`{{b`.
