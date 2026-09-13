# A small message syntax for software translations

Values are interpolated through double-curly placeholders, which may carry a
modifier, a set of options and a fallback. That is the whole of the syntax.

<div class="examples">

```json
{
  "greeting": "Hello, {{name; default:Guest;}}!",
  "inbox": "You have {{count:number;}} {{count; 1:message; default:messages;}}."
}
```

```
locale "en"

greeting  { name: 'Alice' }  ->  "Hello, Alice!"
greeting  {}                 ->  "Hello, Guest!"
inbox     { count: 1 }       ->  "You have 1 message."
inbox     { count: 1234 }    ->  "You have 1,234 messages."
```

</div>

## Deliberately small

The format has no plural categories and no nested argument syntax. Formatting
that depends on a locale — `number`, `date`, `currency`, `ago` — is delegated to
the host platform's internationalization facilities, and renders the empty
string where the caller supplied no locale, which is why the example above names
one.

A resolution never raises and never refuses a message. Where a value is missing,
unusable or absent, the placeholder falls through a chain that is the same four
steps everywhere — the entry's own default, the payload's own default, the
placeholder's inline default, then the empty string — and what went wrong is
reported on a channel the host may or may not listen to. A translation that is
wrong should show as a translation that is wrong, not as a blank page.

## Where to start

<div class="cards">

- **[The specification](../SPEC.md)**
  Grammar, escaping, whitespace, resolution order, the modifiers, the fallback
  chain and the error behavior — all of version 1, in one document.

- **[The conformance set](../conformance)**
  Fixtures in JSON, each pinned to the section it tests: the inputs a resolution
  takes and the output and the reports it must produce.

- **[An implementation](https://github.com/curly-message/parsers)**
  `@curly-message/parser` in JavaScript, released on npm. It is a reference, not
  the definition.

- **[The playground](./playground.html)**
  Resolve a message against a payload in the browser, and see the string, the
  reports and the parameters the message names.

</div>

## Status

The specification is **stable**. Version 1 of the format is settled: within
`curly-message-1`, what a message resolves to does not change, and an amendment
that would change it belongs to a later version of the format rather than to
this one. Revisions of the document are tagged, beginning at `v1.0.0`.

The conformance set and the reference implementation are on npm as `1.0.0`,
released against this document. An implementation in any language that
satisfies section 2 conforms, whether or not it shares any code with the
reference.

## Where it came from

The syntax grew out of `@sveltekit-i18n/parser-default`, where it was defined
implicitly — by the implementation, its README and its test suite, which diverge
in edge cases. This specification exists to give the format a definition that
stands on its own, so that other implementations can target it and agree on the
edges. Appendix A of the specification records each of those divergences
together with the ruling that resolved it.
