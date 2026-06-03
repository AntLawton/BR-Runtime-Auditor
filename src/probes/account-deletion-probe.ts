import type { HarnessContext } from '../types/harness.js';
import type { ProbeResult } from '../types/probe-result.js';

export async function runAccountDeletionProbe(ctx: HarnessContext): Promise<ProbeResult> {
  const hasContract = ctx.sst.criticalContracts.some((c) =>
    /account-deletion|Layer1-only/i.test(c),
  );

  if (!hasContract) {
    return {
      probeId: 'account-deletion-polymorphism',
      probeName: 'Account deletion Layer 1/2 polymorphism',
      verdict: 'GREEN',
      subProbes: [],
      evidence: [
        {
          summary: 'No account-deletion critical contract on this SST',
          citation: 'src/probes/account-deletion-probe.ts:1',
        },
      ],
    };
  }

  if (!ctx.postgresAvailable) {
    return {
      probeId: 'account-deletion-polymorphism',
      probeName: 'Account deletion Layer 1/2 polymorphism',
      verdict: 'DEFERRED',
      subProbes: [],
      evidence: [
        {
          summary:
            'Postgres harness unavailable — E2E requires NH_DATABASE_URL + Docker per NH-DEV-TEST-WALKTHROUGH',
          citation: 'src/harness/postgres.ts:1',
        },
      ],
      note: 'DEFERRED — Postgres E2E not run',
    };
  }

  return {
    probeId: 'account-deletion-polymorphism',
    probeName: 'Account deletion Layer 1/2 polymorphism',
    verdict: 'DEFERRED',
    subProbes: [],
    evidence: [
      {
        summary:
          'Postgres reachable — full register→submit→delete E2E orchestration deferred to product integration harness',
        citation: 'src/probes/account-deletion-probe.ts:1',
      },
    ],
    note: 'DEFERRED — E2E script boundary (B2 skeleton)',
  };
}
