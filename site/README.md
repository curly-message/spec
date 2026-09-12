# site

Source of the format's public site.

Five pages. Four of them are rendered from a markdown file that already lives
in this repository, so the site says what the repository says or it does not
say it at all; the fifth runs the parser:

| Page | Built from |
| --- | --- |
| `/` | [`site/index.md`](./index.md) |
| `/spec/` | [`SPEC.md`](../SPEC.md) |
| `/conformance/` | [`conformance/README.md`](../conformance/README.md) |
| `/brand/` | [`brand/README.md`](../brand/README.md) |
| `/playground/` | [`site/playground.html`](./playground.html) + [`site/playground.js`](./playground.js) |

`index.md` and the playground are the only pages written for the site.
Everything else is a document that stands on its own; changing one of them
changes the site.

## Building

```sh
npm ci
npm run build     # -> _site/
```

`build.mjs` is the whole generator: it renders the markdown with
[`marked`](https://github.com/markedjs/marked), rewrites each relative link to
where it lands on the site (anything the site does not carry points back at the
repository), builds the sidebar from the headings it just rendered, and copies
the marks out of [`brand/`](../brand). For the playground it copies two
modules instead: `playground.js`, and `@curly-message/parser` as this
package's lockfile pins it.

The output is static HTML. The playground is the one page that carries a
script — it runs the parser rather than describing it — and both of its
modules are served from the site, so nothing is fetched at runtime there
either. Every link is spelled relative to the page it is on, so the same build
serves from a project path and from the root of a domain without being told
which.

## The playground

`site/playground.html` is the page's body and `site/playground.js` drives it.
It makes one call — `resolve()` — and shows the three things the call answers
with: the string, the reports (section 14.3 of the specification) and, from
the same package's extractor, the parameters the message names.

The build vendors `@curly-message/parser` out of `node_modules` and prints the
version it took; the page names that version to the reader. A release the
lockfile does not name cannot reach the page, and a runtime CDN would make a
static page depend on a third party staying up.

The case travels in the fragment, so a link reproduces exactly what is on
screen and none of it reaches a server. Locale-dependent modifiers render
through the reader's own browser, which the page says outright — the same
determinism the conformance set has to state for its own fixtures.

To read it locally, serve `_site/` rather than opening the files — a directory
link needs a server to resolve to its `index.html`:

```sh
python3 -m http.server --directory _site 8000
```

## Deploying

The **Site** workflow (`.github/workflows/site.yml`) builds and deploys on a
push to `main` that touches any of the sources above, and on demand. It needs
the repository's Pages source set to **GitHub Actions**; with the source left
at a branch, the build succeeds and the deployment fails.

The site carries no `CNAME`: it serves from wherever Pages puts it. Pointing a
domain at it is a setting and one file, and no link in the build has to change.

## Look

Both palettes of [`brand/README.md`](../brand/README.md), one per ground: the
page takes whichever the reader's system asks for, and the theme colour of that
ground is the only colour on it. Headings are set in Outfit, the wordmark's own
face; the prose is Literata; code, and every field of the playground, takes the
reader's own monospace.

The masthead carries the whole lockup on one line: the wordmark without its
tagline, which is the file `brand/` prescribes at this size, then a hairline
rule, then the tagline beside it rather than under it, broken over two lines so
the pair stands as tall as the wordmark does. It is set as text in the setting
`brand/README.md` records for it, so it stays selectable and takes the reader's
own rendering. Its three colours are the plate's: the brace in the theme
colour, the letters in the base, the tagline dimmed.
