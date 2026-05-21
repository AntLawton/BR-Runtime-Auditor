import type { ProbeResult } from '../types/probe-result.js';
import type { ContractRoute } from '../types/probe-result.js';

export function runStructuralDeferred(route: ContractRoute): ProbeResult {
  return {
    probeId: 'structural-deferred',
    probeName: `Structural contract: ${route.contract}`,
    verdict: route.verdict ?? 'GREEN',
    subProbes: [],
    evidence: [
      {
        summary: route.note ?? 'Structural-only — verified by BR audit; no runtime probe',
        citation: 'routing-table.yaml',
      },
    ],
  };
}

export function runTrancheBDeferred(probeId: string, note?: string): ProbeResult {
  const names: Record<string, string> = {
    'ai-prompt-pinned': 'AI prompt pinned at temperature 0.0',
    'egress-allow-list': 'Egress allow-list integrity',
    'pepper-distinctness': 'Pepper distinctness via Secret Manager',
    'privacy-threshold-floors': 'Privacy threshold floor property tests',
    'account-deletion-polymorphism': 'Account deletion Layer 1/2 polymorphism',
    'csprng-strength': 'CSPRNG statistical strength',
  };
  return {
    probeId,
    probeName: names[probeId] ?? probeId,
    verdict: 'DEFERRED',
    subProbes: [],
    evidence: [
      {
        summary: note ?? 'Tranche B — not in current launch scope',
        citation: 'docs/COMPOSER2-RED-TEAM.md Tranche A scope',
      },
    ],
  };
}

export function runEgressDeferred(): ProbeResult {
  return runTrancheBDeferred(
    'egress-allow-list',
    'DEFERRED — manual runbook §Check 3 (VPC/egress audit). Never silently pass.',
  );
}
