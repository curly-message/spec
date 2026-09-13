// The playground's script, and the only one the site carries. It drives a
// single call — `resolve()` — and shows what that call answers with: the
// string, the reports it made along the way, and the parameters the message
// names. Both modules are served from this site; nothing is fetched.

import { createExtractor, createParser } from './parser.js';

const field = (id) => document.getElementById(id);

// The five inputs are the four a resolution takes and the message's id, under
// the letters the shared link spells them with. The id reaches no step of
// resolution: it is what a report names the message by.
const FIELDS = {
  m: field('message'),
  p: field('payload'),
  r: field('props'),
  l: field('locale'),
  i: field('id'),
};

const CASES = {
  greeting: {
    m: 'Hello, {{name; default:Guest;}}!',
    p: '{\n  "name": "Alice"\n}',
    r: '',
    l: 'en',
    i: 'greeting',
  },
  order: {
    m: 'Order {{order}} is {{status; shipped:on its way; delivered:delivered; default:still being packed;}}.',
    p: '{\n  "order": "A-2291",\n  "status": "shipped"\n}',
    r: '',
    l: 'en',
    i: 'order',
  },
  invoice: {
    m: 'Invoice {{total:currency;}} is due {{due:date;}}.',
    p: '{\n  "total": 1290.5,\n  "due": "2026-10-01"\n}',
    r: '{\n  "currency": { "currency": "EUR" },\n  "date": { "dateStyle": "long" }\n}',
    l: 'en',
    i: 'invoice',
  },
  nesting: {
    m: 'You have {{count:gt; 0:{{count:number;}}; default:no;}} {{count; 1:message; default:messages;}}.',
    p: '{\n  "count": 0\n}',
    r: '',
    l: 'en',
    i: 'nesting',
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
      if (report.id !== undefined) row.append(el('p', 'at', `Id: ${report.id}`));
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

const run = () => {
  const message = FIELDS.m.value;
  const payload = object(FIELDS.p, field('payload-bad'));
  const props = object(FIELDS.r, field('props-bad'));
  const locale = FIELDS.l.value.trim() || undefined;
  const id = FIELDS.i.value.trim() || undefined;

  const reports = [];
  const parser = createParser({ onReport: (report) => reports.push(report) });

  showOutput(parser.resolve(message, { payload, props, locale, id }));
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
