import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { loadProbeHintsYaml, mergeProbeHints, parseSstFile } from '../../src/sst-reader.js';
import { loadFixtureHints, loadFixtureSst } from '../helpers/mock-fetch.js';

describe('sst-reader', () => {
  it('parses IGV fixture SST and merges probe hints sidecar', () => {
    const sst = parseSstFile(loadFixtureSst());
    expect(sst.project).toBe('insight-genie-voice');
    expect(sst.criticalContracts).toHaveLength(12);
    expect(sst.runtimeProbeHints.auth?.protected_routes?.[0]?.path).toBe('/igv/engagements');
    expect(sst.runtimeProbeHints.auth?.public_rate_limited_routes?.[0]?.test_override).toBe(5);
    expect(sst.runtimeProbeHints.db_rules?.firestore_deny_paths?.[0]).toContain('igv-engagements');
    expect(sst.launchGate).toEqual({ name: 'NHS', date: '2026-05-25' });
  });

  it('mergeProbeHints overlays sidecar over SST meta', () => {
    const hints = loadProbeHintsYaml(loadFixtureHints());
    const merged = mergeProbeHints({}, hints);
    expect(merged.emulator?.functions_base_path).toBe('igvApi');
  });
});

describe('routing coverage — 39 contracts across three SST fixtures', () => {
  const fixtures = ['igv', 'roh', 'nh'] as const;

  it('every critical_contracts entry matches exactly one explicit routing row', async () => {
    const { buildRoutingCoverage } = await import('../../src/routing.js');
    let total = 0;
    for (const product of fixtures) {
      const repoRoot = join(import.meta.dirname, '../..');
      const sst = parseSstFile(
        join(import.meta.dirname, `../fixtures/${product}/SST.md`),
        repoRoot,
      );
      const coverage = buildRoutingCoverage(sst.criticalContracts);
      total += coverage.length;
      for (const row of coverage) {
        expect(row.routed, `${product}: ${row.contract}`).toBe(true);
        expect(row.probe).toBeTruthy();
      }
    }
    expect(total).toBe(39);
  });
});
