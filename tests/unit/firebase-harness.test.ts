import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadHarness } from '../../src/harness/index.js';
import { functionsUrl } from '../../src/harness/firebase.js';
import { parseSstFile } from '../../src/sst-reader.js';
import { loadFixtureSst } from '../helpers/mock-fetch.js';

describe('firebase harness — emulator wiring', () => {
  let tempRepo: string | undefined;

  afterEach(() => {
    tempRepo = undefined;
  });

  it('resolves projectId from .firebaserc when sidecar uses placeholder', async () => {
    tempRepo = mkdtempSync(join(tmpdir(), 'br-audit-'));
    writeFileSync(
      join(tempRepo, '.firebaserc'),
      JSON.stringify({ projects: { default: 'roh-production-b5b1b' } }),
      'utf8',
    );
    const sst = parseSstFile(loadFixtureSst(), tempRepo);
    const harness = loadHarness({ sst, repoRoot: tempRepo, mockMode: true });
    await harness.boot();
    const url = functionsUrl(harness.getContext(), '/igv/engagements');
    expect(url).toBe(
      'http://127.0.0.1:5001/roh-production-b5b1b/europe-west2/igvApi/igv/engagements',
    );
  });
});
