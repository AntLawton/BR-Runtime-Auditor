import type { HarnessContext } from '../types/harness.js';
import { functionsUrl } from '../harness/firebase.js';
import type { ProbeResult, SubProbeResult } from '../types/probe-result.js';

export async function runRateLimitProbe(ctx: HarnessContext): Promise<ProbeResult> {
  const routes = ctx.sst.runtimeProbeHints.auth?.public_rate_limited_routes ?? [];
  const route = routes[0];
  const limit = route?.test_override ?? 5;
  const citation = 'runtime_probe_hints.auth.public_rate_limited_routes test_override';

  if (!route) {
    return {
      probeId: 'rate-limit-triggers',
      probeName: 'Rate limits trigger at N+1',
      verdict: 'AMBER',
      subProbes: [],
      evidence: [{ summary: 'No public_rate_limited_routes in probe hints' }],
    };
  }

  const url = functionsUrl(ctx, route.path);
  const subProbes: SubProbeResult[] = [];
  let saw429 = false;

  for (let i = 1; i <= limit + 3; i++) {
    const res = await ctx.fetchFn(url, {
      method: route.method,
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.1' },
      body: route.method === 'POST' ? JSON.stringify({ code: 'INVALID' }) : undefined,
    });
    if (res.status === 429) saw429 = true;
    subProbes.push({
      id: `burst ${i}`,
      verdict:
        i <= limit ? (res.status < 500 ? 'GREEN' : 'RED') : res.status === 429 ? 'GREEN' : 'RED',
      detail: `HTTP ${res.status}`,
      citation,
    });
    if (saw429) break;
  }

  return {
    probeId: 'rate-limit-triggers',
    probeName: 'Rate limits trigger at N+1',
    verdict: saw429 ? 'GREEN' : 'RED',
    subProbes,
    evidence: [
      {
        summary: `Burst ${limit + 1}+ requests at lowered threshold (${limit}/hr via test_override)`,
        command: `for i in 1..${limit + 3}: curl -X ${route.method} ${url}`,
        citation,
      },
    ],
  };
}
