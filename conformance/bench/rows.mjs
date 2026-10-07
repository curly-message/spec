// The rows `bench/harness.mjs` measures, each on the build in `dist/`.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fixtures, plan, run } from '../dist/index.js';

const bundle = () => readFileSync(new URL('../dist/index.js', import.meta.url));

// An adapter claiming every level that answers every case with nothing, so a
// run measures the runner: planning, comparing and describing what failed.
const ADAPTER = {
  levels: ['core', 'intl', 'extensions'],
  limits: { output: 100000, read: 100000, conversion: 100000, nesting: 8 },
  resolve: () => ({ output: '', reports: [] }),
  cst: { unit: 'utf-16', parse: (message) => ({ type: 'message', start: 0, end: message.length, nodes: [] }) },
};

export default [
  { name: 'dist/index.js', kind: 'size', run: () => bundle().length },
  { name: 'dist/index.js, gzipped', kind: 'size', run: () => gzipSync(bundle(), { level: 9 }).length },
  { name: 'fixtures: reading the set', kind: 'time', run: () => fixtures },
  { name: 'plan: the set, for an adapter of every level', kind: 'time', run: () => () => plan(ADAPTER) },
  { name: 'run: the set, against an adapter that answers nothing', kind: 'time', run: () => () => run(ADAPTER) },
];
