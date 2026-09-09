#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { load, run, summarize } from '../dist/index.js';

const USAGE = 'Usage: curly-message-conformance <adapter module> [--levels core,intl,extensions] [--fixtures <directory>]';

const main = async () => {
  const { positionals: [path, ...rest], values } = parseArgs({
    allowPositionals: true,
    options: { levels: { type: 'string' }, fixtures: { type: 'string' } },
  });

  if (!path || rest.length) throw new Error(USAGE);

  const module = await import(pathToFileURL(resolve(path)).href);
  const adapter = module.adapter ?? module.default;

  if (!adapter) throw new Error(`${path} exports no adapter: export it as "adapter" or as the default export.`);

  const result = run(adapter, {
    ...(values.levels === undefined ? {} : { levels: values.levels.split(',') }),
    ...(values.fixtures === undefined ? {} : { fixtures: load(resolve(values.fixtures)) }),
  });

  console.log(summarize(result));

  return result.failed.length ? 1 : 0;
};

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
}
