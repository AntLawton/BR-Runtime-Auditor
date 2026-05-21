import type { HarnessContext } from '../types/harness.js';
import type { ProbeResult, SubProbeResult } from '../types/probe-result.js';

function storageDenyPrefix(ctx: HarnessContext): string {
  const firstPath = ctx.sst.runtimeProbeHints.db_rules?.storage_deny_paths?.[0];
  return firstPath?.split('/')[0] ?? 'storage-prefix';
}

export async function runStorageRulesProbe(ctx: HarnessContext): Promise<ProbeResult> {
  const paths = ctx.sst.runtimeProbeHints.db_rules?.storage_deny_paths ?? [];
  const storageLayer = ctx.sst.securityLayer.find((s) => s.layer === 'storage-rules');
  const storagePrefix = storageDenyPrefix(ctx);
  const citation = storageLayer?.producer_file
    ? `${storageLayer.producer_file}:${storagePrefix} deny block`
    : 'storage.rules deny block';

  if (!paths.length) {
    return {
      probeId: 'storage-rules-deny',
      probeName: 'Storage rules deny client writes to audio paths',
      verdict: 'AMBER',
      subProbes: [],
      evidence: [{ summary: 'No runtime_probe_hints.db_rules.storage_deny_paths configured' }],
    };
  }

  const { storagePort, projectId } = ctx.emulator;
  const subProbes: SubProbeResult[] = [];

  for (const objectPath of paths) {
    const encoded = encodeURIComponent(objectPath);
    const url = `http://127.0.0.1:${storagePort}/v0/b/${projectId}.appspot.com/o/${encoded}`;
    const res = await ctx.fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'probe-write-test',
    });
    const denied = res.status === 403 || res.status === 401 || (ctx.mockMode && res.status === 403);
    subProbes.push({
      id: `client write ${objectPath}`,
      verdict: denied ? 'GREEN' : 'RED',
      detail: denied
        ? `permission-denied HTTP ${res.status}`
        : `write succeeded HTTP ${res.status}`,
      citation,
    });
  }

  return {
    probeId: 'storage-rules-deny',
    probeName: 'Storage rules deny client writes to audio paths (Probe 7a)',
    verdict: subProbes.every((s) => s.verdict === 'GREEN') ? 'GREEN' : 'RED',
    subProbes,
    evidence: [
      {
        summary: 'Storage emulator client-SDK-style write to audio prefix',
        command: `POST storage://${paths[0] ?? 'audio-path'}`,
        citation,
      },
    ],
  };
}

export function runBucketScanDeferred(ctx: HarnessContext): ProbeResult {
  const storagePrefix = storageDenyPrefix(ctx);
  return {
    probeId: 'real-bucket-audio-absence',
    probeName: 'Real Cloud Storage bucket prefix scan (Probe 7b)',
    verdict: 'DEFERRED',
    subProbes: [],
    evidence: [
      {
        summary:
          'HYBRID fork #1 — real-bucket scan stays in product manual runbook §Check 7 as one-time pre-launch check before 2026-05-25. Auditor delivers 7a (storage-rules-deny) only.',
        citation: 'deploy-unit/br-runtime-checks-runbook.md §Check 7',
        command: `gsutil ls gs://BUCKET/${storagePrefix}/** (manual, read-only ADC)`,
      },
    ],
    note: 'DEFERRED — not automated in Auditor per Hard NO #103',
  };
}
