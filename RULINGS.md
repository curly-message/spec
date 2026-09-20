# Rulings on known divergences

The Curly Message Format was written against an implementation that already
existed, and writing it down turned up places where that implementation's
behavior was undecided, undocumented or self-contradictory. This document
records each one, and the ruling that resolved it.

**It specifies nothing.** [`SPEC.md`](./SPEC.md) is the specification, it
states the current version of the format and nothing else, and every ruling
below is already written into its body as a requirement — sections 4, 6, 7, 8,
9, 10, 11, 13 and 14. Section numbers here are that document's. This one exists
so that a reader who wonders why a rule reads as it does can find the answer
instead of guessing at it.

Each **Observed** block is a historical record of the pre-3.0 implementation
this format was specified against: what it did before the ruling landed. It is
not re-measured against any current head, and it describes no conforming
implementation. Entries A.1-A.6 correspond to the six divergences catalogued
before the specification was written; the rest were found while writing it.

Every ruling is a breaking change to the implementation it was observed on and
none is a breaking change to a released package: the specification has carried
every ruling since its revision 1.0.0, so every release made against it has
them. No migration note is owed to any user.

---

## A.1 `default:` is matched case-insensitively, but read case-sensitively

**Observed.** The inline-default scan is case-insensitive, while the payload
lookup and the option filter are case-sensitive.

```curly-example
{{v; DEFAULT:D}}      payload {}                 ->  "D"      (parsed as an inline default)
{{v}}                 payload { DEFAULT: 'PD' }  ->  ""       (not read as the payload default)
{{v; DEFAULT:D}}      payload { v: 'DEFAULT' }   ->  "D"      (also kept as an eq option)
```

`DEFAULT:D` occupies both roles at once: it sets the inline default *and*
survives the option filter, which strips only the exact string `default`. Where
both spellings appear, the first in source order wins:

```curly-example
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

## A.2 An unknown modifier silently becomes `eq`

**Observed.** Any name that was not a registered modifier fell back to `eq`,
with no diagnostic. Modifier lookup was case-sensitive, so case variants fell
back too, silently changing meaning:

```curly-example
{{v:plural; 1:one; default:many}}  payload { v: 1 }  ->  "one"   (eq matched key 1)
{{v:gt;     1:ONE; default:D}}     payload { v: 1 }  ->  "D"     (gt: 1 is not > 1)
{{v:GT;     1:ONE; default:D}}     payload { v: 1 }  ->  "ONE"   (unknown -> eq)
```

**Ruling.** An unknown modifier is a message error (section 14.2).
The placeholder resolves to the fallback chain; the error is reported.

This is the most consequential ruling here, and the reason is
forward compatibility rather than diagnostics. Every message written today as
`{{n:plural}}` renders as an equality selection. If a later version of this
format defines `plural`, all of them change meaning at once — with no error at
any point, before or after. A host that registers `plural` itself overrides the
format there deliberately, and a later version of this format defining `plural`
costs that host nothing (section 11.3).

---

## A.3 `ne` bypasses the fallback and compares against the text `undefined`

**Observed.** `ne` is the only modifier for which an absent value does not take
the inline default. It proceeds to compare, and an absent value converts to the
text `"undefined"`:

```curly-example
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

## A.4 Valueless options are whitespace-sensitive

**Observed.** An option with no value, or with an empty value, yielded its key
as its own value. An option whose value was whitespace was dropped instead:

```curly-example
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

## A.5 The canonical escape form is undefined

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

## A.6 The interpolation limits are undocumented

**Observed.** Interpolation stopped after 10 passes, and discarded a pass whose
output would exceed 100 000 characters. Both reported through `console.warn` and
returned the last settled text. Verified:

```curly-example
chain of 10 references   ->  fully resolved, no report
chain of 11 references   ->  "{{v11}}", one report
self-multiplying value   ->  27 968 characters, one report
```

The output limit discarded the offending pass whole rather than truncating to
the limit, so the result was the last text that stayed within it — not a 100 000
character prefix.

**Ruling.** Specify the bounds as normative minima (section 13), not as
implementation details.

They are a denial-of-service bound on attacker-influenced input, which makes
them a property of the format: a message that renders on one conforming
implementation must not hang another. Stating them as minima leaves
implementations free to be more generous while guaranteeing a floor.

The pass limit the observation names is not among them. This format resolves a
message in one walk and repeats nothing (section 5), so there are no passes to
count — and what a pass limit was holding back was a payload writing message
text, which section 14.1 forbids outright. Section 13 states four bounds
instead: an output limit, a read limit, a conversion limit and a nesting
limit.

---

## A.7 An option value is truncated at its last unescaped colon

**Observed.** An option segment was split on every unescaped colon; the key was
the first field and the value the **last**. Everything between was discarded:

```curly-example
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

## A.8 Falsy values are treated as absent

**Observed.** Several places tested truthiness where they meant presence, so
zero, empty string and `false` behaved as though the key were missing:

```curly-example
{{v:number; default:99}}   payload { v: 0 }         ->  "99"       (expected "0")
{{v:currency; default:7}}  payload { v: 0 }, currency USD  ->  "$7.00"  (expected "$0.00")
{{v}}                      payload { default: 0 }   ->  ""         (expected "0")
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

## A.9 Naming `eq` changes the result of an otherwise identical placeholder

**Observed.** A placeholder with no modifier and no options substitutes its
value. Naming the default modifier, or adding a non-matching option, produces
the empty string instead:

```curly-example
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

## A.10 A placeholder containing a line terminator is context-dependent

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
text alone. The behavior observed above makes it depend on whether some other
placeholder in the message resolved, and so on the payload, which no static
tool can honor — and a static grammar is a prerequisite for extracting a
message's parameters at build time.

Whether a later version should admit a placeholder that spans lines — decidably,
in that same single scan (section 6, note 7) — was asked in
[issue #3](https://github.com/curly-message/spec/issues/3) and answered no for
this version. Note 7 already contains an opening pair that does not complete:
the brace is a `literal-char` and the scan resumes one code point along, so
nothing runs away. What the line terminator bounds is the reading that decides
it — forward to a closing pair, and recursively, because an option value may
hold a placeholder (note 10). A version that admitted terminators would have to
end that reading some other way, and would reopen note 2 and section 7 with it.

---

## A.11 A non-string message is returned unchanged

**Observed.** A message that was not a string and carried no placeholders was
returned as it arrived, so the parser's declared string return type was not
always honored:

```curly-example
parse(42)    ->  42     (the number, not "42")
parse(null)  ->  null
```

**Ruling.** An implementation must return a string (section 4).

This one is an implementation defect rather than a question about the format,
recorded here so it is not lost.

---

## A.12 Formatting and host-defined modifiers raise

**Observed.** The formatting modifiers propagated host errors, and host-defined
modifiers propagated their own. A single misconfigured placeholder aborted
rendering of the whole message:

```curly-example
{{v:currency}}   with no currency code       ->  raises TypeError
{{v:currency}}   with an invalid code        ->  raises RangeError
{{v:date}}       with an invalid property    ->  raises RangeError
{{v:x-boom}}     whose modifier raises       ->  raises
```

**Ruling.** A modifier that cannot produce a result resolves to the
fallback chain and reports; it must not raise (sections 11.2, 11.3, 14.2).

Failing soft matters more here than elsewhere: currency and date properties
come from the caller at render time, so the failure surfaces in production on a
code path a translator never exercised.

---

## A.13 A value that cannot be converted is formatted anyway

**Observed.** No formatting modifier tested whether its input was a number.
`number`, `date` and `ago` computed `+value || +default`, so a value that
converted to `NaN` was discarded as falsy and the declared default was converted
in its place — or zero, where none was declared. `currency` selected with
`value || default` instead, so a value that was not empty was multiplied by the
ratio and formatted whatever it was:

```curly-example
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

This is the case A.12 does not reach. A.12 records the properties that make a
formatter raise; here the formatter succeeds, and the message renders a count
of zero, an epoch date or a default read as a number — none of which a caller
can tell apart from a real value.

---

## A.14 `{{}}` is literal text while `{{ }}` resolves

**Observed.** An empty placeholder was not recognized. The same construct with a
single space between the braces was:

```curly-example
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

## A.15 A backslash before the opening pair does not suppress it

**Observed.** A backslash in front of `{{` did not stop the pair from opening a
placeholder. It stayed where it was, to be read by the unescaping pass against
whatever the resolved value put after it:

```curly-example
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

## A.16 The closing pair is found by a different rule than the opening one

**Observed.** A backslash before `}` did not stop the pair from closing. The
backslash was taken into the key instead, so `\}` and `\\` yielded the same key
and no key could hold a closing brace:

```curly-example
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

## A.17 A message that does not exist resolves to its key

**Observed.** Where no message existed, the key the message had been requested
under was handed to interpolation in the message's place, so it was scanned for
placeholders and unescaped like a message. Every line below resolves a message
that does not exist:

```curly-example
key "{{name}}"  payload { name: "Alice" }  ->  "Alice"
key "{{name}}"  no payload                 ->  ""
key "a\;b"      no payload                 ->  "a;b"
key "{{a}}"     payload { a: "{{a}}" }     ->  "{{a}}", and a limit reported
key "{{name}}"  payload { default: <circular> }  ->  "", and a second report
```

**Ruling.** There is no echo, and there is no chain a missing message takes. A
caller that supplies no message has supplied nothing to resolve, and the
resolution is the empty string (section 4).

What to show where a catalogue holds no message for an identifier is a question
about the catalogue, and section 1 declines it along with the catalogue's file
format and its id-namespacing scheme. A host that answers it with the
identifier — as hosts commonly do — answers it in a line of its own, and answers
it correctly by construction: an identifier that never reaches resolution is
never scanned for placeholders, so the divergence observed above has nowhere
left to occur.

The identifier survives as the message's **id** (sections 4 and 14.3), which
reports name so that a report says which message went looking. No step of
resolution reads it and it does not reach the output.

Revision 1.0.0 of the specification ruled the other way: it kept the echo and
required it to be verbatim. An implementation written against that revision
answers a caller who supplies no message with the identifier where this one
answers with the empty string, and the payload's own `default` entry outranked
the identifier there. Nothing else about such an implementation changes.

---

## A.18 A registration that is not a modifier answers to its name

**Observed.** A name counted as registered because the host's table carried it,
whatever it carried under it. An entry that could not be called therefore
answered to its name and failed on the call rather than at registration: the
placeholder resolved to the fallback chain and reported nothing, where a name
nobody registered resolves there and reports.

```curly-example
foo: [1, 2]   {{v:foo; default:D}}        ->  "D", no report
foo: "text"   {{v:foo; default:D}}        ->  "D", no report
eq:  "text"   {{v:eq; X:HIT; default:D}}  ->  "D", no report
eq:  "text"   {{v; X:HIT; default:D}}     ->  "D", no report
nothing       {{v:nosuch; default:D}}     ->  "D", unknown-modifier
```

The two `eq` lines are the sharper ones: registering a non-modifier under a
specified name took the name away from the modifier that held it, so `eq` — the
comparison a placeholder writing options gets whether or not it names one —
stopped comparing. The last line is what the two `foo` lines should have read
as. The two `eq` lines should have compared instead: `eq` is specified, so a
message may write it whether or not a host registers anything under the name
(section 11.4). What a comparison answers turns on the value, which this block
does not state: the two rows are a divergence for a value the comparison
selects `HIT` for — `X`, and `x`, which `eq` reads as the same text
(section 11.1) — and none for a value it selects nothing for, which reaches
`D` with no report whether `eq` compares or not.

A host's table is not the only one. An implementation's own exports are the
layer a host's table composes with, and one implementation exported the `ago`
unit ladder alongside its modifiers, so `{{v:agoMap}}` answered to a private
data table the format never named.

**Ruling.** A name a message may write is one the specification names or one a
host registered a modifier under, so an entry that is not a modifier registers
none (section 11.3). It takes no name of its own, and it does not replace a
modifier already answering to that name. Where nothing else answers to that
name, a message writing it names a modifier nobody registered, which is what it
is: the fallback chain and a report, by section 11.4. Where the specification
names a modifier under it, that modifier answers, which is the case the two
`eq` rows above record.

Composition follows from that rather than needing a rule of its own. Each layer
contributes the modifiers it holds and nothing else, so a bad entry costs a host
the name it wrote and nothing further; a layer read for its modifiers only after
composing would let that entry take the modifier it named down with it.
