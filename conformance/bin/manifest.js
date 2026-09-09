#!/usr/bin/env node
// Regenerates index.json from the fixture files. An output path may be given
// to write the manifest elsewhere, which is how the tests compare the shipped
// one with a fresh one.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const directory = join(root, 'fixtures');

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));

const { version } = read(join(root, 'package.json'));

const files = readdirSync(directory).filter((name) => name.endsWith('.json')).sort().map((name) => {
  const { level, section, cases } = read(join(directory, name));

  return { path: `fixtures/${name}`, level, section, cases: cases.length };
});

const manifest = { format: 'curly-message-1', version, files };

writeFileSync(process.argv[2] ?? join(root, 'index.json'), `${JSON.stringify(manifest, null, 2)}\n`);
