# site

Source of the format's public site.

Seven pages. Six of them are rendered from a markdown file that already lives
in this repository, so the site says what the repository says or it does not
say it at all; the seventh runs the parser:

| Page | Built from |
| --- | --- |
| `/` | [`site/index.md`](./index.md) |
| `/spec/` | [`SPEC.md`](../SPEC.md) |
| `/cst/` | [`CST.md`](../CST.md) |
| `/conformance/` | [`conformance/README.md`](../conformance/README.md) |
| `/runner/` | [`conformance/RUNNER.md`](../conformance/RUNNER.md) |
| `/playground/` | [`site/playground.html`](./playground.html) + [`site/playground.js`](./playground.js) + [`site/highlight.js`](./highlight.js) |
| `/brand/` | [`brand/README.md`](../brand/README.md) |

`index.md` and the playground are the only pages written for the site.
Everything else is a document that stands on its own; changing one of them
changes the site.

## Building

```sh
npm ci
npm run build     # -> _site/
npm test          # builds, then reads the pages back
```

`build.mjs` is the whole generator: it renders the markdown with
[`marked`](https://github.com/markedjs/marked), rewrites each relative link to
where it lands on the site (anything the site does not carry points back at the
repository), colours every code fence whose language it reads, builds the
sidebar from the headings it just rendered, and copies the marks out of
[`brand/`](../brand). For the playground it copies three modules instead:
`playground.js`, `highlight.js`, and `@curly-message/parser` as this package's
lockfile pins it.

`npm test` builds and then reads what the build wrote. Colouring adds markup
and changes no character, so every fence on every page must spell its source
back exactly: the test lifts each one out of the rendered HTML, drops the spans
and holds what is left to the markdown it came from. The pages carry the
specification's own examples, and a colouring that dropped, doubled or
mis-escaped one would not fail the build — it would print a message the
specification does not spell, and a reader would copy it. The page list is held
too, so a page added to `build.mjs` and not to the test fails rather than
going unchecked.

The **Site tests** workflow (`.github/workflows/tests-site.yml`) runs them on
every branch that touches one of the sources above. The **Site** workflow runs
the same tests before it deploys, but only on `main`, which is too late to keep
a change from being merged.

The output is static HTML. The playground is the one page that carries a
script — it runs the parser rather than describing it — and all three of its
modules are served from the site, so nothing is fetched at runtime there
either. Every link a reader follows is spelled relative to the page it is on,
so the same build serves from a project path and from the root of a domain
without being told which. Two addresses are absolute, because they name a copy
rather than follow one: a page's `canonical` link and its `og:url` both point
at `https://curlymessage.dev/`, the copy to index and to share.

## Colour

`site/highlight.js` is the whole of the site's colouring, and both the build
and the playground import it. A call answers with pieces — text under a class,
or a class holding more pieces — and the caller draws them: `build.mjs` writes
them as markup, `playground.js` builds them as nodes. That is the whole of the
difference between a page and the one page that runs, which is why an example
in the specification is drawn exactly as the same message typed into the
playground.

A Curly message is coloured by the format's own parser: `cst()` of the pinned
package, and so the tree [`CST.md`](../CST.md) specifies. The walk emits one
piece per leaf, and the leaves tile the message and spell it back, so nothing
tracks a position and the colouring cannot drift from the parse.

A fence says which reading it wants, and one that names no language is written
plain:

| Fence | Read as |
| --- | --- |
| `curly` | a message, whole |
| `curly-example` | a message a line, and prose about what it makes |
| `json` `ts` `bash` `ebnf` | scanned, not parsed |
| *(none)* | a diagram, a table of shapes, or a notation of its own |

`curly-example` is the shape most of the specification's blocks take: a message
in the first column and what it resolves to in the rest. The two are told apart
by the parse rather than by counting columns — the cut falls at a run of two or
more spaces that the parser left as plain text, so alignment spacing inside a
placeholder never opens a column, and a `{{…}}` quoted as an outcome is drawn
as the string it is rather than as a placeholder it is not. A line the parser
found no construct in at all is all prose. A block whose backslashes or braces
stand for something other than themselves names no language, because there the
parse would contradict the prose beside it.

The other four languages are scanned with a short set of rules rather than
parsed. There are a handful of such fences on the whole site and a reader can
check every one of them by eye, so a parser for each would be a dependency
bought at a price the site does not pay elsewhere. They are drawn in the same six hues
the format is, so a page spends no colour it had not already spent.

## The playground

`site/playground.html` is the page's body and `site/playground.js` drives it.
It makes one call — `resolve()` — with the four inputs a resolution takes, and
shows the three things the call answers with: the string, the reports (section
14.3 of the specification) and, from the same package's extractor, the
parameters the message names.

The message, the payload and the modifier properties are all coloured as they
are typed. What draws the colours is a block under a control whose own text is
transparent — both hold the same string and are given the same font, size, line
height, padding and wrapping, which is the whole of what makes them agree on
where a line breaks. The two JSON fields are scanned rather than parsed, so a
field mid-edit still colours as far as it reads instead of waiting for the text
to become an object.

The locale is chosen from a list rather than typed, because the three it offers
are there to be switched between: the same message and payload come out
differently under each, which is the point the locale-dependent modifiers make.

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

The **Site** workflow (`.github/workflows/site.yml`) builds, checks and deploys
on a push to `main` that touches any of the sources above, and on demand. The
check is `npm test`, so a build whose pages no longer spell their sources back
is not deployed. It needs
the repository's Pages source set to **GitHub Actions**; with the source left
at a branch, the build succeeds and the deployment fails.

The site carries no `CNAME`: it serves from wherever Pages puts it. Pointing a
domain at it is a setting, and the one place the build spells a domain is the
`SITE` constant the canonical link and the link preview are built from.

## Look

Both palettes of [`brand/README.md`](../brand/README.md), one per ground: the
page takes whichever the reader's system asks for, and the theme colour of that
ground is the only colour on it. Headings are set in Outfit, the wordmark's own
face; the prose is Literata; code, and every field of the playground, takes the
reader's own monospace.

Code is the one place that spends more than the theme colour, because there it
is the content: six hues that have to stay apart from one another, on both
grounds. They are the site's and not the brand's — a mark is read at a glance
and a message is read closely, so they are not answering the same question.
Each is a token stated once per ground beside the rest, so a ground is still
read from one place. The other languages are drawn in those same six, which is
why adding them cost the page no colour.

The masthead carries the whole lockup on one line: the wordmark without its
tagline, which is the file `brand/` prescribes at this size, then a hairline
rule, then the tagline beside it rather than under it, broken over two lines so
the pair stands as tall as the wordmark does. It is set as text in the setting
`brand/README.md` records for it, so it stays selectable and takes the reader's
own rendering. Its three colours are the plate's: the brace in the theme
colour, the letters in the base, the tagline dimmed.
