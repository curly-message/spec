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
`currency`, `ago` — is delegated to `Intl`.

## Status

This repository is being seeded. **Nothing here is normative yet.**

The syntax grew out of `@sveltekit-i18n/parser-default`, where it has so far
been defined implicitly — by the implementation, its README and its test suite,
which diverge in edge cases. This repository exists to give the format a
specification that stands on its own, so that other implementations can target
it and agree on the edges.

The specification will document the behavior of the v3 parser family, which has
not been released yet. Until then, the reference implementation is the only
authority on what the syntax means.

Planned contents:

| Path | Purpose |
| --- | --- |
| `SPEC.md` | The specification: grammar, escaping, whitespace, resolution order, modifier semantics, fallback chain, error behavior |
| `conformance/` | Implementation-independent fixtures — message, payload, expected output |
| `site/` | Source of the format's public site |

The machine-readable identifier for the format is `curly-message`; versioned
references use `curly-message-1`, and so on.

## Reference implementation

[`@sveltekit-i18n/parser-default`](https://github.com/sveltekit-i18n/parsers/tree/master/parser-default),
part of the [sveltekit-i18n](https://github.com/sveltekit-i18n/lib) ecosystem.

## License

[MIT](./LICENSE)
