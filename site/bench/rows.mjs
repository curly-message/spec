// The rows `bench/harness.mjs` measures, each on the build in `_site/`.
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname } from 'node:path';
import { chromium } from 'playwright-core';

const SITE = new URL('../_site/', import.meta.url);
const PLACEHOLDERS = 2000;

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

const size = (path) => readFileSync(new URL(path, SITE)).length;

// The build served as the site serves it, a directory by its index.
const serve = () =>
  new Promise((resolve) => {
    const server = createServer(async (request, response) => {
      const path = new URL(request.url, 'http://localhost').pathname.slice(1);
      const file = new URL(path.endsWith('/') || !path ? `${path}index.html` : path, SITE);

      try {
        const body = await readFile(file);

        response.writeHead(200, { 'content-type': TYPES[extname(file.pathname)] ?? 'application/octet-stream' });
        response.end(body);
      } catch {
        response.writeHead(404);
        response.end();
      }
    });

    server.listen(0, '127.0.0.1', () => resolve(server));
  });

// What each run of the keystroke row holds open, closed by its `close`. Both
// sides of a comparison run it at once, and import one module when they are
// one package, so a run keeps its own rather than one slot the other
// overwrites.
const held = [];

// The playground holding a message of PLACEHOLDERS placeholders. A run is one
// keystroke: a character typed onto the end or taken off it, alternately, so
// every run does the same work, and the layout it leaves read back, so what
// the browser defers to its next frame is part of the run. What the page
// throws fails the row, since a keystroke that stops short is no faster one.
const keystroke = async () => {
  const server = await serve();

  held.push(server);

  const browser = await chromium.launch();

  held.push(browser);

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const fail = (errors) => {
    if (errors.length) throw new Error(`the playground threw: ${errors[0]}`);
  };

  await page.addInitScript(() => {
    globalThis.thrown = [];
    addEventListener('error', (event) => globalThis.thrown.push(event.message));
    addEventListener('unhandledrejection', (event) => globalThis.thrown.push(String(event.reason)));
  });
  // The fonts come from a third party; waiting on one would time the network.
  await page.route((url) => url.origin !== origin, (route) => route.abort());
  await page.goto(`${origin}/playground/#${new URLSearchParams({ m: '{{a; x:y}}'.repeat(PLACEHOLDERS) })}`);
  await page.waitForFunction((count) => globalThis.thrown.length || document.querySelectorAll('#ink .ink-ph').length === count, PLACEHOLDERS);
  fail(await page.evaluate(() => globalThis.thrown));

  return async () => {
    const { thrown } = await page.evaluate(() => {
      const message = document.querySelector('#message');

      message.value = message.value.endsWith('!') ? message.value.slice(0, -1) : `${message.value}!`;
      message.dispatchEvent(new Event('input', { bubbles: true }));

      return { height: document.body.offsetHeight, thrown: globalThis.thrown };
    });

    fail(thrown);
  };
};

const close = async () => {
  for (const handle of held.splice(0).reverse()) await handle.close();
};

export default [
  { name: 'playground/index.html', kind: 'size', run: () => size('playground/index.html') },
  { name: 'favicon.svg', kind: 'size', run: () => size('favicon.svg') },
  { name: 'style.css', kind: 'size', run: () => size('style.css') },
  { name: 'playground/app.js', kind: 'size', run: () => size('playground/app.js') },
  { name: 'playground/highlight.js', kind: 'size', run: () => size('playground/highlight.js') },
  { name: 'playground/parser.js', kind: 'size', run: () => size('playground/parser.js') },
  { name: `playground: one keystroke over ${PLACEHOLDERS.toLocaleString('en-US')} placeholders`, kind: 'time', run: keystroke, close },
];
