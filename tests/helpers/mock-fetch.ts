export { createMockFetch } from '../../src/harness/mock-fetch.js';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE = join(import.meta.dirname, '../fixtures/igv');

export function loadFixtureSst() {
  return join(FIXTURE, 'SST.md');
}

export function loadFixtureHints() {
  return readFileSync(join(FIXTURE, 'sst-probe-hints.yaml'), 'utf8');
}
