import Ajv2020 from 'ajv/dist/2020.js';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fixtures, type Case, type ExpectedNode, type Manifest } from '../../src';
import { NAMED } from '../../src/tree';

const root = fileURLToPath(new URL('../../', import.meta.url));

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as unknown;

const set = fixtures();

// A file pins a resolution or it pins the tree, and the two are read against
// different documents, so they are told apart once here.
const resolutions = set.flatMap(({ name, file }) => file.kind === 'tree' ? [] : file.cases.map((c) => ({ name, c })));

const trees = set.flatMap(({ name, file }) => file.kind === 'tree' ? file.cases.map((c) => ({ name, c })) : []);

const cases = [...resolutions, ...trees];

// A heading is numbered like "## 9. Resolution", "### 9.2 Look up the value"
// or, in the worked examples of `CST.md`, "### A.9 A `{{` in a value"; the
// number is what a section reference names.
const headings = (document: string) => new Set([...readFileSync(join(root, '..', document), 'utf8').matchAll(/^#{2,3} (\d+\.\d+|\d+|A\.\d+)\b/gm)].map(([, number]) => number));

const SPEC = headings('SPEC.md');

const CST = headings('CST.md');

// Every node of a case's expectation, and the text the leaves of it spell.
const flatten = (nodes: ExpectedNode[]): ExpectedNode[] => nodes.flatMap((node) => [node, ...flatten(node.nodes ?? [])]);

const spelled = (nodes: ExpectedNode[]): string => nodes.map((node) => node.nodes?.length ? spelled(node.nodes) : node.text).join('');

describe('the shipped set', () => {
  it('validates against the schema', () => {
    const validate = new Ajv2020({ allErrors: true }).compile(read(join(root, 'schema', 'fixture.schema.json')) as object);
    const invalid = set.filter(({ file }) => !validate(file)).map(({ name }) => ({ name, errors: validate.errors }));

    expect(invalid).toEqual([]);
  });

  it('gives every case an id unique across the set', () => {
    const ids = cases.map(({ c }) => c.id);

    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
  });

  it('prefixes every id with its file\'s group', () => {
    const astray = cases.filter(({ name, c }) => !c.id.startsWith(`${name.replace(/\.json$/, '')}/`));

    expect(astray.map(({ name, c }) => `${name}: ${c.id}`)).toEqual([]);
  });

  it('pins a heading of the document a file reads against with every section', () => {
    const named = (entries: { name: string; c: { id: string; section?: string } }[], file: (fixture: typeof set[number]) => boolean) => [
      ...set.filter(file).map(({ name, file: f }) => ({ where: name, section: f.section })),
      ...entries.flatMap(({ c }) => c.section === undefined ? [] : [{ where: c.id, section: c.section }]),
    ];

    expect(SPEC.size).toBeGreaterThan(25);
    expect(CST.size).toBeGreaterThan(10);
    expect(named(resolutions, ({ file }) => file.kind !== 'tree').filter(({ section }) => !SPEC.has(section))).toEqual([]);
    expect(named(trees, ({ file }) => file.kind === 'tree').filter(({ section }) => !CST.has(section))).toEqual([]);
  });

  it('is listed by index.json as the manifest script generates it', () => {
    const output = join(mkdtempSync(join(tmpdir(), 'curly-conformance-manifest-')), 'index.json');
    const { status } = spawnSync(process.execPath, [join(root, 'bin', 'manifest.js'), output]);
    const generated = read(output) as Manifest;

    expect(status).toBe(0);
    expect(read(join(root, 'index.json'))).toEqual(generated);
    expect(generated).toMatchObject({ format: 'curly-message-3', version: (read(join(root, 'package.json')) as { version: string }).version });
    expect(generated.files).toEqual(set.map(({ name, file }) => ({ path: `fixtures/${name}`, ...file.kind === 'tree' ? { kind: file.kind } : { level: file.level }, section: file.section, cases: file.cases.length })));
  });

  it('writes a locale-dependent case as the placeholder alone, in its own locale, a date request naming a timeZone', () => {
    const requests = resolutions.flatMap(({ c }) => 'expected' in c && c.expected.format ? [{ id: c.id, message: c.message, locale: c.locale, format: c.expected.format }] : []);
    const placeholder = /^\{\{(?:(?!\{\{|\}\}).)*\}\}$/s;

    expect(requests.length).toBeGreaterThan(0);
    expect(requests.filter(({ message }) => typeof message !== 'string' || !placeholder.test(message)).map(({ id }) => id)).toEqual([]);
    expect(requests.filter(({ locale }) => locale === undefined).map(({ id }) => id)).toEqual([]);
    expect(requests.filter(({ format }) => format.api === 'DateTimeFormat' && !Object.hasOwn(format.options ?? {}, 'timeZone')).map(({ id }) => id)).toEqual([]);
  });

  it('writes its generated cases as the runner builds them', () => {
    const generated = resolutions.filter((entry): entry is { name: string; c: Extract<Case, { generate: string }> } => 'generate' in entry.c);

    expect(generated.filter(({ c }) => !['output-at-limit', 'output-over-limit', 'output-over-limit-continues', 'read-at-limit', 'read-over-limit', 'conversion-over-limit', 'nesting-at-limit', 'nesting-over-limit'].includes(c.generate))).toEqual([]);
  });

  // What the runner holds an implementation to, held to the file itself: an
  // expectation whose leaves do not spell the message back asks for a tree
  // CST.md forbids, and would fail every implementation that answered right.
  it('spells the message back from the leaves of every tree expectation', () => {
    expect(trees.length).toBeGreaterThan(0);
    expect(trees.filter(({ c }) => spelled(c.expected) !== c.message).map(({ c }) => c.id)).toEqual([]);
  });

  it('states a name on every name node of a tree expectation, and a reading on every escape', () => {
    // The kinds the runner compares a name on, read off the runner's own list
    // so a kind that stops being one is not asked for here.
    const named: readonly string[] = NAMED;
    const nodes = trees.flatMap(({ c }) => flatten(c.expected).map((node) => ({ id: c.id, node })));

    expect(nodes.filter(({ node }) => named.includes(node.type) && node.name === undefined).map(({ id }) => id)).toEqual([]);
    expect(nodes.filter(({ node }) => node.type === 'escape' && node.cancels === undefined).map(({ id }) => id)).toEqual([]);
    expect(nodes.filter(({ node }) => !named.includes(node.type) && node.name !== undefined).map(({ id }) => id)).toEqual([]);
  });
});
