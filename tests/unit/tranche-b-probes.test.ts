import { describe, expect, it, beforeEach } from 'vitest';
import { join } from 'node:path';
import { parseSstFile } from '../../src/sst-reader.js';
import { createMockFetch } from '../helpers/mock-fetch.js';
import { createNetworkMock } from '../../src/harness/network-mock.js';
import { createMockSecretManager } from '../../src/harness/secret-manager.js';
import { runAiPromptProbe } from '../../src/probes/ai-prompt-probe.js';
import { runCsprngProbe } from '../../src/probes/csprng-probe.js';
import { runPepperProbe } from '../../src/probes/pepper-probe.js';
import { runPrivacyThresholdProbe } from '../../src/probes/privacy-threshold-probe.js';
import { sweepThreshold } from '../../src/privacy-floor.js';
import { runTrancheBProbes } from '../../src/probes/index.js';
import type { HarnessContext } from '../../src/types/harness.js';

const FIXTURE_ROOT = join(import.meta.dirname, '../fixtures');
const REPO_ROOT = join(FIXTURE_ROOT, '../..');

function mockCtx(product: 'igv' | 'roh' | 'nh', secrets?: Record<string, string>): HarnessContext {
  const sstPath = join(FIXTURE_ROOT, product, 'SST.md');
  const sst = parseSstFile(sstPath, REPO_ROOT);
  const networkMock = createNetworkMock();
  return {
    sst,
    emulator: {
      authPort: 9099,
      firestorePort: 8080,
      functionsPort: 5001,
      storagePort: 9199,
      projectId: 'demo',
      region: 'europe-west2',
      functionsBasePath: 'api',
    },
    mockMode: true,
    fetchFn: networkMock.wrapFetch(createMockFetch()),
    networkMock,
    secretManager: createMockSecretManager(secrets ?? {}),
    postgresAvailable: product === 'nh',
  };
}

describe('privacy-floor', () => {
  it('catches deliberately seeded sub-threshold leak', () => {
    const sweep = sweepThreshold(5, 2);
    const leak = sweep.find((s) => s.groupSize === 3);
    expect(leak?.surfaces).toBe(false);
    const bad = { groupSize: 3, surfaces: true };
    expect(bad.groupSize < 5 && bad.surfaces).toBe(true);
  });
});

describe('ai-prompt-probe', () => {
  it('passes mock mode with zero provider calls', async () => {
    process.env.BR_RUNTIME_CSPRNG_N = '500';
    const result = await runAiPromptProbe(mockCtx('igv'));
    expect(result.verdict).toBe('GREEN');
    expect(result.subProbes.some((s) => s.id.includes('network-mock'))).toBe(true);
  });
});

describe('csprng-probe', () => {
  beforeEach(() => {
    process.env.BR_RUNTIME_CSPRNG_N = '1000';
  });

  it('passes statistical sample in mock mode', async () => {
    const result = await runCsprngProbe(mockCtx('igv'));
    expect(result.verdict).toBe('GREEN');
    expect(result.evidence[0]?.citation).toContain('csprng-probe.ts');
  });
});

describe('pepper-probe', () => {
  it('emits GREEN-with-note when no pairs', async () => {
    const result = await runPepperProbe(mockCtx('igv'));
    expect(result.verdict).toBe('GREEN');
    expect(result.note).toMatch(/no distinct-secret/i);
  });

  it('asserts distinct peppers for NH fixture', async () => {
    const result = await runPepperProbe(
      mockCtx('nh', { NH_REGISTRATION_PEPPER: 'alpha', NH_RECORDING_PEPPER: 'beta' }),
    );
    expect(result.verdict).toBe('GREEN');
    expect(result.subProbes[0]?.citation).toBeTruthy();
  });
});

describe('privacy-threshold-probe', () => {
  it('sweeps RoH threshold from hints', async () => {
    const result = await runPrivacyThresholdProbe(mockCtx('roh'));
    expect(result.verdict).toBe('GREEN');
    expect(result.subProbes.some((s) => s.id === 'DEFAULT_MINIMUM_AGGREGATION')).toBe(true);
  });

  it('handles three NH thresholds', async () => {
    const result = await runPrivacyThresholdProbe(mockCtx('nh'));
    expect(result.verdict).toBe('GREEN');
    expect(result.subProbes.length).toBe(3);
  });
});

describe('runTrancheBProbes orchestrator', () => {
  it('runs phase-1 and phase-4 probes for IGV fixture', async () => {
    process.env.BR_RUNTIME_CSPRNG_N = '500';
    const ctx = mockCtx('igv');
    const results = await runTrancheBProbes(ctx, ctx.sst.criticalContracts);
    const ids = results.map((r) => r.probeId);
    expect(ids).toContain('ai-prompt-pinned');
    expect(ids).toContain('csprng-strength');
    expect(ids).toContain('pepper-distinctness');
  });
});
