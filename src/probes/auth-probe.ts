import type { HarnessContext } from '../types/harness.js';
import { functionsUrl } from '../harness/firebase.js';
import type { ProbeResult, SubProbeResult, Verdict } from '../types/probe-result.js';

function worstVerdict(subProbes: SubProbeResult[]): Verdict {
  const order: Verdict[] = ['RED', 'AMBER', 'DEFERRED', 'SKIPPED', 'GREEN'];
  for (const v of order) {
    if (subProbes.some((s) => s.verdict === v)) return v;
  }
  return 'GREEN';
}

export async function runAuthProbe(ctx: HarnessContext): Promise<ProbeResult> {
  const hints = ctx.sst.runtimeProbeHints.auth?.protected_routes ?? [];
  const authLayers = ctx.sst.securityLayer.filter((s) => s.layer === 'auth-middleware');
  const citation = authLayers[0]?.producer_file
    ? `${authLayers[0].producer_file}:69`
    : 'security_layer auth-middleware';

  if (!hints.length) {
    return {
      probeId: 'auth-gate-rejects',
      probeName: 'Auth gate rejects unauthorised requests',
      verdict: 'AMBER',
      subProbes: [],
      evidence: [
        { summary: 'No runtime_probe_hints.auth.protected_routes — cannot dispatch sub-probes' },
      ],
      note: 'Add sst-probe-hints.yaml sidecar with protected_routes',
    };
  }

  const subProbes: SubProbeResult[] = [];
  for (const route of hints) {
    const url = functionsUrl(ctx, route.path);
    const noToken = await ctx.fetchFn(url, { method: route.method });
    const noTokenOk = noToken.status === 401 || noToken.status === 403;
    subProbes.push({
      id: `${route.method} ${route.path} — no token`,
      verdict: noTokenOk ? 'GREEN' : 'RED',
      detail: `HTTP ${noToken.status}`,
      citation,
    });

    const badToken = await ctx.fetchFn(url, {
      method: route.method,
      headers: { Authorization: 'Bearer invalid-token' },
    });
    const badTokenOk = badToken.status === 401 || badToken.status === 403;
    subProbes.push({
      id: `${route.method} ${route.path} — invalid token`,
      verdict: badTokenOk ? 'GREEN' : 'RED',
      detail: `HTTP ${badToken.status}`,
      citation,
    });
  }

  if (!ctx.mockMode) {
    const failClosedUrl = functionsUrl(ctx, hints[0]?.path ?? '/');
    const failClosed = await ctx.fetchFn(failClosedUrl, {
      method: hints[0]?.method ?? 'GET',
      headers: { 'X-BR-Simulate-Auth-Down': '1' },
    });
    const failClosedOk = failClosed.status >= 500 || failClosed.status === 503;
    subProbes.push({
      id: 'fail-closed — auth dependency unreachable',
      verdict: failClosedOk ? 'GREEN' : 'AMBER',
      detail: failClosedOk
        ? `HTTP ${failClosed.status} on simulated auth outage`
        : `HTTP ${failClosed.status} — expected 503 on auth outage (header X-BR-Simulate-Auth-Down)`,
      citation,
    });
  }

  return {
    probeId: 'auth-gate-rejects',
    probeName: 'Auth gate rejects unauthorised requests',
    verdict: worstVerdict(subProbes),
    subProbes,
    evidence: [
      {
        summary: `${subProbes.filter((s) => s.verdict === 'GREEN').length}/${subProbes.length} sub-probes GREEN`,
        command: `curl -i ${functionsUrl(ctx, hints[0]?.path ?? '/')}`,
        citation,
      },
    ],
  };
}
