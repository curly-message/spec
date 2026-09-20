// Colouring adds markup and changes no character.
//
// Every page but the playground is a markdown file that already lives in this
// repository, and the fences on it are the specification's own examples. The
// colouring takes each one apart with the parser, wraps the pieces in spans
// and puts them back together, so a bug there does not fail the build — it
// prints a message the specification does not spell, and a reader copies it.
// This reads every fence back out of the rendered page and holds it to its
// source, character for character.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const site = fileURLToPath(new URL('..', import.meta.url));
const repo = join(site, '..');
const out = join(site, '_site');

// The markdown each page is rendered from. The playground is written as HTML
// rather than rendered, so it carries no fence of its own and is named here
// as carrying none.
const PAGES = {
  'index.html': 'site/index.md',
  'spec/index.html': 'SPEC.md',
  'cst/index.html': 'CST.md',
  'conformance/index.html': 'conformance/README.md',
  'runner/index.html': 'conformance/RUNNER.md',
  'playground/index.html': null,
  'brand/index.html': 'brand/README.md',
};

const pages = (dir = out, under = '') =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? pages(join(dir, entry.name), posix.join(under, entry.name))
      : entry.name.endsWith('.html')
        ? [posix.join(under, entry.name)]
        : [],
  );

// A fence as the source spells it: its info string, and the lines between the
// two rows of backticks.
const fences = (markdown) => {
  const found = [];
  let info = null;
  let held = [];

  for (const line of markdown.split('\n')) {
    const row = /^```(.*)$/.exec(line);
    if (row && info === null) {
      info = row[1].trim();
      held = [];
    } else if (row) {
      found.push({ info, source: held.join('\n') });
      info = null;
    } else if (info !== null) held.push(line);
  }

  return found;
};

// The same fence as the page draws it. The spans the colouring added are the
// markup to drop; what the writer escaped to keep them apart from the text is
// read back, ampersands last so an escape the source itself spells survives.
const drawn = (html) =>
  [...html.matchAll(/<pre><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g)].map(
    ([, info, body]) => ({
      info: info ?? '',
      source: body
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/\n$/, ''),
    }),
  );

const built = Object.fromEntries(
  Object.keys(PAGES).map((page) => [page, readFileSync(join(out, page), 'utf8')]),
);

test('renders the pages this test knows about, and no others', () => {
  assert.deepEqual(pages().sort(), Object.keys(PAGES).sort());
});

test('spells every fence back exactly, under the language it was written in', () => {
  let held = 0;

  for (const [page, from] of Object.entries(PAGES)) {
    if (from === null) continue;

    const want = fences(readFileSync(join(repo, from), 'utf8'));
    const got = drawn(built[page]);

    assert.equal(got.length, want.length, `${from}: ${want.length} fences, ${page} draws ${got.length}`);
    for (const [at, fence] of want.entries()) assert.deepEqual(got[at], fence, `${from} fence ${at + 1}`);
    held += want.length;
  }

  // A build that drew no fence at all would satisfy every assertion above.
  assert.ok(held > 20, `${held} fences held to their source`);
});

test('never cuts a worked example inside a placeholder', () => {
  // A `curly-example` line is a message, or prose, or a message and the prose
  // about it cut apart at a run of spaces the parse found no construct in —
  // so the cut cannot fall inside a placeholder. Were it to, the prose would
  // be drawn nested in the placeholder it split: a `tok-` span inside an
  // `ink-ph` one, which is what this looks for.
  const split = /<span class="ink-ph">(?:(?!<\/span>)[\s\S])*<span class="tok-/;
  const cut = [];

  for (const [page, html] of Object.entries(built))
    for (const [, body] of html.matchAll(/<pre><code class="language-curly-example">([\s\S]*?)<\/code><\/pre>/g))
      for (const line of body.split('\n')) if (split.test(line)) cut.push(`${page}: ${line}`);

  assert.deepEqual(cut, []);
});
