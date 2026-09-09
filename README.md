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
locale "en"

greeting  { name: 'Alice' }  ->  "Hello, Alice!"
greeting  {}                 ->  "Hello, Guest!"
inbox     { count: 1 }       ->  "You have 1 message."
inbox     { count: 1234 }    ->  "You have 1,234 messages."
```

The format is deliberately small. It has no plural categories and no nested
argument syntax; formatting that depends on a locale — `number`, `date`,
`currency`, `ago` — is delegated to the host platform's internationalization
facilities, and renders the empty string where the caller supplied no locale,
which is why the example above names one.

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
| [`conformance/`](./conformance) | Working draft | The conformance set, to be published as `@curly-message/conformance`: implementation-independent fixtures — the inputs a resolution takes and the output and reports it must produce, each pinned to the section it tests — with the JSON Schema they validate against, a manifest, and a JavaScript runner that drives an implementation through the adapter of section 14.3. For the locale-dependent modifiers a fixture states the formatting request, and the runner performs it on the host it runs on |
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

## Releasing the conformance set

`@curly-message/conformance` is released from `main` by the **Conformance
package publish** workflow (`.github/workflows/publish-conformance.yml`,
started by hand). `next` bumps the prerelease counter and publishes under the
`next` dist-tag; `patch`, `minor` and `major` cut a release under `latest`,
closing any prerelease line. The workflow runs the package's test matrix,
bumps the version, turns the changelog's `## Unreleased` section into the
version's, commits, tags (`conformance-v1.0.0`), pushes, publishes to npm,
and publishes a GitHub release carrying that changelog section. A release
whose changelog has no `## Unreleased` section is refused.

The commit, the tag and the release are made as a GitHub App, whose id and
private key the repository holds as the `APP_ID` variable and the
`APP_PRIVATE_KEY` secret. npm holds no token: the workflow is the package's
[trusted publisher](https://docs.npmjs.com/trusted-publishers), registered
in the package's settings on npmjs.com or with
`npm trust github --file publish-conformance.yml --repository curly-message/spec --allow-publish`
— the calling workflow's filename, which is the one the registry checks — and
the registry attaches provenance itself. A trusted publisher can be
registered only for a package that exists, so the first version is published
by hand once, from `main`, by a maintainer of the scope
(`cd conformance && npm ci && npm publish --access public --tag next`); the
workflow refuses to run before that.

## License

[MIT](./LICENSE)
