// The playground's script, and the only one the site carries. It drives a
// single call — `resolve()` — and shows what that call answers with: the
// string, the reports it made along the way, and the parameters the message
// names. It also colours what is typed, through the same module the pages
// are coloured with. All three modules are served from this site; nothing is
// fetched.

import { createExtractor, createParser, cst } from './parser.js';
import { highlight } from './highlight.js';

const field = (id) => document.getElementById(id);

// The four inputs a resolution takes, under the letters the shared link
// spells them with.
const FIELDS = {
  m: field('message'),
  p: field('payload'),
  r: field('props'),
  l: field('locale'),
};

const CASES = {
  greeting: {
    m: 'Hello, {{name; default:Guest;}}!',
    p: '{\n  "name": "Alice"\n}',
    r: '',
    l: 'en',
  },
  order: {
    m: 'Order {{order}} is {{status; shipped:on its way; delivered:delivered; default:still being packed;}}.',
    p: '{\n  "order": "A-2291",\n  "status": "shipped"\n}',
    r: '',
    l: 'en',
  },
  invoice: {
    m: 'Invoice {{total:currency;}} is due {{due:date;}}.',
    p: '{\n  "total": 1290.5,\n  "due": "2026-10-01"\n}',
    r: '{\n  "currency": { "currency": "EUR" },\n  "date": { "dateStyle": "long" }\n}',
    l: 'en',
  },
  nesting: {
    m: 'You have {{count:gt; 0:{{count:number;}}; default:no;}} {{count; 1:message; default:messages;}}.',
    p: '{\n  "count": 0\n}',
    r: '',
    l: 'en',
  },
};

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  // Everything shown here is something the reader typed or something the
  // parser answered with, so it is written as text and never as markup.
  if (text !== undefined) node.textContent = text;
  return node;
};

const fill = (parent, children) => {
  parent.replaceChildren(...children);
};

// A field that holds JSON, read as what it holds: empty is nothing passed, and
// text that is not JSON is reported under the field rather than thrown.
const object = (input, problem) => {
  const text = input.value.trim();
  problem.hidden = true;
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch (error) {
    problem.textContent = `${error.message} — resolving as though nothing was passed.`;
    problem.hidden = false;
    return undefined;
  }
};

const showOutput = (value) => {
  const output = field('output');
  output.classList.toggle('empty', value === '');
  output.textContent = value === '' ? 'The empty string' : value;
};

const showReports = (reports) => {
  const box = field('reports');
  if (!reports.length) {
    fill(box, [el('p', 'quiet', 'Nothing. The resolution had nothing to report.')]);
    return;
  }
  fill(
    box,
    reports.map((report) => {
      const row = el('div', 'report');
      const head = el('p', 'head');
      head.append(el('code', 'code', report.code), el('span', 'origin', report.origin));
      row.append(head, el('p', 'said', report.message));
      if (report.limit !== undefined) row.append(el('p', 'at', `Limit: ${report.limit}`));
      if (report.text) row.append(el('pre', 'excerpt', report.text));
      return row;
    }),
  );
};

const showParams = (params) => {
  const box = field('params');
  if (!params.length) {
    fill(box, [el('p', 'quiet', 'None. The message names no payload entry.')]);
    return;
  }
  fill(
    box,
    params.map(({ name, kind, values, optional }) => {
      const row = el('div', 'param');
      const head = el('p', 'head');
      head.append(el('code', 'name', name), el('span', 'kind', [kind].flat().join(' | ')));
      row.append(head);
      if (values?.length) row.append(el('p', 'values', `Named: ${values.join(', ')}`));
      row.append(el('p', 'at', optional ? 'The message states a fallback.' : 'No fallback stated.'));
      return row;
    }),
  );
};

// The pieces a colouring answers with, as the nodes that draw them. A piece
// under no class is text, and is written as text: the block under a control
// holds nothing the reader did not type.
const draw = (pieces) =>
  pieces.map((piece) => {
    if (piece.nodes) {
      const box = el('span', piece.cls);
      box.append(...draw(piece.nodes));
      return box;
    }
    return piece.cls ? el('span', piece.cls, piece.text) : document.createTextNode(piece.text);
  });

// Draws one control's text into the block beneath it.
const show = (ink, text, pieces) => {
  // A block ends at its last line, and text ending in a line break has one
  // more the control will hold a caret on: without it the two boxes stop
  // agreeing on their height.
  fill(ink, text.endsWith('\n') ? [...draw(pieces), document.createTextNode('\n')] : draw(pieces));
};

const run = () => {
  const message = FIELDS.m.value;
  const payload = object(FIELDS.p, field('payload-bad'));
  const props = object(FIELDS.r, field('props-bad'));
  const locale = FIELDS.l.value || undefined;

  const reports = [];
  const parser = createParser({ onReport: (report) => reports.push(report) });

  show(field('ink'), message, highlight(message, 'curly', cst));
  // The two JSON fields are coloured by scanning rather than by parsing, so
  // text that is not yet an object still colours as far as it reads.
  for (const [name, input] of [
    ['payload-ink', FIELDS.p],
    ['props-ink', FIELDS.r],
  ])
    show(field(name), input.value, highlight(input.value, 'json'));
  showOutput(parser.resolve(message, { payload, props, locale }));
  showReports(reports);
  showParams(createExtractor()(message));
  showCases();
};

// The case travels in the fragment, which no request carries: a link
// reproduces what is on screen without any of it reaching a server.
const share = () => {
  const state = new URLSearchParams();
  for (const [name, input] of Object.entries(FIELDS)) if (input.value) state.set(name, input.value);
  const query = `${state}`;
  history.replaceState(null, '', query ? `#${query}` : location.pathname);
};

const load = (state) => {
  for (const [name, input] of Object.entries(FIELDS)) input.value = state[name] ?? '';
  // A locale is chosen from a list, so a link naming one that is not on it
  // leaves the control holding nothing. The list has no empty entry, so the
  // first is what a case that named no locale meant.
  if (!FIELDS.l.value) FIELDS.l.value = 'en';
  run();
};

// A case is shown as chosen only while the page still holds what it loads:
// editing any field moves off the case, and typing back onto it returns.
const chosen = () =>
  Object.keys(CASES).find((name) =>
    Object.entries(FIELDS).every(([key, input]) => input.value === CASES[name][key]),
  );

const showCases = () => {
  const name = chosen();
  for (const button of field('cases').querySelectorAll('button'))
    button.setAttribute('aria-pressed', String(button.dataset.case === name));
};

const fragment = () => Object.fromEntries(new URLSearchParams(location.hash.slice(1)));

field('inputs').addEventListener('input', () => {
  run();
  share();
});

field('cases').addEventListener('click', (event) => {
  const name = event.target.dataset?.case;
  if (!name) return;
  load(CASES[name]);
  share();
});

addEventListener('hashchange', () => load(fragment()));

load(location.hash.length > 1 ? fragment() : CASES.order);
