import { describe, expect, it } from 'vitest';
import { loadHarness } from '../../src/harness/index.js';
import { runTrancheAProbes } from '../../src/probes/index.js';
import { runBucketScanDeferred } from '../../src/probes/storage-probe.js';
import { buildRoutingCoverage } from '../../src/routing.js';
import { emitReport } from '../../src/report-emit.js';
import { parseSstFile } from '../../src/sst-reader.js';
import { createMockFetch, loadFixtureSst } from '../helpers/mock-fetch.js';

describe('Tranche A — IGV integration (mock emulator)', () => {
  it('runs probes 1, 2, 6, 7a GREEN and 7b DEFERRED', async () => {
    const sst = parseSstFile(loadFixtureSst());
    const harness = loadHarness({ sst, mockMode: true, fetchFn: createMockFetch() });
    await harness.boot();
    const ctx = harness.getContext();
    const results = await runTrancheAProbes(ctx, sst.criticalContracts);

    const byId = Object.fromEntries(results.map((r) => [r.probeId, r]));
    expect(byId['auth-gate-rejects']?.verdict).toBe('GREEN');
    expect(byId['db-rules-deny']?.verdict).toBe('GREEN');
    expect(byId['rate-limit-triggers']?.verdict).toBe('GREEN');
    expect(byId['storage-rules-deny']?.verdict).toBe('GREEN');
    expect(byId['real-bucket-audio-absence']?.verdict).toBe('DEFERRED');
  });

  it('launch report header shows Probe 7b deferral visibly', () => {
    const sst = parseSstFile(loadFixtureSst());
    const deferred = runBucketScanDeferred();
    const report = emitReport({
      sst,
      probeResults: [deferred],
      routingCoverage: buildRoutingCoverage(sst.criticalContracts),
      auditorVersion: '0.1.0-test',
      deterministic: true,
    });
    expect(report).toContain('Launch gate status');
    expect(report).toContain('DEFERRED');
    expect(report).toContain('runbook §Check 7');
    expect(report).toContain('Probe 7b');
    expect(report).toContain('storage-rules-deny via emulator');
  });

  it('routing coverage has zero AMBER unrouted for IGV fixture', () => {
    const sst = parseSstFile(loadFixtureSst());
    const coverage = buildRoutingCoverage(sst.criticalContracts);
    expect(coverage.every((c) => c.routed)).toBe(true);
  });
});
