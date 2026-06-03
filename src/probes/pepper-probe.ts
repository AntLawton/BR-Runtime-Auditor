import { inferDistinctSecretPairs } from '../pepper-pairs.js';
import { worstVerdict } from '../probe-utils.js';
import type { HarnessContext } from '../types/harness.js';
import type { ProbeResult, SubProbeResult } from '../types/probe-result.js';

export async function runPepperProbe(ctx: HarnessContext): Promise<ProbeResult> {
  const pairs = inferDistinctSecretPairs(ctx.sst);
  const sm = ctx.secretManager;

  if (!pairs.length) {
    return {
      probeId: 'pepper-distinctness',
      probeName: 'Pepper distinctness via Secret Manager',
      verdict: 'GREEN',
      subProbes: [],
      evidence: [
        {
          summary: 'No distinct-secret invariant declared',
          citation: 'docs/00-PHASE-A-BRIEF.md §2 row 8',
        },
      ],
      note: 'no distinct-secret invariant declared',
    };
  }

  if (!sm) {
    return {
      probeId: 'pepper-distinctness',
      probeName: 'Pepper distinctness via Secret Manager',
      verdict: 'AMBER',
      subProbes: [],
      evidence: [{ summary: 'Secret Manager harness plug-in not loaded' }],
    };
  }

  const subProbes: SubProbeResult[] = [];

  for (const pair of pairs) {
    const va = await sm.readSecret(pair.a);
    const vb = await sm.readSecret(pair.b);
    const citation = 'src/harness/secret-manager.ts:1';

    if (va === undefined || vb === undefined) {
      subProbes.push({
        id: `${pair.a} vs ${pair.b}`,
        verdict: 'AMBER',
        detail: 'One or both secrets unreadable (set env vars or mock secrets)',
        citation,
      });
      continue;
    }

    subProbes.push({
      id: `${pair.a} vs ${pair.b}`,
      verdict: va !== vb ? 'GREEN' : 'RED',
      detail: va !== vb ? 'Values differ' : 'Values identical — cross-layer correlation risk',
      citation,
    });
  }

  return {
    probeId: 'pepper-distinctness',
    probeName: 'Pepper distinctness via Secret Manager',
    verdict: worstVerdict(subProbes),
    subProbes,
    evidence: [
      {
        summary: `Checked ${pairs.length} distinct-secret pair(s)`,
        citation: 'src/probes/pepper-probe.ts:1',
      },
    ],
  };
}
