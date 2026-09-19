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

The format is deliberately small. It has no plural categories, and a
placeholder holds a placeholder in an option value and nowhere else; formatting
that depends on a locale — `number`, `date`, `currency`, `ago` — is delegated
to the host platform's internationalization facilities, and renders the empty
string where the caller supplied no locale, which is why the example above
names one.

## Status

The specification is **stable**. Version 2 of the format is settled: within
`curly-message-2`, what a message resolves to does not change, and an amendment
that would change it belongs to a later version of the format rather than to
this one. The promise is about messages: a caller that supplied none wrote
nothing for the document to settle. Revisions of the document are tagged in this
repository, beginning at `v1.0.0`, and [`CHANGELOG.md`](./CHANGELOG.md) says
what each one changed.

**Version 2 is not compatible with version 1.** Message text is syntax and
payload text is data: a message is resolved in one walk, nothing it emits is
read back, and a placeholder nests where the message spells it nesting rather
than where a payload arranges one. Appendix C of [`SPEC.md`](./SPEC.md) lists
every change and what each costs a message written against version 1.

The conformance set and the reference implementation are on npm. Each releases
on a line of its own, against the revision of this document its own changelog
names.

The syntax grew out of `@sveltekit-i18n/parser-default`, where it was defined
implicitly — by the implementation, its README and its test suite, which diverge
in edge cases. This repository exists to give the format a specification that
stands on its own, so that other implementations can target it and agree on the
edges.

Contents:

| Path | State | Purpose |
| --- | --- | --- |
| [`SPEC.md`](./SPEC.md) | Stable | The specification: grammar, escaping, whitespace, resolution order, modifier semantics, fallback chain, error behavior |
| [`CST.md`](./CST.md) | Settled against one implementation | A companion document: the concrete syntax tree for a message, for a tool that shows a message rather than resolving it. It adds nothing to the format — sections 6, 7 and 8 of `SPEC.md` already say where every character belongs, and the tree gives that answer a shape two implementations can hand to the same tool. It is not a conformance level, and an implementation conforms without offering a tree |
| [`conformance/`](./conformance) | Stable, on npm | The conformance set, published as `@curly-message/conformance`: implementation-independent fixtures — the inputs a resolution takes and the output and reports it must produce, each pinned to the section it tests, and the tree of `CST.md` for an implementation that offers one — with the JSON Schema they validate against, a manifest, and a JavaScript runner that drives an implementation through the adapter of section 14.3. For the locale-dependent modifiers a fixture states the formatting request, and the runner performs it on the host it runs on. `RUNNER.md` states what a runner in another language is held to, and `defects.json` is the catalogue of deliberately wrong adapters it is audited against |
| [`brand/`](./brand) | Stable | The visual identity: the icon and the wordmark as SVGs, and the palette they are used in, under [their own terms](./brand/LICENSE) |
| [`site/`](./site) | Stable | Source of the format's public site: six pages rendered from the markdown already in this repository, plus a playground that runs the reference implementation in the browser, deployed to GitHub Pages by the **Site** workflow |

Appendix A of [`SPEC.md`](./SPEC.md) records each behavior of the pre-3.0
implementation the document was written against, together with the ruling that
resolved it. Those rulings are accepted and already stated in the body of the
document; the appendix is a historical record, not a second set of requirements.
Appendix C is the other historical document: it says what version 2 changed
from version 1, and is where a message written against version 1 is migrated
from.

The machine-readable identifier for the format is `curly-message`; versioned
references use `curly-message-2`, and so on.

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
`SPEC.md`, `CST.md`, `conformance/README.md`, `conformance/RUNNER.md` and
`brand/README.md` rendered as they stand, plus a landing page and a playground
written for it, so a change to any of those documents is a change to the site.
The playground resolves a message in the reader's browser against the release
of `@curly-message/parser` the site's lockfile pins, and shows the reports and
the parameters alongside the string. [`site/README.md`](./site/README.md) says
how it is built and what it needs.

## Releasing the specification

A revision of the document is cut from `main` by the **Specification release**
workflow (`.github/workflows/release-spec.yml`, started by hand). A document has
no manifest to bump, so it takes the revision as `major.minor.patch` and reads
it back against the document: a revision already tagged is refused, and so is
one whose major is not the version of the format `SPEC.md` specifies. It runs
the conformance set — which is what holds every section a fixture cites to a
heading of the document — turns the changelog's pending section into the
revision's, commits, tags (`v2.0.0`), pushes, and publishes a GitHub release
carrying that changelog section. That section names the revision it will be
cut as — `### 1.1.0 (Unreleased)` — so a revision is settled in the commit
that writes the section rather than in the dispatch: a run dispatched as
anything else is refused, and so is a changelog that holds no such section.

The document's line and the conformance set's are separate: the set may release
against a document that has not changed, and the document may be revised
without the set moving. Each keeps its own changelog.

## Releasing the conformance set

`@curly-message/conformance` is released from `main` by the **Conformance
package publish** workflow (`.github/workflows/publish-conformance.yml`,
started by hand). The changelog's pending section names the version it will be
released as — `### 1.1.0 (Unreleased)` — so a version is settled in the commit
that writes the section rather than in the dispatch. `patch`, `minor` and
`major` cut that section under the `latest` dist-tag, and the run is refused
unless the bump arrives at the version the section names — over an open
prerelease line that is the bump which drops the prerelease rather than the one
that opened it, so `1.1.0-next.3` reaches `1.1.0` under `patch`. `next`
publishes a prerelease of that same version — `1.1.0-next.0`, then `.1` — under
the `next` dist-tag and leaves the section open, because a prerelease has not
released what the section names. The workflow runs the package's test matrix,
bumps the version, cuts the section where the release closes it, commits, tags
(`conformance-v3.0.0`), pushes, publishes to npm, and publishes a GitHub
release carrying that changelog section.

That release also carries the set as a file: `conformance-<version>.zip`,
holding the fixtures, the manifest, the defect catalogue a runner is audited
against, both schemas and the two documents that state what they hold, under one
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
