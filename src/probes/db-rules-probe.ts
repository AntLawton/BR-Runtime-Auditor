import type { HarnessContext } from '../types/harness.js';
import type { ProbeResult, SubProbeResult, Verdict } from '../types/probe-result.js';

function worstVerdict(subProbes: SubProbeResult[]): Verdict {
  if (subProbes.some((s) => s.verdict === 'RED')) return 'RED';
  if (subProbes.some((s) => s.verdict === 'AMBER')) return 'AMBER';
  return 'GREEN';
}

export async function runDbRulesProbe(ctx: HarnessContext): Promise<ProbeResult> {
  const paths = ctx.sst.runtimeProbeHints.db_rules?.firestore_deny_paths ?? [];
  const dbLayer = ctx.sst.securityLayer.find((s) => s.layer === 'nosql-rules-engine');
  const citation = dbLayer?.producer_file
    ? `${dbLayer.producer_file}:288`
    : 'firestore.rules deny block';

  if (!paths.length) {
    return {
      probeId: 'db-rules-deny',
      probeName: 'DB rules deny direct client reads',
      verdict: 'AMBER',
      subProbes: [],
      evidence: [{ summary: 'No runtime_probe_hints.db_rules.firestore_deny_paths configured' }],
    };
  }

  const subProbes: SubProbeResult[] = [];
  const { firestorePort, projectId } = ctx.emulator;

  for (const collPath of paths) {
    const [collection, docId] = collPath.split('/');
    const url =
      `http://127.0.0.1:${firestorePort}/v1/projects/${projectId}/databases/(default)/documents/` +
      `${collection}/${docId ?? 'probe-test-id'}`;

    const res = await ctx.fetchFn(url, {
      headers: { Authorization: 'Bearer owner' },
    });
    const body = (await res.json().catch(() => ({}))) as { error?: { status?: string } };
    const denied =
      res.status === 403 ||
      body.error?.status === 'PERMISSION_DENIED' ||
      (ctx.mockMode && res.status === 403);

    subProbes.push({
      id: `client read ${collPath}`,
      verdict: denied ? 'GREEN' : 'RED',
      detail: denied
        ? `permission-denied (${body.error?.status ?? res.status})`
        : `read succeeded — HTTP ${res.status}`,
      citation,
    });
  }

  if (!ctx.mockMode) {
    const collPath = paths[0] ?? 'collection/id';
    const [collection, docId] = collPath.split('/');
    const url =
      `http://127.0.0.1:${firestorePort}/v1/projects/${projectId}/databases/(default)/documents/` +
      `${collection}/${docId ?? 'probe-test-id'}`;
    const res = await ctx.fetchFn(url, {
      headers: {
        Authorization: 'Bearer owner',
        'X-BR-Simulate-Firestore-Down': '1',
      },
    });
    const failClosed = res.status >= 500 || res.status === 503;
    subProbes.push({
      id: 'fail-closed — Firestore unreachable',
      verdict: failClosed ? 'GREEN' : 'AMBER',
      detail: `HTTP ${res.status} on simulated Firestore outage`,
      citation,
    });
  }

  return {
    probeId: 'db-rules-deny',
    probeName: 'DB rules deny direct client reads',
    verdict: worstVerdict(subProbes),
    subProbes,
    evidence: [
      {
        summary: 'Direct client-SDK-style REST read against Firestore emulator',
        command: `GET ${paths[0] ?? 'firestore path'}`,
        citation,
      },
    ],
  };
}
