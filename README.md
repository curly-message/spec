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

The specification is **stable**. Version 1 of the format is settled: within
`curly-message-1`, what a message resolves to does not change, and an amendment
that would change it belongs to a later version of the format rather than to
this one. Revisions of the document are tagged in this repository, beginning at
`v1.0.0`, and [`CHANGELOG.md`](./CHANGELOG.md) says what each one changed.

The conformance set and the reference implementation are on npm as `1.0.0`,
released against this document.

The syntax grew out of `@sveltekit-i18n/parser-default`, where it was defined
implicitly — by the implementation, its README and its test suite, which diverge
in edge cases. This repository exists to give the format a specification that
stands on its own, so that other implementations can target it and agree on the
edges.

Contents:

| Path | State | Purpose |
| --- | --- | --- |
| [`SPEC.md`](./SPEC.md) | Stable | The specification: grammar, escaping, whitespace, resolution order, modifier semantics, fallback chain, error behavior |
| [`conformance/`](./conformance) | Stable, on npm | The conformance set, published as `@curly-message/conformance`: implementation-independent fixtures — the inputs a resolution takes and the output and reports it must produce, each pinned to the section it tests — with the JSON Schema they validate against, a manifest, and a JavaScript runner that drives an implementation through the adapter of section 14.3. For the locale-dependent modifiers a fixture states the formatting request, and the runner performs it on the host it runs on |
| [`brand/`](./brand) | Stable | The visual identity: the icon and the wordmark as SVGs, and the palette they are used in, under [their own terms](./brand/LICENSE) |
| [`site/`](./site) | Stable | Source of the format's public site: four pages rendered from the markdown already in this repository, deployed to GitHub Pages by the **Site** workflow |

Appendix A of [`SPEC.md`](./SPEC.md) records each behavior of the pre-3.0
implementation the document was written against, together with the ruling that
resolved it. Those rulings are accepted and already stated in the body of the
document; the appendix is a historical record, not a second set of requirements.

The machine-readable identifier for the format is `curly-message`; versioned
references use `curly-message-1`, and so on.

## Reference implementation

[`@curly-message/parser`](https://github.com/curly-message/parsers/tree/main/js),
the JavaScript implementation in the
[curly-message/parsers](https://github.com/curly-message/parsers) repository,
released on npm. It is a reference rather than the definition — an
implementation in any language that satisfies section 2 conforms, whether or
not it shares any code with it.

## The site

The format's public site is built from this repository by the **Site** workflow
(`.github/workflows/site.yml`) and served from GitHub Pages. Its pages are
`SPEC.md`, `conformance/README.md` and `brand/README.md` rendered as they
stand, plus one landing page written for it, so a change to any of those
documents is a change to the site. [`site/README.md`](./site/README.md) says
how it is built and what it needs.

## Releasing the specification

A revision of the document is cut from `main` by the **Specification release**
workflow (`.github/workflows/release-spec.yml`, started by hand). A document has
no manifest to bump, so it takes the revision as `major.minor.patch` and reads
it back against the document: a revision already tagged is refused, and so is
one whose major is not the version of the format `SPEC.md` specifies. It runs
the conformance set — which is what holds every section a fixture cites to a
heading of the document — turns the changelog's `## Unreleased` section into
the revision's, commits, tags (`v1.0.0`), pushes, and publishes a GitHub
release carrying that changelog section. A revision whose changelog has no
`## Unreleased` section is refused.

The document's line and the conformance set's are separate: the set may release
against a document that has not changed, and the document may be revised
without the set moving. Each keeps its own changelog.

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

That release also carries the set as a file: `conformance-<version>.zip`,
holding `fixtures/`, `index.json` and `schema/fixture.schema.json` under one
directory, with its digest in the notes, for an implementation in a language
npm does not reach. It is packed before anything is pushed or published, so a
path that has moved fails the run rather than dropping out of the archive.

The commit, the tag and the release are made as a GitHub App, whose id and
private key the repository holds as the `APP_ID` variable and the
`APP_PRIVATE_KEY` secret. npm holds no token: the workflow is the package's
[trusted publisher](https://docs.npmjs.com/trusted-publishers), registered
in the package's settings on npmjs.com or with
`npm trust github --file publish-conformance.yml --repository curly-message/spec --allow-publish`
— the calling workflow's filename, which is the one the registry checks — and
the registry attaches provenance itself. A trusted publisher can be
registered only for a package that exists, so the first version,
`1.0.0-next.0`, was published by hand from `main` by a maintainer of the scope
(`cd conformance && npm ci && npm publish --access public --tag next`); the
workflow refuses to run for a package the registry does not know.

## License

The specification and the code are [MIT](./LICENSE).

The marks are not. The name *Curly Message Format*, the icon and the wordmark
in [`brand/`](./brand) are © 2026 G.A.W.Group, s.r.o., all rights reserved,
under the terms in [`brand/LICENSE`](./brand/LICENSE): use them to refer to the
format, unchanged; do not change them or make them your own.
