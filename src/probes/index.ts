import { runAuthProbe } from './auth-probe.js';
import { runDbRulesProbe } from './db-rules-probe.js';
import { runRateLimitProbe } from './rate-limit-probe.js';
import { runStorageRulesProbe, runBucketScanDeferred } from './storage-probe.js';
import { runEgressDeferred, runStructuralDeferred, runTrancheBDeferred } from './deferred-probe.js';
import type { HarnessContext } from '../types/harness.js';
import type { ProbeResult } from '../types/probe-result.js';
import { routeContract } from '../routing.js';

const TRANCHE_A_RUNTIME = new Set([
  'auth-gate-rejects',
  'db-rules-deny',
  'rate-limit-triggers',
  'storage-rules-deny',
]);

const TRANCHE_B_ONLY = new Set([
  'ai-prompt-pinned',
  'pepper-distinctness',
  'privacy-threshold-floors',
  'account-deletion-polymorphism',
  'csprng-strength',
]);

export async function runProbe(probeId: string, ctx: HarnessContext): Promise<ProbeResult> {
  switch (probeId) {
    case 'auth-gate-rejects':
      return runAuthProbe(ctx);
    case 'db-rules-deny':
      return runDbRulesProbe(ctx);
    case 'rate-limit-triggers':
      return runRateLimitProbe(ctx);
    case 'storage-rules-deny':
      return runStorageRulesProbe(ctx);
    case 'real-bucket-audio-absence':
      return runBucketScanDeferred();
    case 'egress-allow-list':
      return runEgressDeferred();
    case 'structural-deferred':
      return runStructuralDeferred({
        contract: '*',
        probe: 'structural-deferred',
        verdict: 'GREEN',
      });
    default:
      if (TRANCHE_B_ONLY.has(probeId)) {
        return runTrancheBDeferred(probeId);
      }
      return {
        probeId,
        probeName: probeId,
        verdict: 'AMBER',
        subProbes: [],
        evidence: [{ summary: `No probe handler for ${probeId}` }],
      };
  }
}

export async function runTrancheAProbes(
  ctx: HarnessContext,
  contracts: string[],
  filter?: string,
): Promise<ProbeResult[]> {
  const probeIds = new Set<string>();
  for (const c of contracts) {
    const route = routeContract(c);
    if (TRANCHE_A_RUNTIME.has(route.probe)) probeIds.add(route.probe);
  }
  const hints = ctx.sst.runtimeProbeHints;
  if (hints.auth?.protected_routes?.length) probeIds.add('auth-gate-rejects');
  if (hints.auth?.public_rate_limited_routes?.length) probeIds.add('rate-limit-triggers');
  if (hints.db_rules?.firestore_deny_paths?.length) probeIds.add('db-rules-deny');
  if (hints.db_rules?.storage_deny_paths?.length) probeIds.add('storage-rules-deny');
  probeIds.add('real-bucket-audio-absence');

  const ordered = [
    'auth-gate-rejects',
    'db-rules-deny',
    'rate-limit-triggers',
    'storage-rules-deny',
    'real-bucket-audio-absence',
  ];
  const toRun = ordered.filter((id) => probeIds.has(id) && (!filter || filter === id));
  return Promise.all(toRun.map((id) => runProbe(id, ctx)));
}

export { TRANCHE_A_RUNTIME, TRANCHE_B_ONLY };
