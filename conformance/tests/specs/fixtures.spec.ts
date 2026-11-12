import Ajv2020 from 'ajv/dist/2020.js';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fixtures, mutations, plan, type Adapter, type Case, type ExpectedNode, type Fixture, type Manifest } from '@curly-message/conformance';
import { NAMED } from '../../src/tree';
import { resolver, type Mutant } from './kept';

const root = fileURLToPath(new URL('../../', import.meta.url));

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as unknown;

const set = fixtures();

// The keys an object repeats in a JSON text, which a parsed file no longer
// shows: `JSON.parse` keeps the last of two members, and another host's parser
// may keep the first. The text is JSON, so a string is a key exactly where an
// object opens or a comma inside one precedes it.
const repeated = (text: string) => {
  const objects: (Set<string> | undefined)[] = [];
  const found: string[] = [];
  let key = false;

  for (let at = 0; at < text.length; at++) {
    const char = text[at];

    if (char === '"') {
      let end = at + 1;

      while (text[end] !== '"') end += text[end] === '\\' ? 2 : 1;

      const keys = objects.at(-1);
      const name = JSON.parse(text.slice(at, end + 1)) as string;

      if (key && keys) {
        if (keys.has(name)) found.push(name);
        keys.add(name);
      }

      key = false;
      at = end;
    } else if (char === '{' || char === '[') {
      objects.push(char === '{' ? new Set() : undefined);
      key = char === '{';
    } else if (char === '}' || char === ']') {
      objects.pop();
    } else if (char === ',') {
      key = objects.at(-1) !== undefined;
    }
  }

  return found;
};

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

  it('repeats no key in an object of a JSON file a release ships', () => {
    expect(repeated('{"a":{"b":1,"c":[{"b":2},{"b":3}],"\\u0062":4},"d":"\\"b\\""}')).toEqual(['b']);

    const shipped = [...set.map(({ name }) => join('fixtures', name)), 'index.json', 'defects.json', join('schema', 'fixture.schema.json'), join('schema', 'defect.schema.json')];
    const texts = shipped.map((path) => ({ path, text: readFileSync(join(root, path), 'utf8') }));

    expect(texts.flatMap(({ path, text }) => repeated(text).map((key) => `${path}: ${key}`))).toEqual([]);
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

    expect(generated.filter(({ c }) => !['output-at-limit', 'output-over-limit', 'output-over-limit-continues', 'read-at-limit', 'read-over-limit', 'conversion-at-limit', 'conversion-over-limit', 'conversion-over-limit-continues', 'nesting-at-limit', 'nesting-over-limit', 'nesting-over-limit-converts', 'nesting-over-limit-reads', 'nesting-over-limit-read-spent', 'nesting-over-limit-unknown-modifier', 'nesting-over-limit-missing-options', 'nesting-chain-over-limit', 'reentry-at-limit', 'reentry-over-limit', 'reentry-refused-not-recorded', 'reentry-own-reads-free', 'reentry-over-limit-by-a-conversion'].includes(c.generate))).toEqual([]);
  });

  // The written cases that register a behaviour over a list of what was kept,
  // each through an implementation that reads section 13 as tests/specs/kept.ts
  // does, which calls `late` where a modifier's input is read after its call
  // returned, whether a modifier, a conversion or a nested resolution reads it.
  const keepers = set.flatMap(({ name, file }) => file.kind === 'tree' ? [] : file.cases.filter((c) => 'keeping' in c && c.keeping).map((c) => ({ name, file: { ...file, cases: [c] } })));
  const through = (fixture: Fixture, over: Partial<Adapter> = {}, mutant?: Mutant) => {
    let late = false;
    const adapter: Adapter = { levels: ['core', 'intl', 'extensions'], limits: { output: 100000, read: 100000, conversion: 100000, nesting: 8 }, reentry: 32, resolve: resolver({ bound: 32, mutant, late: () => {
      late = true;
    } }), ...over };
    const planned = plan(adapter, { fixtures: [fixture] });
    const outcomes = planned.cases.map((c) => c.execute());

    return { outcomes, skipped: planned.skipped.length > 0, late };
  };

  // A runner leaves a case out where no modifier can keep an input by the
  // behaviours it registers, so the set writes no case that reads a kept input
  // after the modifier that kept it returned but through `keep` or `first`,
  // and every case that registers either reads one so.
  it('reads a kept input after the modifier that kept it returned in exactly the cases left out where no modifier can keep one', () => {
    expect(keepers.length).toBeGreaterThan(0);

    for (const fixture of keepers) {
      const { outcomes, late } = through(fixture);

      expect(outcomes).toEqual([{ ok: true }]);
      expect({ id: fixture.file.cases[0].id, skipped: through(fixture, { keeps: false }).skipped }).toEqual({ id: fixture.file.cases[0].id, skipped: late });
    }
  });

  it('pins that a read of a default in production is refused at once, and fails nothing, whoever makes it', () => {
    const failing = (mutant: Mutant) => keepers.filter((fixture) => through(fixture, {}, mutant).outcomes.some(({ ok }) => !ok)).map(({ file }) => file.cases[0].id);
    const every = ['limits-extensions/kept-default-read-while-produced', 'limits-extensions/kept-default-read-by-a-conversion', 'limits-extensions/kept-default-read-in-a-nested-resolution'];

    expect(failing('in-progress-read')).toEqual(every);
    expect(failing('in-progress-raises')).toEqual(every);
    expect(failing('refusal-aborts')).toEqual(every);
    // A refused read failed where a conversion makes it, and a production in
    // progress seen only by the resolution that started it.
    expect(failing('conversion-refusal-fails')).toEqual(['limits-extensions/kept-default-read-by-a-conversion']);
    expect(failing('in-progress-per-resolution')).toEqual(['limits-extensions/kept-default-read-in-a-nested-resolution']);
  });

  // A defect of what an adapter cannot express is caught only where the set
  // states a request it covers, and a correct runner that leaves none out
  // would read as one with a hole in it.
  it('states a request each defect of what an adapter cannot express covers', () => {
    const adapter: Adapter = { levels: ['core', 'intl'], limits: { output: 5, read: 7, conversion: 7, nesting: 3 }, resolve: () => ({ output: '' }) };
    const baseline = plan(adapter).skipped.length;
    const uncovered = (['unexpressible-declared', 'unexpressible-conditional-declared'] as const).filter((id) => {
      const { adapter: defective, reached } = mutations[id](adapter);

      return plan(defective).skipped.length <= baseline || !reached();
    });

    expect(uncovered).toEqual([]);
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
