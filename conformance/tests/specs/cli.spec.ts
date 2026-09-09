import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fixtures, type FixtureFile } from '../../src';

// The command imports the built package, so these run against dist/.
const root = fileURLToPath(new URL('../../', import.meta.url));
const command = join(root, 'bin', 'conformance.js');

const ADAPTER = `
const resolve = ({ message, payload }) => ({ output: String(message).replace(/\\{\\{(\\w+)\\}\\}/g, (_, key) => payload[key]), reports: [] });
export const adapter = { levels: ['core'], limits: { passes: 10, output: 100000, conversion: 100000 }, resolve };
`;

const DEFAULT_EXPORT = `${ADAPTER}\nexport default adapter;\nexport { adapter as named };`;

const fixture = (output: string, level: FixtureFile['level'] = 'core'): FixtureFile => ({
  format: 'curly-message-1',
  level,
  section: '9',
  cases: [{ id: 'cli/case', description: 'Pins the command.', message: 'Hi {{v}}', payload: { v: 'x' }, expected: { output } }],
});

const setup = (files: Record<string, FixtureFile>, adapter = ADAPTER) => {
  const directory = mkdtempSync(join(tmpdir(), 'curly-conformance-cli-'));
  const fixtures = join(directory, 'fixtures');

  mkdirSync(fixtures);
  Object.entries(files).forEach(([name, file]) => writeFileSync(join(fixtures, name), JSON.stringify(file)));
  writeFileSync(join(directory, 'adapter.mjs'), adapter);
  writeFileSync(join(directory, 'nothing.mjs'), 'export const nothing = true;\n');

  return { directory, fixtures };
};

const conformance = (cwd: string, ...args: string[]) => {
  const { status, stdout, stderr } = spawnSync(process.execPath, [command, ...args], { cwd, encoding: 'utf8' });

  return { status, stdout, stderr };
};

describe('the command', () => {
  it('exits 0 where everything passed, printing the summary', () => {
    const { directory } = setup({ 'pass.json': fixture('Hi x') });
    const { status, stdout } = conformance(directory, './adapter.mjs', '--fixtures', './fixtures');

    expect(status).toBe(0);
    expect(stdout).toBe('1 passed, 0 failed, 0 skipped\n');
  });

  it('exits 1 where anything failed, printing the failure', () => {
    const { directory } = setup({ 'fail.json': fixture('Hi y') });
    const { status, stdout } = conformance(directory, './adapter.mjs', '--fixtures', './fixtures');

    expect(status).toBe(1);
    expect(stdout).toBe('FAIL cli/case (section 9): The output differs. Expected "Hi y", actual "Hi x". Pins the command.\n0 passed, 1 failed, 0 skipped\n');
  });

  it('takes the adapter from the default export, and the levels to run', () => {
    const { directory } = setup({ 'pass.json': fixture('Hi x'), 'intl.json': fixture('Hi x', 'intl') }, DEFAULT_EXPORT);
    const { status, stdout } = conformance(directory, './adapter.mjs', '--fixtures', './fixtures', '--levels', 'core');

    expect(status).toBe(0);
    expect(stdout).toBe('SKIP cli/case (section 9): The adapter does not claim the intl level.\n1 passed, 0 failed, 1 skipped\n');
  });

  it('reads the shipped set through the built package where --fixtures is not given', () => {
    const { directory } = setup({});
    const { status, stdout } = conformance(directory, './adapter.mjs');
    const [, passed, failed, skipped] = /^(\d+) passed, (\d+) failed, (\d+) skipped/.exec(stdout.trimEnd().split('\n').at(-1) ?? '') ?? [];
    const shipped = fixtures().flatMap(({ file }) => file.cases);

    expect([0, 1]).toContain(status);
    expect(Number(passed) + Number(failed) + Number(skipped)).toBe(shipped.length);
    expect(Number(skipped)).toBe(fixtures().flatMap(({ file }) => file.cases.filter((c) => file.level !== 'core' || ('generate' in c && c.generate === 'output-over-limit-stops'))).length);
  });

  it('exits 2 on a usage error, with the reason', () => {
    const { directory } = setup({ 'pass.json': fixture('Hi x') });

    expect(conformance(directory)).toMatchObject({ status: 2, stdout: '', stderr: expect.stringContaining('Usage: curly-message-conformance <adapter module>') as string });
    expect(conformance(directory, './adapter.mjs', './fixtures')).toMatchObject({ status: 2, stdout: '', stderr: expect.stringContaining('Usage: curly-message-conformance <adapter module>') as string });
    expect(conformance(directory, './adapter.mjs', '--levels', '', '--fixtures', './fixtures')).toMatchObject({ status: 2, stderr: 'The levels option names the level ""; the levels are core, intl and extensions.\n' });
    expect(conformance(directory, './adapter.mjs', '--levels', 'core,', '--fixtures', './fixtures')).toMatchObject({ status: 2, stderr: 'The levels option names the level ""; the levels are core, intl and extensions.\n' });
    expect(conformance(directory, './adapter.mjs', '--levels', 'intl', '--fixtures', './fixtures')).toMatchObject({ status: 2, stderr: 'The adapter does not claim the intl level.\n' });
    expect(conformance(directory, './nothing.mjs')).toMatchObject({ status: 2, stderr: './nothing.mjs exports no adapter: export it as "adapter" or as the default export.\n' });
  });
});
