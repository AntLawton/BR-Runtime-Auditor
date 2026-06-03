import { runAuthProbe } from './auth-probe.js';
import { runDbRulesProbe } from './db-rules-probe.js';
import { runRateLimitProbe } from './rate-limit-probe.js';
import { runStorageRulesProbe, runBucketScanDeferred } from './storage-probe.js';
import { runEgressDeferred, runStructuralDeferred, runTrancheBDeferred } from './deferred-probe.js';
import { runAiPromptProbe } from './ai-prompt-probe.js';
import { runCsprngProbe } from './csprng-probe.js';
import { runPepperProbe } from './pepper-probe.js';
import { runPrivacyThresholdProbe } from './privacy-threshold-probe.js';
import { runAccountDeletionProbe } from './account-deletion-probe.js';
import type { HarnessContext } from '../types/harness.js';
import type { ProbeResult } from '../types/probe-result.js';
import { routeContract } from '../routing.js';

const TRANCHE_A_RUNTIME = new Set([
  'auth-gate-rejects',
  'db-rules-deny',
  'rate-limit-triggers',
  'storage-rules-deny',
]);

const TRANCHE_B_STATIC = ['ai-prompt-pinned', 'csprng-strength', 'pepper-distinctness'] as const;
const TRANCHE_B_PROPERTY = ['privacy-threshold-floors'] as const;
const TRANCHE_B_POSTGRES = ['account-deletion-polymorphism'] as const;

const TRANCHE_B_ONLY = new Set([...TRANCHE_B_STATIC, ...TRANCHE_B_PROPERTY, ...TRANCHE_B_POSTGRES]);

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
      return runBucketScanDeferred(ctx);
    case 'egress-allow-list':
      return runEgressDeferred();
    case 'ai-prompt-pinned':
      return runAiPromptProbe(ctx);
    case 'csprng-strength':
      return runCsprngProbe(ctx);
    case 'pepper-distinctness':
      return runPepperProbe(ctx);
    case 'privacy-threshold-floors':
      return runPrivacyThresholdProbe(ctx);
    case 'account-deletion-polymorphism':
      return runAccountDeletionProbe(ctx);
    case 'structural-deferred':
      return runStructuralDeferred({
        contract: '*',
        probe: 'structural-deferred',
        verdict: 'GREEN',
      });
    default:
      if ((TRANCHE_B_ONLY as Set<string>).has(probeId)) {
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

function collectProbeIds(contracts: string[], allow: Set<string>): Set<string> {
  const probeIds = new Set<string>();
  for (const c of contracts) {
    const route = routeContract(c);
    if (allow.has(route.probe) && route.verdict !== 'DEFERRED') probeIds.add(route.probe);
  }
  return probeIds;
}

export async function runTrancheAProbes(
  ctx: HarnessContext,
  contracts: string[],
  filter?: string,
): Promise<ProbeResult[]> {
  const probeIds = collectProbeIds(contracts, TRANCHE_A_RUNTIME);
  const hints = ctx.sst.runtimeProbeHints;
  if (hints.auth?.protected_routes?.length) probeIds.add('auth-gate-rejects');
  if (hints.auth?.public_rate_limited_routes?.length) probeIds.add('rate-limit-triggers');
  if (hints.db_rules?.firestore_deny_paths?.length) probeIds.add('db-rules-deny');
  if (hints.db_rules?.storage_deny_paths?.length) probeIds.add('storage-rules-deny');
  if (contracts.some((c) => routeContract(c).probe === 'egress-allow-list')) {
    probeIds.add('egress-allow-list');
  }
  probeIds.add('real-bucket-audio-absence');

  const ordered = [
    'auth-gate-rejects',
    'db-rules-deny',
    'rate-limit-triggers',
    'storage-rules-deny',
    'egress-allow-list',
    'real-bucket-audio-absence',
  ];
  const toRun = ordered.filter((id) => probeIds.has(id) && (!filter || filter === id));
  return Promise.all(toRun.map((id) => runProbe(id, ctx)));
}

export async function runTrancheBProbes(
  ctx: HarnessContext,
  contracts: string[],
  filter?: string,
): Promise<ProbeResult[]> {
  const staticIds = collectProbeIds(contracts, new Set(TRANCHE_B_STATIC));
  const propertyIds = collectProbeIds(contracts, new Set(TRANCHE_B_PROPERTY));
  const postgresIds = collectProbeIds(contracts, new Set(TRANCHE_B_POSTGRES));

  for (const id of TRANCHE_B_STATIC) staticIds.add(id);
  if (contracts.some((c) => routeContract(c).probe === 'privacy-threshold-floors')) {
    propertyIds.add('privacy-threshold-floors');
  }
  if (contracts.some((c) => routeContract(c).probe === 'account-deletion-polymorphism')) {
    postgresIds.add('account-deletion-polymorphism');
  }
  if (ctx.sst.envVarContract.some((e) => e.name.includes('_PEPPER'))) {
    staticIds.add('pepper-distinctness');
  }

  const phase1 = [...TRANCHE_B_STATIC].filter((id) => staticIds.has(id));
  const phase4 = [...TRANCHE_B_PROPERTY].filter((id) => propertyIds.has(id));
  const phase3 = [...TRANCHE_B_POSTGRES].filter((id) => postgresIds.has(id));
  const ordered = [...phase1, ...phase3, ...phase4];
  const toRun = ordered.filter((id) => !filter || filter === id);
  return Promise.all(toRun.map((id) => runProbe(id, ctx)));
}

export { TRANCHE_A_RUNTIME, TRANCHE_B_ONLY };
