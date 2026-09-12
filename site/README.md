# site

Source of the format's public site.

Four pages, each rendered from a markdown file that already lives in this
repository, so the site says what the repository says or it does not say it at
all:

| Page | Built from |
| --- | --- |
| `/` | [`site/index.md`](./index.md) |
| `/spec/` | [`SPEC.md`](../SPEC.md) |
| `/conformance/` | [`conformance/README.md`](../conformance/README.md) |
| `/brand/` | [`brand/README.md`](../brand/README.md) |

`index.md` is the only page written for the site. Everything else is a
document that stands on its own; changing one of them changes the site.

## Building

```sh
npm ci
npm run build     # -> _site/
```

`build.mjs` is the whole generator: it renders the markdown with
[`marked`](https://github.com/markedjs/marked), rewrites each relative link to
where it lands on the site (anything the site does not carry points back at the
repository), builds the sidebar from the headings it just rendered, and copies
the marks out of [`brand/`](../brand).

The output is static HTML. It carries no client-side JavaScript, fetches
nothing at runtime, and spells every link relative to the page it is on, so the
same build serves from a project path and from the root of a domain without
being told which.

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
face; the prose is Literata; code takes the reader's own monospace.

The masthead carries the whole lockup on one line: the wordmark without its
tagline, which is the file `brand/` prescribes at this size, then a hairline
rule, then the tagline beside it rather than under it — set as text in the
setting `brand/README.md` records for it, so it stays selectable and takes the
reader's rendering. Its three colours are the plate's: the brace in the theme
colour, the letters in the base, the tagline dimmed.
