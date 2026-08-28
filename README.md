# Curly Message Format

A small message syntax for software translations. Values are interpolated
through double-curly placeholders, which may carry a modifier, a set of options
and a fallback.

```json
{
  "greeting": "Hello, {{name; default:Guest;}}!",
  "inbox": "You have {{count:number;}} {{count; 1:message; default:messages;}}."
}
```

```
greeting  { name: 'Alice' }  ->  "Hello, Alice!"
greeting  {}                 ->  "Hello, Guest!"
inbox     { count: 1 }       ->  "You have 1 message."
inbox     { count: 1234 }    ->  "You have 1,234 messages."
```

The format is deliberately small. It has no plural categories and no nested
argument syntax; formatting that depends on a locale — `number`, `date`,
`currency`, `ago` — is delegated to the host platform's internationalization
facilities.

## Status

The specification is a **working draft**: its rulings are settled and written
into the body of the document, which is what an implementation targets. Nothing
has been tagged or published against it yet, so the draft is still amended in
place rather than versioned.

The syntax grew out of `@sveltekit-i18n/parser-default`, where it was defined
implicitly — by the implementation, its README and its test suite, which diverge
in edge cases. This repository exists to give the format a specification that
stands on its own, so that other implementations can target it and agree on the
edges.

Contents:

| Path | State | Purpose |
| --- | --- | --- |
| [`SPEC.md`](./SPEC.md) | Working draft | The specification: grammar, escaping, whitespace, resolution order, modifier semantics, fallback chain, error behavior |
| `conformance/` | Planned | Implementation-independent fixtures — message, payload, expected output; for the locale-dependent modifiers, the formatting request instead of an output string |
| `site/` | Planned | Source of the format's public site |

Appendix A of [`SPEC.md`](./SPEC.md) records each behavior of the pre-3.0
implementation the draft was written against, together with the ruling that
resolved it. Those rulings are accepted and already stated in the body of the
document; the appendix is a historical record, not a second set of requirements.

The machine-readable identifier for the format is `curly-message`; versioned
references use `curly-message-1`, and so on.

## Reference implementation

[`@curly-message/parser`](https://github.com/curly-message/parsers/tree/main/js),
the JavaScript implementation in the
[curly-message/parsers](https://github.com/curly-message/parsers) repository. It
is not published yet, and it is a reference rather than the definition — an
implementation in any language that satisfies section 2 conforms, whether or not
it shares any code with it.

## License

[MIT](./LICENSE)
