import Ajv2020 from 'ajv/dist/2020.js';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fixtures, type Case, type Manifest } from '../../src';

const root = fileURLToPath(new URL('../../', import.meta.url));

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as unknown;

const set = fixtures();

const cases = set.flatMap(({ name, file }) => file.cases.map((c) => ({ name, c })));

// A heading of SPEC.md is numbered like "## 9. Resolution", "### 9.2 Look up
// the value" or "### A.4 Valueless options"; the number is what a section
// reference names.
const headings = new Set([...readFileSync(join(root, '..', 'SPEC.md'), 'utf8').matchAll(/^#{2,3} (\d+\.\d+|\d+|A\.\d+)\b/gm)].map(([, number]) => number));

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

  it('pins a heading of SPEC.md with every section', () => {
    const sections = [...set.map(({ name, file }) => ({ where: name, section: file.section })), ...cases.flatMap(({ c }) => c.section === undefined ? [] : [{ where: c.id, section: c.section }])];

    expect(headings.size).toBeGreaterThan(40);
    expect(sections.filter(({ section }) => !headings.has(section))).toEqual([]);
  });

  it('is listed by index.json as the manifest script generates it', () => {
    const output = join(mkdtempSync(join(tmpdir(), 'curly-conformance-manifest-')), 'index.json');
    const { status } = spawnSync(process.execPath, [join(root, 'bin', 'manifest.js'), output]);
    const generated = read(output) as Manifest;

    expect(status).toBe(0);
    expect(read(join(root, 'index.json'))).toEqual(generated);
    expect(generated).toMatchObject({ format: 'curly-message-1', version: (read(join(root, 'package.json')) as { version: string }).version });
    expect(generated.files).toEqual(set.map(({ name, file }) => ({ path: `fixtures/${name}`, level: file.level, section: file.section, cases: file.cases.length })));
  });

  it('writes a locale-dependent case as the placeholder alone, in its own locale, a date request naming a timeZone', () => {
    const requests = cases.flatMap(({ c }) => 'expected' in c && c.expected.format ? [{ id: c.id, message: c.message, locale: c.locale, format: c.expected.format }] : []);
    const placeholder = /^\{\{(?:(?!\{\{|\}\}).)*\}\}$/s;

    expect(requests.length).toBeGreaterThan(0);
    expect(requests.filter(({ message }) => typeof message !== 'string' || !placeholder.test(message)).map(({ id }) => id)).toEqual([]);
    expect(requests.filter(({ locale }) => locale === undefined).map(({ id }) => id)).toEqual([]);
    expect(requests.filter(({ format }) => format.api === 'DateTimeFormat' && !Object.hasOwn(format.options ?? {}, 'timeZone')).map(({ id }) => id)).toEqual([]);
  });

  it('stays clear of what the contract leaves open: a tagged value in an expected report key, and an empty locale beside the locale behaviour', () => {
    const tagged = (value: unknown): boolean => Array.isArray(value) ? value.some(tagged) : value !== null && typeof value === 'object' && (Object.hasOwn(value, '$curly') || Object.values(value).some(tagged));
    const concrete = cases.flatMap(({ c }) => 'expected' in c ? [c] : []);

    expect(concrete.filter((c) => c.expected.reports?.some((report) => tagged(report.key))).map(({ id }) => id)).toEqual([]);
    expect(concrete.filter((c) => c.locale === '' && Object.values(c.modifiers ?? {}).includes('locale')).map(({ id }) => id)).toEqual([]);
  });

  it('writes its generated cases as the runner builds them', () => {
    const generated = cases.filter((entry): entry is { name: string; c: Extract<Case, { generate: string }> } => 'generate' in entry.c);

    expect(generated.filter(({ c }) => !['passes-at-limit', 'passes-over-limit', 'output-at-limit', 'output-over-limit', 'output-over-limit-stops', 'conversion-over-limit'].includes(c.generate))).toEqual([]);
  });
});
