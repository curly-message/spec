import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Fixture, FixtureFile } from './types';

/** The fixture files of a directory, sorted by name. */
export const load = (directory: string): Fixture[] => readdirSync(directory)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => ({ name, file: JSON.parse(readFileSync(join(directory, name), 'utf8')) as FixtureFile }));

/** The set shipped with this package. */
export const fixtures = () => load(fileURLToPath(new URL('../fixtures/', import.meta.url)));
