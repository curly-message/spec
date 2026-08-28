# Curly Message Format

**Version 1 — Working Draft**

| | |
| --- | --- |
| Format name | Curly Message Format |
| Machine-readable identifier | `curly-message` |
| Versioned identifier | `curly-message-1` |
| Status | Working Draft |

> **This is a working draft of version 1.** The body of this document is
> normative: it states what a conforming implementation must do. Nothing has
> been released against it, so the version-1 surface may still change before it
> is frozen.
>
> Appendix A records the divergences found while this draft was written against
> the pre-3.0 reference parser, and the ruling that resolved each one. Those
> rulings are accepted and written into the body — the appendix is a historical
> record, not a list of open questions.

## 1. Scope

This document specifies the Curly Message Format: a syntax for translatable
messages in which values are substituted into double-curly placeholders, and a
placeholder may carry a modifier, a list of options and a fallback.

It specifies the message syntax and the result of resolving a message against a
payload. It does not specify a host API, a file format for message catalogues, a
key-namespacing scheme, or how an implementation reports diagnostics.

The format is deliberately small. It has no plural categories, no gender
selection and no nested argument syntax. Formatting that depends on a locale is
delegated to the host platform's internationalization facilities.

## 2. Conformance

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**
and **MAY** are to be interpreted as described in RFC 2119.

An implementation conforms to this specification at one or more levels:

| Level | Sections | Requirement |
| --- | --- | --- |
| **Core** | 4-10, 11 (excluding 11.2 and 11.3), 12, 13, 14 | Grammar, escaping, whitespace, resolution, the fallback chain, what a modifier receives and returns, the comparison modifiers, nesting and its limits, security properties and error behavior. |
| **Intl** | 11.2 | The locale-dependent formatting modifiers `number`, `date`, `ago` and `currency`. |
| **Extensions** | 11.3 | Host-defined modifiers. |

Core is REQUIRED. An implementation MUST report which levels it satisfies. An
implementation that does not satisfy Intl MUST treat the formatting modifier
names as unknown modifiers (section 11.4), not as ordinary option keys: an
implementation that lacks those modifiers has not defined them, and a host is
free to define them itself, because a host's own configuration overrides the
format's (section 11.3).

Conformance is tested by the implementation-independent fixture set
`@curly-message/conformance`, which targets a stated version of this document.
That set is not published yet, so until it is, an implementation is assessed
against this document alone.

## 3. Terminology

**message**
: Text that may contain placeholders. A message a host wrote as something else
  is converted to text before anything reads it (sections 4 and 5).

**payload**
: A mapping from string keys to values, supplied by the caller, from which
  placeholder values are resolved.

**props**
: Caller-supplied formatting properties for the formatting modifiers, grouped
  by modifier name. Distinct from the payload: the payload carries data, props
  carry presentation. Distinct from an option, which is written in the
  placeholder: props are supplied by the caller (section 11.2).

**locale**
: A language tag identifying the target language, used by the formatting
  modifiers.

**key** (of a message)
: The catalogue identifier under which a message was requested. Used by the
  fallback chain (section 10) when no message exists.

**placeholder**
: A `{{ … }}` construct within a message that section 6 derives as one. A
  construct it does not derive is literal text (section 9.1).

**selector**
: The leading part of a placeholder: a payload key and an optional modifier.

**option**
: A `key:value` pair within a placeholder, offered to the modifier for
  selection.

**inline default**
: The option-shaped segment whose key is `default`. It is not an option; it is
  the placeholder's own fallback.

**absent**
: A value is absent when the payload has no own entry for the key, or when the
  entry it owns is the host's undefined. A value that is present but empty,
  zero, false or the host's null is **not** absent; a present value that no
  conversion can describe is treated as absent (section 9.2).

## 4. Data model

Resolving a message takes four inputs — a message, a payload, props and a locale
— and produces a string.

Everything the format carries is text. A payload value MAY be of any host type,
but it reaches a modifier, an option comparison and the output as text, never at
the type it was authored with.

A value that is a plain object or an array MUST be converted using the host's
JSON serialization, so that a structured value survives into a host-defined
modifier that reads it back. Every other value MUST be converted using the
host's ordinary string conversion, so a date, a pattern, a set or a class
instance keeps whatever text it describes itself as.

**Plain object** MUST be read narrowly: an object with no meaningful prototype
of its own — in ECMAScript, one whose prototype is `Object.prototype` or null.
The narrow reading is what keeps a value authored as a date instance formattable
by `date` (section 11.2).

A value that **no conversion can describe** — a serialization that raises,
yields nothing or reaches the conversion limit of section 13, a string
conversion that raises — MUST be treated as absent, MUST NOT raise, and SHOULD
be reported (section 14.2).

How many times a value is converted while a message resolves is itself bounded
(section 13).

Wherever a value is compared numerically, the implementation MUST convert it
using the host's ordinary numeric conversion, and a conversion that does not
yield a number MUST be treated as a failed comparison, never as an error.

An implementation MUST return a string, including when the message it was given
was not one.

### 4.1 Value wrappers

A payload entry MAY be the value's own configuration instead of the value.

An entry is a **wrapper** when it is a plain object, owns at least one key, and
**every** own key is one of `value`, `default` and `props`. Anything else is a
value — including a plain object that owns any other key alongside them.

```
{ value: 1 }                  wrapper, value 1
{ value: 1, default: 'D' }    wrapper
{ default: 'D' }              wrapper, no value
{ props: { number: … } }      wrapper, no value
{ value: 1, unit: 'kg' }      value  ->  {"value":1,"unit":"kg"}
{}                            value  ->  {}
```

A wrapper's `value` is the placeholder's value (section 9.2), its `default`
joins the fallback chain (section 10), and its `props` is the topmost layer of
formatting properties (section 11.2).

Unwrapping happens **exactly once**: a wrapper's `value` is a value, never
itself a wrapper. A wrapper that owns no `value` key, or whose `value` is the
host's undefined, has no value.

The payload's root `default` entry is an ordinary value, never a wrapper.

Recognition is exact rather than opportunistic because a payload cannot be
constrained: message keys are namespaced dotted segments, and payload values are
frequently plain objects taken straight from an API. `{ value: 1, unit: 'kg' }`
is data, and it must stay data.

## 5. Interpolation model

A message is resolved by repeated passes. Each pass replaces every placeholder
in the current text with its resolved value (section 9). The output of a pass
becomes the input of the next, so a value that itself contains a placeholder is
resolved in turn.

A message reaches the first pass as text: it is converted by section 4's rules
before anything reads it, not after everything has. A host that wrote its
message as something other than a string therefore gets it interpolated and
unescaped like any other, exactly as a payload value always has been.

The process stops when a pass produces text containing no placeholders, or when
a limit in section 13 is reached.

Escape sequences (section 7) are removed **once**, from the final text, after
the last pass. An escape sequence introduced by a payload value is therefore
still an escape sequence when the next pass runs, and a value containing `\{\{`
does not become a placeholder.

## 6. Grammar

The grammar is given in ISO/IEC 14977 EBNF. It is defined over Unicode code
points.

```ebnf
message        = { escape | literal-char | placeholder } ;

placeholder    = "{{" , selector , { ";" , segment } , "}}" ;

selector       = key , [ ":" , modifier-name ] ;
segment        = option-key , [ ":" , value ] ;

key            = { text-unit } ;
option-key     = { text-unit } ;
modifier-name  = { value-unit } ;
value          = { value-unit } ;

text-unit      = inner-escape | text-char ;
value-unit     = inner-escape | value-char ;

escape         = "\" , any-char ;
inner-escape   = "\" , inner-char ;

(* A code point stands for itself at any position where no complete escape and
   no complete placeholder begins; see note 7. *)
literal-char   = ? any code point at such a position ? ;

(* character classes *)
line-term      = ? U+000A | U+000D | U+2028 | U+2029 ? ;
whitespace     = ? line-term | U+0009 | U+000B | U+000C | U+0020 |
                   U+00A0 | U+1680 | U+2000 | U+2001 | U+2002 |
                   U+2003 | U+2004 | U+2005 | U+2006 | U+2007 |
                   U+2008 | U+2009 | U+200A | U+202F | U+205F |
                   U+3000 | U+FEFF ? ;
any-char       = ? any code point ? ;
inner-char     = ? any code point except line-term ? ;
text-char      = ? any code point except ":" ";" "\" line-term,
                   and not starting the sequence "{{" or "}}" ? ;
value-char     = ? any code point except ";" "\" line-term,
                   and not starting the sequence "{{" or "}}" ? ;
```

Notes on the grammar, all normative:

1. **A placeholder MUST NOT contain a line terminator.** A `{{ … }}` construct
   spanning a line terminator is literal text, and escaping the terminator does
   not make it a placeholder: only `inner-escape` occurs inside one, and
   `inner-char` excludes every line terminator. Which substrings of the text a
   pass is given are placeholders MUST NOT depend on the payload, or on what
   any other placeholder in that text resolves to (note 7); what a placeholder
   resolved to on an earlier pass is ordinary text to the next one
   (section 12). (Appendix A.10.)

2. **A key MAY contain a colon or a semicolon only as an escape sequence**
   (`\:`, `\;`), and a brace only where it does not form a delimiter (note 6).
   A key MAY otherwise contain any character, including spaces, dots, digits,
   backslashes and non-ASCII text; it MUST NOT contain a line terminator in any
   form (note 1). Keys are compared by exact code-point equality after
   unescaping.

3. **The selector's colon is the first unescaped colon in the selector.**
   Everything before it is the key; everything after it, up to the selector's
   end, is the modifier name. The name is not otherwise constrained: one this
   format does not specify and the host has not registered is a **message
   error** (section 11.4), not literal text. A colon with nothing after it
   names no modifier (section 8).

4. **An option's colon is the first unescaped colon in the segment.**
   Everything after it, up to the segment's end, is the value. A value MAY
   therefore contain unescaped colons. (Appendix A.7.)

5. **A value MUST NOT contain an unescaped semicolon**, which ends the segment.

6. **A backslash consumes the character that follows it**, so a brace it
   consumed is text and cannot be half of a delimiter. `{{` and `}}` are
   delimiters only where the two braces stand **adjacent** and neither has been
   consumed, which makes `\{{v}}`, `{\{v}}`, `{{v}\}` and `{{v\}}` all literal
   text: in each, one brace of a pair was taken by a backslash and the brace
   left over stands alone. To write either delimiter as literal text, escape
   **both** of its braces: `\{\{`, `\}\}`. Consuming one brace disturbs no
   other, so `{{v\}}}` is a placeholder whose key is `v}` — the backslash
   takes the first `}` and the remaining two close the placeholder, which is
   what lets a key **end** in a closing brace. A `}` that starts no pair needs
   no escape at all: `{{a}b}}` already names the key `a}b`. And `{{\{v}}` is
   a placeholder whose key is `{v`, its opening pair intact because the
   backslash took only the third brace.

7. **A message has exactly one derivation, and one left-to-right scan finds
   it.** At each position at most one of `escape` and `placeholder` can begin —
   the first opens on `\`, the second on `{{` — and a code point where neither
   **completes** is a `literal-char`. Both need what follows them. An escape
   needs a character to consume, so a backslash at the end of a message consumes
   nothing and is a `literal-char` itself. And a placeholder begins only where a
   **complete** one derives: the scan reads forward from the opening pair and
   either reaches a closing pair or does not. Where it does not, the opening
   brace is a `literal-char` and the scan resumes at the very next code point —
   one brace, not two — so `{{a{{b}}` is the literal text `{{a` followed by the
   placeholder `{{b}}`, while `{{{{a}}` is the literal text `{` followed by a
   placeholder whose key is `{a`.

   Inside a placeholder every boundary is forced by a character class rather
   than by choice: `text-char` excludes `:`, so the selector's colon is the
   first one no backslash consumed; `text-char` and `value-char` both exclude
   `;`, so a segment ends at the first semicolon; and both exclude a code point
   that starts `}}`, so the closing pair is the first one left standing.
   Nothing in the scan consults the payload, or what any other placeholder
   resolves to, so a pass over the same text always yields the same
   placeholders.

8. **The whitespace class is fixed by this document.** It is the twenty-five
   code points enumerated above, and it is neither a host language's whitespace
   class nor a Unicode property; an implementation MUST NOT substitute either
   for it. Wherever this document says whitespace it means this class: in the
   escapable characters of section 7, in the significance rules of section 8,
   and in the blank text of section 11.2, which is a payload value, not message
   text. The class names `line-term` rather than repeating its four code points,
   so every line terminator is a member, and an amendment to `line-term` is an
   amendment to this class that reaches all three sections just named.

9. **No production requires whitespace.** The grammar admits it wherever it
   admits text, and admits it only as text: the spaces in `{{ value; }}` derive
   as `text-unit`, which is what leaves that placeholder one derivation
   (note 7). Section 8 decides which whitespace a placeholder's parts keep, and
   section 7 decides which of it an escape sequence makes text.

## 7. Escaping

A backslash cancels the structural meaning of the character that follows it, and
the pair denotes that character as literal text. A character that has no
structural meaning where it appears is unchanged by a preceding backslash: both
characters stand, and the backslash denotes itself. A backslash at the end of a
message has no character to cancel and denotes itself likewise.

The rule is uniform across the whole message string: a backslash consumes the
character after it wherever it appears, and the same characters are escapable
everywhere. A position decides reach, not membership — a line terminator is
escapable like any other member of `whitespace`, but an escape sequence that
carries one is never inside a placeholder (section 6, note 1).

The characters that carry structural meaning are `:`, `;`, `{`, `}`, `\` and
the members of `whitespace` (section 6). So `\:`, `\;`, `\{` and `\}` write
those characters as text, `\\` writes a single backslash, and an escaped space
writes a space that the insignificance rules of section 8 will not take. Every
member of `whitespace` escapes that way, the line terminators among them, so
`\` before one is an escape sequence like any other — though none carries a
line terminator into a placeholder (section 6, note 1).

Escaping is defined at the level of the message **string**, not at the level of
the file that carries it. A message stored in JSON must additionally satisfy
JSON's own escaping rules, so a single format-level backslash is written as two
characters in a JSON source file:

| Intent | In the message string | In a JSON catalogue |
| --- | --- | --- |
| literal `:` | `\:` | `"\\:"` |
| literal `;` | `\;` | `"\\;"` |
| literal `{` | `\{` | `"\\{"` |
| literal `}` | `\}` | `"\\}"` |
| literal `{{` | `\{\{` | `"\\{\\{"` |
| literal `}}` | `\}\}` | `"\\}\\}"` |
| literal `\` | `\\` | `"\\\\"` |
| a space trimming keeps | `\` followed by a space | `"\\ "` |

A literal backslash in front of a structural character is written by escaping
both — `\\\:` yields `\:`.

Implementations MUST remove escape sequences exactly once, from the final text,
after interpolation has finished (section 5). Implementations MUST NOT remove
them from intermediate results. Removing one leaves what the first paragraph of
this section says it denotes: the escaped character alone where the backslash
cancelled a structural meaning, and both characters where it cancelled none, so
`\a` renders as `\a`.

That rule governs the text a message resolves to, not the spellings it reaches
it by. A **key** and a **modifier name** are each matched by name against
something a host wrote — a payload entry, a registered modifier — so each is
compared by exact code-point equality after unescaping (section 6, note 2). An
**option key** is unescaped the same way, but it looks nothing up: it is
compared against the value, and that comparison belongs to the modifier that
performs it (section 11.1). All three are what their author wrote, not the
spelling a reserved character forced; unescaping one is not the removal this
rule bounds, because none of the three reaches the output. Where an option key
stands for its own value (section 9.4), that value is the source spelling and is
unescaped once with the rest of the output, like any other value.

## 8. Whitespace

Within a placeholder:

- Whitespace surrounding the **key** is not significant.
- Whitespace surrounding the **modifier name** is not significant.
- Whitespace surrounding an **option key** is not significant.
- Whitespace surrounding an **option value** or an **inline default value** is
  not significant. Whitespace inside one is.

These rules take the members of `whitespace` (section 6), and nothing else. A
code point outside the class is ordinary text: a key padded with one is a
different key, and an option value that holds only one is not empty.

Whitespace that an escape sequence claims is text, not padding: it belongs to
the key, the option key or the value it appears in, and the rules above do not
remove it (section 7).

An option value that consists only of unescaped whitespace therefore trims away
to nothing, so `x:` and `x: ` are equivalent: both declare the empty string
(section 9.4). (Appendix A.4.)

A **modifier name** or an **option key** that trims away to nothing, or that is
empty to begin with, names nothing: the placeholder declares no modifier, and
the segment declares no option. So `{{v:}}` is a plain substitution (section
9.5), and `{{v;;}}` and `{{v; }}` have no options.

Consequently `{{value}}`, `{{value;}}`, `{{ value }}` and `{{ value; }}` are
equivalent.

## 9. Resolution

A placeholder resolves in the following order.

### 9.1 Parse

Split the placeholder into its selector and segments per section 6. There is no
third state between a placeholder and text: a `{{ … }}` construct that section 6
does not derive as a placeholder is literal text, rendered as it stands, and it
MUST NOT be used to look up any payload key or reach any later step of this
section.

A selector MAY name no key. `{{}}`, `{{ }}` and `{{:eq}}` are placeholders with
nothing to look up, so they resolve to the fallback chain (section 10), and they
MUST NOT resolve the payload keys `""`, `"null"` or `"undefined"`.

### 9.2 Look up the value

Look up the key in the payload.

The lookup MUST consider only the payload's **own** entries. Members inherited
from a prototype, class or base mapping MUST NOT resolve. In a host where
mappings inherit members, `constructor`, `toString` and `__proto__` are
therefore absent unless the payload carries them as own entries. This is a
security requirement, not an optimization (section 14).

A value is **absent** when there is no own entry for the key, or when that
entry is the host's undefined — the host's own word for nothing here, which
section 4.1 already reads that way in a wrapper's `value`. An undefined entry
is absent, not a value no conversion could describe, so there is nothing to
report (section 14.2). Nothing else is absent: a value of zero, empty string,
`false` or the host's null MUST be treated as present. (Appendix A.8.) A value
that is present but that no conversion can describe (section 4) is treated as
absent.

If the entry is a wrapper (section 4.1), the value is the wrapper's `value`, and
the wrapper's `default` and `props` join resolution as sections 10 and 11.2
describe. The own-property requirement applies to the wrapper's own keys too: a
`value`, `default` or `props` that the wrapper only inherits MUST NOT resolve.

### 9.3 Determine the default

The inline default is the value of the first segment whose key is exactly
`default`, compared case-sensitively. (Appendix A.1.)

`default` is also a reserved payload key: it is the fallback for every
placeholder in the message that resolves to no value, and `{{default}}` reads
that same fallback rather than a placeholder of its own.

The placeholder's default is the first link of the chain in section 10 that
yields text. The payload's `default` takes precedence over the inline
`default:`, and a wrapper's `default` takes precedence over both.

If no link yields text, the default is the empty string.

### 9.4 Collect the options

Every segment other than the inline default that names an option key is an
option, in source order. A segment whose option key is empty or trims away to
nothing (section 8) declares no option, with or without a value.

- `key:value` yields that key and value.
- `key` alone — no colon — yields the key as **both** key and value.
  (Appendix A.4.)
- `key:` yields that key and the **empty string**. The colon declares a value,
  so a value that ends at the colon — or that is only unescaped whitespace
  (section 8) — is empty rather than absent.
- Where two options share a key, the first MUST win.

The reserved key `default` MUST NOT appear among the options.

### 9.5 Select the result

- If the placeholder has **no modifier and no options**, it is a *plain
  substitution*: the result is the value, or the default (section 10) if the
  value is absent.
- Otherwise it is a *selection*: the result is produced by the modifier
  (section 11), which is `eq` when no modifier is named.

A placeholder that names no key has nothing to compare, so it resolves at
section 9.1 and is neither a plain substitution nor a selection. A modifier
name it carries is still subject to section 11.4: `{{:zz}}` resolves to the
fallback chain and is a message error for naming a modifier nobody registered.

A selection that names a comparison modifier (section 11.1) and no options is a
message error (section 14.2): the author asked which option matches and offered
none. A formatting modifier selects nothing, so `{{n:number}}` is complete as it
stands, and whether a host-defined modifier needs options is that modifier's own
business. (Appendix A.9.)

## 10. The fallback chain

A placeholder that resolves to no value takes the first of the following that
yields text:

1. the `default` of the wrapper the payload entry was, where it was one
   (section 4.1);
2. the payload's own `default` entry;
3. the inline `default:` of that placeholder;
4. the empty string.

A link that is absent, or whose value no conversion can describe (section 4), is
skipped.

The payload outranks the message: a message declares the default it was written
with, and the application overrides that default where it needs to, so the more
specific statement wins.

A **message** that does not exist takes, in order:

1. the payload's own `default` entry, if present;
2. the message's key, echoed verbatim.

A message that exists resolves normally, even when it is empty. A message that
is present but that no conversion can describe (section 4) does not exist, the
same way such a value is absent (section 9.2). An own `default` entry that is
present but zero, empty or false counts as present. (Appendix A.8.)

A link this chain skips is skipped for the reasons the placeholder chain skips
one: a `default` entry the payload does not own is absent, and one it owns whose
value no conversion can describe is not a value. Neither displaces the key echo.
Where the caller named no key there is nothing to echo, and the message resolves
to the empty string.

**Echoed verbatim** means what it says: the key is not a message, and it is not
among what MAY resolve to text containing placeholders (section 12). A key
carrying `{{` or `}}` MUST NOT be resolved over, and an escape sequence a key
carries MUST NOT be removed — the key leaves as the application spelled it.
Nothing behind the key is read again on its account. (Appendix A.17.)

## 11. Modifiers

A modifier receives the value, the options, the resolved default, the locale and
the props, and returns an answer.

The value and the default both reach the modifier as text (section 4): the
default is the text the chain in section 10 resolved to, and the value is the
text the payload entry converted to. No modifier sees a value at the type it was
authored with.

A modifier's answer is a host value in turn, and becomes text by that same
conversion: a structured answer serializes rather than collapsing to whatever
the host calls an object, so a modifier writes the text a payload value of that
shape would. Neither an answer no conversion can describe nor an answer that is
nothing at all is an answer, and the placeholder takes the fallback chain
(section 10) — the treatment a value that is not a value gets.

Modifier names are **case-sensitive**. `eq` is a modifier; `EQ` is not.
(Appendix A.2.)

### 11.1 Comparison modifiers (Core)

| Name | Selects the first option whose key |
| --- | --- |
| `eq` | equals the value, compared as text, case-insensitively |
| `ne` | differs from the value, compared as text, case-insensitively |
| `lt` | is greater than the value, comparing numerically |
| `lte` | equals the value, compared as text, case-insensitively, otherwise as `lt` |
| `gt` | is less than the value, comparing numerically |
| `gte` | equals the value, compared as text, case-insensitively, otherwise as `gt` |

**Case-insensitively** names one comparison: the option key and the value are
each mapped to lower case by the host's ordinary, locale-independent case
conversion, and the two results are compared by code-point equality. Section 7
defers the comparison here, and this is the whole of it: an implementation MUST
NOT substitute a collation, a normalization or a case fold for it, and MUST NOT
tailor the conversion to a locale. The comparison modifiers are Core
(section 2), so they resolve alike in every locale and where no locale is
available at all — a conversion a locale tailors reads `I` and `i` as one text
in most languages and as two in Turkish, and a Core selection cannot turn on
which. The mapping also leaves apart what a case fold would join: the lower
case of `STRASSE` is `strasse` and not `straße`, so an option keyed `STRASSE`
does not select for the value `straße`.

`lt` and `lte` MUST consider options in ascending key order; `gt` and `gte` in
descending key order. Ordering is by numeric value of the key; an option whose
key is not numeric MUST NOT be selected by a numeric comparison. Implementations
MUST NOT reorder the caller's option list observably.

`lte` and `gte` compare for equality first, over every option in source order
(section 9.4), and reach the key order above only where that comparison selects
nothing. The equality leg is a text comparison rather than a numeric one, so the
option it selects need not carry a numeric key: `{{v:lte; abc:X}}` selects `X`
for the value `abc`, which the numeric leg on its own passes over.

If no option is selected, the result is the fallback chain (section 10).

`ne` has no special handling for an absent value: like every other modifier, an
absent value takes the fallback chain. (Appendix A.3.)

### 11.2 Formatting modifiers (Intl)

These delegate to the host's internationalization facilities and require a
locale. If no locale is available, the result MUST be the empty string.

| Name | Input | Formats as |
| --- | --- | --- |
| `number` | a number | a locale-formatted number, at most 2 fraction digits by default |
| `date` | milliseconds since the Unix epoch, or text the host can parse as a date | a locale-formatted date |
| `ago` | a **signed millisecond delta relative to now** — negative is past | a locale-formatted relative time |
| `currency` | a number, multiplied by a `ratio` property defaulting to 1 | a locale-formatted currency amount |

`number`, `ago` and `currency` take a number only. Because every value arrives
as text (section 4), `date` also accepts text the host's own date parsing
understands; that is what keeps a value authored as a date instance formattable.

Text that is empty or consists only of `whitespace` (section 6) is **not** a
number, whatever the host's numeric conversion makes of it, and is not a date
either. No formatting modifier can format it, so the placeholder MUST take the
fallback chain (section 10). The class is the one section 8 applies to message
text, applied here to a payload value: an implementation MUST NOT substitute
its host's own notion of a blank string. This governs formatting alone: a
numeric comparison (section 11.1) converts blank text like any other text.

Formatting properties are read from props under the modifier's own name,
layered over implementation-configured defaults, which are layered over the
defaults above. A wrapper's `props` (section 4.1) is layered over all of them.

A property is not an **option** (section 3): an option is a segment written in
the placeholder and offered to the modifier for selection, and a formatting
modifier selects nothing (section 9.5). The layers above are the only place a
formatting modifier reads a property from, and a placeholder is not one of
them, so a placeholder segment spelled like one is an option that reaches no
layer.

Every layer composes **per property**: a layer overrides only the properties it
names, and the properties it does not name keep whatever the layer beneath it
gave them. A layer MUST NOT reset a property a layer beneath it set.

```
implementation defaults   number: { maximumFractionDigits: 4, useGrouping: false }
props                     number: { useGrouping: true }
wrapper props             number: { maximumFractionDigits: 1 }
effective                 { maximumFractionDigits: 1, useGrouping: true }
```

Each layer is read from its **own** entries, the way section 9.2 reads the
payload. A property a layer merely inherits MUST NOT reach the formatting
request (section 14.1).

The two fraction digits `number` formats by default are a default **maximum**,
not a cap. Where a layer names a `minimumFractionDigits` above it, the default
maximum widens to reach that minimum instead of contradicting it; a layer that
names the maximum itself decides it. The widening runs after the layers have
composed, and it is the one place a property no layer named does not keep what
the layer beneath it gave. A default that held at two would make a minimum
above two unformattable, and the placeholder would take the fallback chain over
properties the caller wrote deliberately.

`currency` formats in the currency style. That style is what the modifier is
rather than one of the properties it layers, so a layer MUST NOT replace it; an
implementation applies it over every layer.

`ago` selects a unit automatically unless one is named. Both the unit and the
count are chosen from the **magnitude** of the delta, and the sign is applied to
the result: a delta and its negation MUST select the same unit and the same
count with opposite signs. A host rounding rule that takes a half in one
direction — toward positive infinity, say — reads "half an hour from now" and
"half an hour ago" as different distances, which no reader of a relative time
expects.

Because the output of these modifiers depends on the host's locale data,
conformance fixtures for this level MUST assert the formatting request — the
operation, its properties and its input — rather than a literal output string.

A formatting modifier that cannot format its input MUST NOT raise; it resolves
to the fallback chain and SHOULD report the failure. (Appendix A.12, A.13.)

### 11.3 Host-defined modifiers (Extensions)

A host MAY register additional modifiers. A host's own configuration overrides
the format's, so a host-defined modifier MAY replace a modifier named in this
specification.

What a host registers under a name MUST be a modifier. Registration is what
makes a name one a message may write, so registering anything else registers no
modifier: the name is not one a message may write, and it does not replace a
modifier already answering to it. A message writing that name names a modifier
nobody registered, and section 11.4 governs. (Appendix A.18.)

To keep host-defined names from colliding with future versions of this format,
a host-defined modifier name SHOULD begin with `x-`. All names matching
`[a-z][a-zA-Z0-9-]*` without that prefix are reserved for this specification.

A host-defined modifier that raises MUST be contained: the placeholder resolves
to the fallback chain and the failure SHOULD be reported. (Appendix A.12.)

### 11.4 Unknown modifiers

A modifier name that is neither specified nor registered is a **message error**
(section 14.2). The placeholder resolves to the fallback chain.

Implementations MUST NOT silently treat an unknown modifier as `eq`. A message
written today as `{{n:plural}}` must not render as an equality selection now and
silently change meaning when a later version of this format defines `plural`.
(Appendix A.2.)

## 12. Nesting

Section 6 derives no placeholder inside another: a key, an option key, a
modifier name and a value all stop at a code point that starts `{{` or `}}`. A
`{{ … }}` construct that encloses another is therefore not a placeholder at all
— the inner one is found on its own, and only on a later pass is the enclosing
construct scanned again, over text that now carries what the inner one resolved
to. Whether it derives then is decided by that text like any other: a value
carrying `}}` closes the enclosing construct early, and one carrying `{{` keeps
it from deriving at all.

A value, an option value, an inline default, a payload `default` or a wrapper's
`default` (section 4.1) MAY likewise **resolve to text that contains**
placeholders; those are found and resolved on the following pass (section 5).

Nesting is bounded by section 13.

## 13. Limits

Interpolation is bounded, because a payload is frequently attacker-influenced
and a self-referential or self-multiplying value would otherwise not terminate.

An implementation MUST enforce all three of the following:

- **A pass limit.** At least **10** passes MUST be performed before stopping.
- **An output limit.** At least **100 000** characters of output MUST be
  permitted. A pass whose output would exceed the limit MUST be discarded
  whole; the result is the last text that stayed within the limit.
- **A conversion limit.** At least **100 000** nodes MUST be visited before a
  value's serialization is abandoned. A serialization that reaches the limit
  MUST be treated as a conversion that cannot describe the value (section 4).

These are minima. An implementation MAY permit more, and MUST document what it
permits.

On reaching the pass limit or the output limit the implementation MUST return
the last settled text with its placeholders unresolved, MUST NOT raise, and
SHOULD report that a limit was reached.

The conversion limit bounds the work of producing a text, which the other two
cannot: both measure a string that already exists. Serialization follows a
shared reference again every time it meets one, so a value naming the same child
twice at each of twenty-four levels holds twenty-five objects and describes
sixteen million leaves — nothing circular, so nothing a serializer refuses. The
limit is what a single conversion may spend: a value that visits more nodes than
a resolvable output could hold is read as one no conversion can describe, which
is where it takes the output limit's number from. The two do not measure each
other, though — a serialization visits a member it then omits, so a value can
visit any number of nodes and still describe itself in two characters — and the
output limit cannot stand in for a bound on the work.

One conversion is not a resolution. A value is read once for every placeholder
that names it, on every pass, so a limit on a single conversion bounds a
resolution only if its conversions cannot multiply with its reads:
**resolving a message MUST convert a given value at most once**, and every
later read of that value MUST answer with the text the first conversion
produced — the answer that no conversion can describe it included (section 4).
What a resolution spends converting is then set by the distinct values it
reaches, not by the reads the message makes of them. A value the payload builds
afresh on each read is a new value each time, and is converted each time.

The requirement is written over conversion rather than over serialization
because section 4 defines two ways to reach a text and a value takes whichever
its type selects. The ordinary string conversion runs host code the same way a
serialization does, and it can fail the same way, so bounding only the JSON path
would leave a value that raises on conversion absent at one placeholder and
present at the next within one resolution, with the reports following. A value
whose conversion is not deterministic therefore answers every later read with
the text the first read produced. An implementation need not record a value
whose conversion can neither run host code nor answer twice over: converting
one again runs no host code and answers what the first conversion answered, so
neither the work the limit bounds nor the answer a resolution reads changes
with it.

A report SHOULD identify the unresolved text. Because that text is derived from
the payload, a report MUST bound its length and MUST NOT emit line terminators
from it, so that payload content cannot forge additional log lines.

## 14. Security properties and error behavior

### 14.1 Security properties

A conforming implementation MUST provide both of the following. They are
requirements, not permissions.

**Own-property lookup.** Placeholder resolution MUST NOT reach inherited
members (section 9.2). Without this, a message containing `{{constructor}}` or
`{{__proto__}}` discloses host internals, and in hosts with mutable prototypes a
polluted prototype changes the rendering of messages that never referenced it.

The requirement covers configuration as well as the payload: the modifier
registry (sections 11.3, 11.4), the formatting layers of section 11.2 and the
reporting channel (section 14.3) MUST be read from their own entries only.
Nobody writes configuration onto a prototype, so an inherited props entry, an
inherited modifier registration or an inherited reporting channel is somebody
else's, and reading it lets a polluted prototype reformat, re-route or hijack a
message whose caller configured none of it.

It covers the call's own inputs last of all. This document specifies no host
API, so an implementation is free to receive the message, the payload, the props
and the locale grouped in a single host container rather than as separate
arguments; where it does, that container MUST be read from its own entries too.
A container read through its prototype lets a polluted prototype supply the
payload a caller passed none of, which is the whole of section 9.2's protection
undone one level above the payload.

**Bounded interpolation.** Section 13 MUST bound the work an attacker-supplied
payload can force. Without its limits, a payload value of `'{{value}}{{value}}'`
grows geometrically, and a value that merely shares a reference with itself
serializes for longer than any caller will wait — a message carrying no
placeholder at all reaches the conversion but never the interpolation loop, so
the conversion limit is the only one that holds it. That limit holds one
conversion; what keeps a message from buying as many of them as it has
placeholders is section 13's requirement that a resolution convert a value
once.

Neither property may be disabled by configuration.

### 14.2 Message errors

A *message error* is a defect in the message: an unknown modifier (11.4), a
comparison with no options (9.5), a modifier that cannot process its input
(11.2, 11.3).

On a message error an implementation MUST resolve the placeholder to the
fallback chain (section 10), MUST NOT raise, and SHOULD report the error.

A value that is present but that no conversion can describe (section 4) is a
defect in the payload rather than in the message. It is treated as absent, so
the placeholder takes the fallback chain; the implementation MUST NOT raise and
SHOULD report the condition. The same holds for a link of the fallback chain
that is present and cannot be described.

The message itself is not such a link. A message that no conversion can describe
does not exist (section 10), and a message nobody wrote is not a defect in the
payload, so stepping past it is not a condition to report. The `default` entry
the chain reaches instead is a payload value like any other, and is reported
like one.

Rendering must not fail because one translation is wrong. A single malformed
message must not take down the page that contains it.

### 14.3 Reports

This specification does not prescribe a reporting channel. Reports SHOULD
identify the message key and the placeholder; where the condition is about the
chain the message itself resolves through, there is no placeholder to identify
and the key is what says which message went looking. Section 13's bounds on
report content apply to every report that includes payload-derived text.

## Appendix A: rulings on known divergences

Every entry records a behavior of the pre-3.0 implementation this draft was
written against, and the ruling that resolved it. **The rulings are accepted.**
Each is written into the body of this document as a requirement — sections 4, 6,
7, 8, 9, 10, 11, 13 and 14 — and the body, not this appendix, is normative.

Each **Observed** block is a historical record of that pre-3.0 implementation:
what it did before the ruling landed. It is not re-measured against any current
head, and it describes no conforming implementation. Entries A.1-A.6 correspond
to the six divergences already catalogued before this draft; the rest were found
while writing it.

Every ruling is a breaking change to the implementation it was observed on and
none is a breaking change to a released package: `@curly-message/parser` is new
and nothing has been released against this specification. No migration note is
owed to any user.

---

### A.1 `default:` is matched case-insensitively, but read case-sensitively

**Observed.** The inline-default scan is case-insensitive, while the payload
lookup and the option filter are case-sensitive.

```
{{v; DEFAULT:D}}      payload {}                 ->  "D"      (parsed as an inline default)
{{v}}                 payload { DEFAULT: 'PD' }  ->  ""       (not read as the payload default)
{{v; DEFAULT:D}}      payload { v: 'DEFAULT' }   ->  "D"      (also kept as an eq option)
```

`DEFAULT:D` occupies both roles at once: it sets the inline default *and*
survives the option filter, which strips only the exact string `default`. Where
both spellings appear, the first in source order wins:

```
{{v; DEFAULT:UPPER; default:LOWER}}  ->  "UPPER"
{{v; default:LOWER; DEFAULT:UPPER}}  ->  "LOWER"
```

**Ruling.** `default` is reserved in lowercase only, compared
case-sensitively everywhere. `DEFAULT:x` becomes an ordinary option.

A reserved word is recognized by name, and a name is matched case-sensitively
throughout the format (section 7); one case-insensitive position is an
inconsistency, and its side effect — a segment that is simultaneously a fallback
and an option — cannot be expressed in the grammar.

---

### A.2 An unknown modifier silently becomes `eq`

**Observed.** Any name that was not a registered modifier fell back to `eq`,
with no diagnostic. Modifier lookup was case-sensitive, so case variants fell
back too, silently changing meaning:

```
{{v:plural; 1:one; default:many}}  payload { v: 1 }  ->  "one"   (eq matched key 1)
{{v:gt;     1:ONE; default:D}}     payload { v: 1 }  ->  "D"     (gt: 1 is not > 1)
{{v:GT;     1:ONE; default:D}}     payload { v: 1 }  ->  "ONE"   (unknown -> eq)
```

**Ruling.** An unknown modifier is a message error (section 14.2).
The placeholder resolves to the fallback chain; the error is reported. Names
matching `[a-z][a-zA-Z0-9-]*` that do not begin with `x-` are reserved for this
specification, and host-defined modifiers should carry that prefix
(section 11.3).

This is the most consequential ruling in this appendix, and the reason is
forward compatibility rather than diagnostics. Every message written today as
`{{n:plural}}` renders as an equality selection. If a later version of this
format defines `plural`, all of them change meaning at once — with no error at
any point, before or after. A host that registers `plural` itself overrides the
format there deliberately (section 11.3); the `x-` prefix keeps the names a host
never meant to override from colliding with future specified ones.

---

### A.3 `ne` bypasses the fallback and compares against the text `undefined`

**Observed.** `ne` is the only modifier for which an absent value does not take
the inline default. It proceeds to compare, and an absent value converts to the
text `"undefined"`:

```
{{v:ne; 10:V2; default:D}}         payload {}  ->  "V2"   (10 differs from "undefined")
{{v:eq; 10:V2; default:D}}         payload {}  ->  "D"
{{v:ne; undefined:U; default:D}}   payload {}  ->  "D"    (the option key matches the text)
```

**Ruling.** Remove the special case. An absent value takes the
fallback chain under every modifier, `ne` included.

The behavior is an artifact of one implementation's absent-value spelling, not a
decision about the format. It is also not portable: the text `"undefined"` is a
JavaScript spelling, and an implementation in a language whose absent value
converts to `None`, `nil` or `null` cannot reproduce it without special-casing a
foreign language's vocabulary.

---

### A.4 Valueless options are whitespace-sensitive

**Observed.** An option with no value, or with an empty value, yielded its key
as its own value. An option whose value was whitespace was dropped instead:

```
{{v:ne; z; default:DEF}}                payload {}          ->  "z"
{{v; 1:; 5:FIVE; default:DEF}}          payload { v: 1 }    ->  "1"
{{v; x: ; 5:FIVE; default:DEF}}         payload { v: 'x' }  ->  "DEF"   (one space after the colon)
```

**Ruling.** Keep the shorthand, and confine it to the form that has
no colon: `z` alone is equivalent to `z:z`. A colon declares a value, so `z:`
and `z:` followed by whitespace both declare the empty string (section 9.4).

The shorthand is useful and already relied upon. The whitespace sensitivity is
not: the difference between `x:` and `x: ` is invisible in every editor a
translator uses, and no message can depend on it deliberately. Reading them both
as empty is what keeps the colon worth writing — an author who types one has
said what the value is, and an author who wants the key back leaves it out.

`whitespace` (section 6) also holds code points a translator does type on
purpose — U+00A0 and U+3000 among them — and the rule trims those as well: an
author who means one as the value escapes it (section 7).

---

### A.5 The canonical escape form is undefined

**Observed.** The runtime consumes a single backslash. The reference README
documents "double backslash", which is the JSON encoding of a single one. Both
descriptions are current, and they describe different layers.

**Ruling.** A backslash cancels the structural meaning of the
character that follows it, uniformly across the whole message string; the
characters that carry one are `:`, `;`, `{`, `}`, `\` and whitespace
(section 7). Escaping is defined at the level of the message string. JSON
encoding is a property of the catalogue file, documented as a note with a
conversion table, not as part of the format.

---

### A.6 The interpolation limits are undocumented

**Observed.** Interpolation stopped after 10 passes, and discarded a pass whose
output would exceed 100 000 characters. Both reported through `console.warn` and
returned the last settled text. Verified:

```
chain of 10 references   ->  fully resolved, no report
chain of 11 references   ->  "{{v11}}", one report
self-multiplying value   ->  27 968 characters, one report
```

The output limit discarded the offending pass whole rather than truncating to
the limit, so the result was the last text that stayed within it — not a 100 000
character prefix.

**Ruling.** Specify both as normative minima (section 13), not as
implementation details.

They are a denial-of-service bound on attacker-influenced payloads, which makes
them a property of the format: a message that renders on one conforming
implementation must not hang another. Stating them as minima leaves
implementations free to be more generous while guaranteeing a floor.

---

### A.7 An option value is truncated at its last unescaped colon

**Observed.** An option segment was split on every unescaped colon; the key was
the first field and the value the **last**. Everything between was discarded:

```
{{v; a:http://x; default:D}}    payload { v: 'a' }  ->  "//x"
{{v; a:10:30;    default:D}}    payload { v: 'a' }  ->  "30"
{{v; a:b:c:d;    default:D}}    payload { v: 'a' }  ->  "d"
{{v; a:10\:30;   default:D}}    payload { v: 'a' }  ->  "10:30"   (escaped: correct)
```

Inline defaults were not affected — `{{v; default:10:30}}` yielded `10:30` — so
the two constructs disagreed about the same character.

**Ruling.** Only the first unescaped colon separates an option key
from its value; the value runs to the end of the segment (section 6, note 4).

This silently corrupts URLs, clock times, ratios and Windows paths in
translated text. No message can rely on the current behavior deliberately, and
the inconsistency with inline defaults shows it was never intended.

---

### A.8 Falsy values are treated as absent

**Observed.** Several places tested truthiness where they meant presence, so
zero, empty string and `false` behaved as though the key were missing:

```
{{v:number; default:99}}   payload { v: 0 }         ->  "99"       (expected "0")
{{v:currency; default:7}}  payload { v: 0 }, currency USD  ->  "$7.00"  (expected "$0.00")
{{v}}                      payload { default: 0 }   ->  ""         (expected "0")
message undefined          payload { default: 0 }   ->  the key    (expected "0")
message undefined          payload { default: '' }  ->  the key    (expected "")
```

**Ruling.** Only an absent value triggers a fallback. Zero, empty
string and `false` are values (sections 9.2 and 10). Absence is a property of
the value, not of the key: an own entry that is the host's undefined, and a
present value that no conversion can describe, are absent too (section 9.2).

Presence is not formattability: an empty or whitespace-only value is present,
and a formatting modifier that cannot read it as a number still takes the
fallback chain (section 11.2).

A count of zero is the most common numeric case in translated text — "0 items",
"0 unread" — and it is exactly the case this turns into the default. The bug is
invisible in testing precisely because the default is usually a plausible
string.

---

### A.9 Naming `eq` changes the result of an otherwise identical placeholder

**Observed.** A placeholder with no modifier and no options substitutes its
value. Naming the default modifier, or adding a non-matching option, produces
the empty string instead:

```
{{v}}         payload { v: 'RAW' }  ->  "RAW"
{{v:eq}}      payload { v: 'RAW' }  ->  ""
{{v; a:A}}    payload { v: 'RAW' }  ->  ""
```

**Ruling.** Keep the two behaviors, but name them: plain
substitution and selection are distinct constructs (section 9.5). A comparison
with no options at all is a message error, since a modifier that selects with
nothing to select from cannot have been intended.

Once named, the difference is coherent rather than surprising: `{{v}}` asks for
a value, `{{v:eq; …}}` asks which option matches it. The error covers the one
case that is never deliberate.

---

### A.10 A placeholder containing a line terminator is context-dependent

**Observed.** The scanner that decides whether to run a pass rejects line
terminators; the pattern that replaces placeholders accepts them as padding. A
placeholder spanning a newline is therefore inert on its own, and resolves when
some other placeholder in the same message triggers a pass:

```
"{{\nv\n}}"            payload { v: 'HIT' }             ->  "{{\nv\n}}"   (literal)
"{{a}} {{\nv\n}}"      payload { a: 'A', v: 'HIT' }     ->  "A HIT"       (resolved)
```

The same holds for carriage return, U+2028 and U+2029. A line terminator inside
the key rather than around it stays literal in both cases.

**Ruling.** A placeholder must not contain a line terminator, in any
position. Such a construct is literal text unconditionally (section 6, note 1).

Which substrings of a message are placeholders must be fixed by the message
text alone. The current behavior makes it depend on how many interpolation
passes have run, and so on the payload, which no static tool can honor — and a
static grammar is a prerequisite for extracting a message's parameters at build
time.

Whether a later version should admit a placeholder that spans lines — decidably,
in that same single scan (section 6, note 7) — is deferred to
[issue #3](https://github.com/curly-message/spec/issues/3).

---

### A.11 A non-string message is returned unchanged

**Observed.** A message that was not a string and carried no placeholders was
returned as it arrived, so the parser's declared string return type was not
always honored:

```
parse(42)    ->  42     (the number, not "42")
parse(null)  ->  null
```

**Ruling.** An implementation must return a string (section 4).

This one is an implementation defect rather than a question about the format,
recorded here so it is not lost.

---

### A.12 Formatting and host-defined modifiers raise

**Observed.** The formatting modifiers propagated host errors, and host-defined
modifiers propagated their own. A single misconfigured placeholder aborted
rendering of the whole message:

```
{{v:currency}}   with no currency code       ->  raises TypeError
{{v:currency}}   with an invalid code        ->  raises RangeError
{{v:date}}       with an invalid option      ->  raises RangeError
{{v:x-boom}}     whose modifier raises       ->  raises
```

**Ruling.** A modifier that cannot produce a result resolves to the
fallback chain and reports; it must not raise (sections 11.2, 11.3, 14.2).

Failing soft matters more here than elsewhere: currency and date options come
from the caller at render time, so the failure surfaces in production on a code
path a translator never exercised.

---

### A.13 A value that cannot be converted is formatted anyway

**Observed.** No formatting modifier tested whether its input was a number.
`number`, `date` and `ago` computed `+value || +default`, so a value that
converted to `NaN` was discarded as falsy and the declared default was converted
in its place — or zero, where none was declared. `currency` selected with
`value || default` instead, so a value that was not empty was multiplied by the
ratio and formatted whatever it was:

```
{{v:number}}               payload { v: 'nope' }  ->  "0"      (expected "")
{{v:number; default:n/a}}  payload { v: 'nope' }  ->  "NaN"    (expected "n/a")
{{v:ago}}                  payload { v: 'nope' }  ->  "now"    (expected "")
{{v:currency}}             payload { v: 'nope' }, currency USD  ->  "$NaN"  (expected "")
{{v:number}}               payload { v: '' }      ->  "0"      (expected "")
{{v:date}}                 payload { v: '' }      ->  the epoch date  (expected "")
```

Empty text took the same path from the other side: numeric conversion turned an
empty or whitespace-only value into zero rather than into a failure, so it
formatted as a count of zero or as the epoch instead of falling through.

The divergence hid wherever the declared default was itself a number:
`{{v:number; default:5}}` over the same payload rendered `"5"`, which is what
the fallback chain would have produced anyway. Where the default was not a
number, `date` and `ago` raised rather than rendered, and those are A.12 cases.

**Ruling.** A value a modifier cannot convert is a value it cannot
format: the placeholder resolves to the fallback chain and yields the default
itself, never a number computed from it (sections 10 and 11.2). Text that is
empty or whitespace-only is not a number either, whatever the host's numeric
conversion makes of it.

This is the case A.12 does not reach. A.12 records the options that make a
formatter raise; here the formatter succeeds, and the message renders a count
of zero, an epoch date or a default read as a number — none of which a caller
can tell apart from a real value.

---

### A.14 `{{}}` is literal text while `{{ }}` resolves

**Observed.** An empty placeholder was not recognized. The same construct with a
single space between the braces was:

```
{{}}     payload {}                ->  "{{}}"   (literal)
{{}}     payload { default: 'D' }  ->  "{{}}"   (literal)
{{ }}    payload {}                ->  ""
{{ }}    payload { default: 'D' }  ->  "D"
```

The same held wherever an empty pair stood inside another construct:
`{{;a:{{}}` over the payload `{ default: 'D' }` was literal in full, because the
inner `{{}}` that would have closed the outer one was not a placeholder either.

**Ruling.** An empty placeholder is a placeholder. `{{}}` is
recognized exactly as `{{ }}` is; it names no key, so it resolves to the
fallback chain (sections 6 and 9.1).

One construct answered two ways, and what separates the two spellings is a
space that no translator can see and no editor displays. Whitespace around a
key is insignificant everywhere else (section 8), so a key that is only
whitespace and a key that is nothing must read alike. The grammar states this
by making the key optional inside the selector rather than the selector
optional inside the placeholder, which settles `{{:eq}}` and `{{ ; x:1 }}` by
the same rule: each is a placeholder that names no key, and each resolves to
the fallback chain. The inner pair of `{{;a:{{}}` resolves under it too, so that
text renders `{{;a:D`.

---

### A.15 A backslash before the opening pair does not suppress it

**Observed.** A backslash in front of `{{` did not stop the pair from opening a
placeholder. It stayed where it was, to be read by the unescaping pass against
whatever the resolved value put after it:

```
\{{v}}     payload { v: 'HIT' }  ->  "\HIT"
\{{v}}     payload {}            ->  "\"
\\{{v}}    payload { v: 'HIT' }  ->  "\HIT"   (the two spellings agree)
```

**Ruling.** A backslash before the opening pair suppresses it.
`\{{v}}` is literal text and renders `{{v}}` (section 6, note 6).

Section 7 states one uniform rule — a backslash cancels the structural
meaning of the character that follows it — and `{` carries such a meaning. The
first brace of an opening pair was the single position where that rule did not
hold. Nothing about a brace's neighbor changes what the backslash in front of
it does, and a leading backslash that renders or vanishes according to a
payload value is not something the author of the message can reason about.

---

### A.16 The closing pair is found by a different rule than the opening one

**Observed.** A backslash before `}` did not stop the pair from closing. The
backslash was taken into the key instead, so `\}` and `\\` yielded the same key
and no key could hold a closing brace:

```
{{v\}}     payload { v: 'HIT' }                  ->  ""
{{v\}}     payload { 'v\': 'BS', v: 'V' }        ->  "BS"   (the key is read as "v\")
{{v\\}}    payload { 'v\': 'BS', 'v\\': 'BS2' }  ->  "BS"   (the same key, a different spelling)
{{v\}}}    payload { 'v}': 'HIT' }               ->  "}"    (key "v\" again, one brace left over)
```

**Ruling.** A `}` that a backslash consumed is content, not half of
the closing pair: the closing pair is found by the same rule as the opening one
(section 6, note 6). `{{v\}}` is literal text, and `{{v\}}}` is a placeholder
whose key is `v}`.

Section 7 already lists `\}` among the sequences that write a character as
text, and note 2 admits a brace into a key wherever it does not form a
delimiter. Reading the backslash into the key instead left `}` reserved with no
escape at all: `\}` and `\\` collapsed onto one key, so `v\` was reachable by
two spellings and `v}` by none. With A.15 ruling the opening pair the same way,
a single statement now covers both ends of a placeholder — a backslash consumes
the character after it — where each end previously had a rule of its own.

---

### A.17 The key echo is resolved instead of echoed

**Observed.** Where no message existed, the key was handed to interpolation in
the message's place, so it was scanned for placeholders and unescaped like a
message. Every line below resolves a message that does not exist:

```
key "{{name}}"  payload { name: "Alice" }  ->  "Alice"  (expected "{{name}}")
key "{{name}}"  no payload                 ->  ""       (expected "{{name}}")
key "a\;b"      no payload                 ->  "a;b"    (expected "a\;b")
key "{{a}}"     payload { a: "{{a}}" }     ->  "{{a}}", and a pass-limit report
key "{{name}}"  payload { default: <circular> }  ->  "", and a second report
```

**Ruling.** The key is echoed verbatim (section 10). It is not among what MAY
resolve to text containing placeholders — a value, an option value, an inline
default, a payload `default` and a wrapper's `default` (section 12) — so it is
not scanned, and the unescaping every resolved message ends with does not reach
it either.

The key belongs to the application, not to the message catalogue: it is an
identifier the application chose, and the format repeats it only so the caller
can see which message went looking. Resolving over it hands that identifier to
the payload — the same payload that just failed to supply a message — and
returns a key spelled differently than it was passed. A caller that logs the
echo, or compares it against the key it asked for, has to be able to recognize
it.

Nothing behind the key is read on its account either: the echo is the end of
the chain, not another link in it, so a payload entry read once is not read a
second time and no bound of section 13 is reached.

The echo still becomes text, because resolution answers with text: a key a host
wrote as something else is converted by section 4 like any other input, and
where the caller named no key there is nothing to echo.

---

### A.18 A registration that is not a modifier answers to its name

**Observed.** A name counted as registered because the host's table carried it,
whatever it carried under it. An entry that could not be called therefore
answered to its name and failed on the call rather than at registration: the
placeholder resolved to the fallback chain and reported nothing, where a name
nobody registered resolves there and reports.

```
foo: [1, 2]   {{v:foo; default:D}}        ->  "D", no report
foo: "text"   {{v:foo; default:D}}        ->  "D", no report
eq:  "text"   {{v:eq; X:HIT; default:D}}  ->  "D", no report
eq:  "text"   {{v; X:HIT; default:D}}     ->  "D", no report
nothing       {{v:nosuch; default:D}}     ->  "D", unknown-modifier
```

The two `eq` lines are the sharper ones: registering a non-modifier under a
specified name took the name away from the modifier that held it, so `eq` — the
comparison a placeholder writing options gets whether or not it names one —
stopped comparing. The last line is what all four should have read as.

A host's table is not the only one. An implementation's own exports are the
layer a host's table composes with, and one implementation exported the `ago`
unit ladder alongside its modifiers, so `{{v:agoMap}}` answered to a private
data table the format never named.

**Ruling.** Registration is what makes a name one a message may write, so an
entry that is not a modifier registers none (section 11.3). It takes no name of
its own, and it does not replace a modifier already answering to that name. A
message writing it names a modifier nobody registered, which is what it is:
the fallback chain and a report, by section 11.4.

Composition follows from that rather than needing a rule of its own. Each layer
contributes the modifiers it holds and nothing else, so a bad entry costs a host
the name it wrote and nothing further; a layer read for its modifiers only after
composing would let that entry take the modifier it named down with it.

## Appendix B: relationship to the reference implementation

`@curly-message/parser` is the reference implementation of this specification.

The format is specified independently of it. An implementation in any language
that satisfies section 2 conforms, whether or not it shares any code with it.

A host library that wants this syntax adapts an implementation to its own
calling convention. That adapter belongs to the host, and this document
describes neither — the format is indifferent to which host, if any, an
implementation is reached through.

The published `@sveltekit-i18n/parser-default` 1.x line predates this
specification. Where it differs, this document governs and the 1.x behavior is
informative only.

## License

This specification is published under the MIT License. See [LICENSE](./LICENSE).
