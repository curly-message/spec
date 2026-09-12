// Builds the Curly Message Format's site into _site/.
//
// Every page is one markdown file that already lives in this repository, so
// the site says what the repository says or it does not say it at all. The
// output is static HTML: no client-side JavaScript, nothing fetched at
// runtime, and every link relative, so the same build serves from a project
// path and from the root of a domain without being told which.

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const out = join(here, '_site');

const REPO = 'https://github.com/curly-message/spec';
const PARSERS = 'https://github.com/curly-message/parsers';

// The pages, in navigation order. `from` is a path in the repository and `to`
// the file the site serves it as; `toc` gives the page the sidebar its own
// headings build.
const PAGES = [
  {
    from: 'site/index.md',
    to: 'index.html',
    nav: 'Overview',
    tab: 'Curly Message Format',
    description:
      'A small message syntax for software translations: values interpolated through double-curly placeholders that may carry a modifier, a set of options and a fallback.',
  },
  {
    from: 'SPEC.md',
    to: 'spec/index.html',
    nav: 'Specification',
    tab: 'Specification',
    toc: true,
    description:
      'The normative specification of version 1 of the Curly Message Format: grammar, escaping, whitespace, resolution order, modifiers, the fallback chain and error behavior.',
  },
  {
    from: 'conformance/README.md',
    to: 'conformance/index.html',
    nav: 'Conformance',
    tab: 'Conformance set',
    toc: true,
    description:
      'The implementation-independent conformance set: what an implementation is driven through, what it must produce, and how to run it in any language.',
  },
  {
    from: 'brand/README.md',
    to: 'brand/index.html',
    nav: 'Brand',
    tab: 'Brand',
    toc: true,
    description:
      'The icon, the wordmark and the palette they are used in, with the terms they are used under.',
  },
];

// Where a relative link in a source file lands on the site. Anything not named
// here is served from the repository instead, so a link to a file the site
// does not carry still goes somewhere rather than dying quietly.
const ONSITE = new Map([
  ['SPEC.md', 'spec/index.html'],
  ['conformance', 'conformance/index.html'],
  ['conformance/README.md', 'conformance/index.html'],
  ['brand', 'brand/index.html'],
  ['brand/README.md', 'brand/index.html'],
  ['brand/curly-icon.svg', 'brand/curly-icon.svg'],
  ['brand/curly-wordmark.svg', 'brand/curly-wordmark.svg'],
  ['brand/curly-wordmark-no-tagline.svg', 'brand/curly-wordmark-no-tagline.svg'],
  ['brand/usage-wordmark.png', 'brand/usage-wordmark.png'],
  ['brand/usage-icon.png', 'brand/usage-icon.png'],
]);

const ASSETS = [
  'brand/curly-icon.svg',
  'brand/curly-wordmark.svg',
  'brand/curly-wordmark-no-tagline.svg',
  'brand/usage-wordmark.png',
  'brand/usage-icon.png',
];

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A path on the site, as the given page has to spell it: relative, and with
// the index file left off so a directory reads as one.
const href = (target, page) => {
  const rel = posix.relative(posix.dirname(page.to), target);
  return rel.replace(/(^|\/)index\.html$/, '$1') || './';
};

// A link in a source file, as the site has to spell it.
const resolve = (link, page) => {
  if (/^[a-z][a-z0-9+.-]*:/i.test(link) || link.startsWith('#') || link.startsWith('//')) return link;
  const cut = link.indexOf('#');
  const [path, hash] = cut === -1 ? [link, ''] : [link.slice(0, cut), link.slice(cut)];
  const target = posix.normalize(posix.join(posix.dirname(page.from), path)).replace(/\/$/, '');
  const onsite = ONSITE.get(target);
  return (onsite ? href(onsite, page) : `${REPO}/blob/main/${target}`) + hash;
};

const slugger = () => {
  const seen = new Map();
  return (text) => {
    const base =
      text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'section';
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
};

// Renders one source file, and takes its title and its headings out of the
// markdown rather than asking the page to repeat them.
const render = (markdown, page) => {
  const headings = [];
  const slug = slugger();
  let title = null;

  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        const text = html.replace(/<[^>]*>/g, '');
        if (depth === 1 && title === null) {
          title = text;
          return '';
        }
        const id = slug(text);
        if (depth === 2 || depth === 3) headings.push({ depth, id, text });
        return `<h${depth} id="${id}">${html}</h${depth}>\n`;
      },
      link({ href: link, title: label, tokens }) {
        const text = this.parser.parseInline(tokens);
        const attr = label ? ` title="${escape(label)}"` : '';
        return `<a href="${escape(resolve(link, page))}"${attr}>${text}</a>`;
      },
      image({ href: link, title: label, text }) {
        const attr = label ? ` title="${escape(label)}"` : '';
        return `<img src="${escape(resolve(link, page))}" alt="${escape(text)}"${attr} loading="lazy">`;
      },
    },
  });

  // A table is wider than a phone, so each one gets its own scroller and the
  // page itself never scrolls sideways. Markdown tables do not nest, so this
  // wraps each one exactly once.
  const body = marked
    .parse(markdown)
    .replace(/<table>[\s\S]*?<\/table>/g, (table) => `<div class="scroll">${table}</div>`);

  return { body, headings, title };
};

const toc = (headings, page) =>
  !page.toc || headings.length < 3
    ? ''
    : `<details class="toc" open>
<summary>On this page</summary>
<nav aria-label="On this page"><ul>
${headings
  .map((h) => `<li class="d${h.depth}"><a href="#${h.id}">${escape(h.text)}</a></li>`)
  .join('\n')}
</ul></nav>
</details>`;

// A mark, split the way brand/README.md says to split it: one element per
// colour, each carrying its own subpaths together, in their original order and
// still filled nonzero. The first subpath is the brace; what follows is the C
// and, in the wordmark, the letters after it.
const mark = async (file) => {
  const svg = await readFile(join(repo, file), 'utf8');
  const box = svg.match(/viewBox="([^"]+)"/)[1];
  const subpaths = svg
    .match(/ d="([^"]+)"/)[1]
    .trim()
    .split(/(?=M )/)
    .map((d) => d.trim());
  return { box, brace: subpaths[0], ink: subpaths.slice(1).join(' ') };
};

const drawn = ({ box, brace, ink }, className) =>
  `<svg class="${className}" viewBox="${box}" aria-hidden="true" focusable="false">` +
  `<path class="brace" d="${brace}"/><path class="ink" d="${ink}"/></svg>`;

const shell = ({ page, glyph, title, body, sidebar }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(page.to === 'index.html' ? page.tab : `${page.tab} — Curly Message Format`)}</title>
<meta name="description" content="${escape(page.description)}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="${href('favicon.svg', page)}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:ital,wght@0,400;0,600;1,400&family=Outfit:wght@500;600;700&display=swap">
<link rel="stylesheet" href="${href('style.css', page)}">
</head>
<body class="${page.to === 'index.html' ? 'home' : 'doc'}${page.toc ? ' has-toc' : ''}">
<a class="skip" href="#content">Skip to content</a>
<header class="masthead">
  <a class="mark" href="${href('index.html', page)}" aria-label="Curly Message Format">
    ${drawn(glyph, 'wordmark')}
    <span class="rule"></span>
    <span class="tag">Message format</span>
  </a>
  <nav aria-label="Sections"><ul>
${PAGES.map(
  (p) =>
    `    <li><a href="${href(p.to, page)}"${p.to === page.to ? ' aria-current="page"' : ''}>${p.nav}</a></li>`,
).join('\n')}
    <li class="away"><a href="${REPO}">GitHub</a></li>
  </ul></nav>
</header>
<main id="content">
${sidebar}
<article>
<h1>${escape(title)}</h1>
${body}
</article>
</main>
<footer>
  <p class="status"><b>Version 1</b> · stable · identifier <code>curly-message-1</code></p>
  <ul class="elsewhere">
    <li><a href="${REPO}">Specification repository</a></li>
    <li><a href="${PARSERS}">Implementations</a></li>
    <li><a href="https://www.npmjs.com/package/@curly-message/parser">@curly-message/parser</a></li>
    <li><a href="https://www.npmjs.com/package/@curly-message/conformance">@curly-message/conformance</a></li>
  </ul>
  <p class="terms">The specification and the code are MIT. The name and the marks are
    © 2026 G.A.W.Group, s.r.o., all rights reserved, under
    <a href="${REPO}/blob/main/brand/LICENSE">their own terms</a>.</p>
</footer>
</body>
</html>
`;

const build = async () => {
  await rm(out, { recursive: true, force: true });
  const glyph = await mark('brand/curly-wordmark-no-tagline.svg');
  const favicon = await mark('brand/curly-icon.svg');

  for (const page of PAGES) {
    const markdown = await readFile(join(repo, page.from), 'utf8');
    const { body, headings, title } = render(markdown, page);
    if (!title) throw new Error(`${page.from} opens with no heading to take a title from.`);
    const html = shell({ page, glyph, title, body, sidebar: toc(headings, page) });
    const file = join(out, page.to);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html);
    console.log(`${page.from} -> ${page.to} (${headings.length} headings)`);
  }

  await cp(join(here, 'style.css'), join(out, 'style.css'));
  await writeFile(
    join(out, 'favicon.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${favicon.box}">` +
      `<rect width="1024" height="1024" rx="224" fill="#14161A"/>` +
      `<path fill="#F2A61A" d="${favicon.brace}"/><path fill="#F5F5F3" d="${favicon.ink}"/></svg>\n`,
  );
  for (const asset of ASSETS) {
    await mkdir(dirname(join(out, asset)), { recursive: true });
    await cp(join(repo, asset), join(out, asset));
  }
  console.log(`assets -> ${ASSETS.length + 2} files`);
};

await build();
