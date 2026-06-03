import { pathToFileURL } from 'node:url';
import { sweepGroupSizes } from '../privacy-floor.js';
import { readProducerText, resolveRepoPath, worstVerdict } from '../probe-utils.js';
import type { HarnessContext } from '../types/harness.js';
import type { PrivacyThresholdHint } from '../types/sst.js';
import type { ProbeResult, SubProbeResult } from '../types/probe-result.js';

const THRESHOLD_CONST_RE =
  /(MIN_[A-Z0-9_]+|DEFAULT_[A-Z0-9_]*K_ANONYMITY|DEFAULT_MINIMUM_AGGREGATION)\s*=\s*(\d+)/g;

type AggregationFn = (groupSize: number, thresholdName: string) => boolean;

function parseThresholdsFromHints(ctx: HarnessContext): PrivacyThresholdHint[] {
  const hints = ctx.sst.runtimeProbeHints.privacy_thresholds ?? [];
  if (hints.length) return hints;

  const found: PrivacyThresholdHint[] = [];
  for (const entry of ctx.sst.spine) {
    if (!entry.producerFile) continue;
    const text = readProducerText(ctx.sst, entry.producerFile);
    if (!text) continue;
    for (const m of text.matchAll(THRESHOLD_CONST_RE)) {
      found.push({
        name: m[1] ?? 'UNKNOWN',
        value: Number(m[2]),
        producer_file: entry.producerFile,
      });
    }
  }
  return found;
}

async function loadAggregationFn(
  ctx: HarnessContext,
  modulePath: string,
): Promise<AggregationFn | undefined> {
  try {
    const resolved = resolveRepoPath(ctx.sst, modulePath);
    const mod = (await import(/* @vite-ignore */ pathToFileURL(resolved).href)) as {
      shouldSurfaceAggregate?: AggregationFn;
    };
    return typeof mod.shouldSurfaceAggregate === 'function'
      ? mod.shouldSurfaceAggregate
      : undefined;
  } catch {
    return undefined;
  }
}

export async function runPrivacyThresholdProbe(ctx: HarnessContext): Promise<ProbeResult> {
  const thresholds = parseThresholdsFromHints(ctx);
  const subProbes: SubProbeResult[] = [];
  const delta = Number(process.env.BR_RUNTIME_THRESHOLD_DELTA ?? '2');
  const moduleCache = new Map<string, AggregationFn | undefined>();

  for (const t of thresholds) {
    const citation = t.producer_file ? `${t.producer_file}:1` : 'runtime_probe_hints';
    const modPath = t.aggregation_module;
    if (!modPath) {
      subProbes.push({
        id: t.name,
        verdict: 'DEFERRED',
        detail: 'No aggregation_module hint — cannot verify product aggregate output',
        citation,
      });
      continue;
    }

    let aggregateFn = moduleCache.get(modPath);
    if (aggregateFn === undefined && !moduleCache.has(modPath)) {
      aggregateFn = await loadAggregationFn(ctx, modPath);
      moduleCache.set(modPath, aggregateFn);
    }
    if (!aggregateFn) {
      subProbes.push({
        id: t.name,
        verdict: 'DEFERRED',
        detail: `aggregation_module unreadable or missing shouldSurfaceAggregate: ${modPath}`,
        citation: modPath,
      });
      continue;
    }

    const sizes = sweepGroupSizes(t.value, delta);
    const leaks: number[] = [];
    for (const groupSize of sizes) {
      if (groupSize < t.value && aggregateFn(groupSize, t.name)) {
        leaks.push(groupSize);
      }
    }

    subProbes.push({
      id: t.name,
      verdict: leaks.length ? 'RED' : 'GREEN',
      detail: leaks.length
        ? `Sub-threshold leak at sizes: ${leaks.join(', ')}`
        : `Threshold ${t.value} — sub-threshold groups suppressed in product output (±${delta} sweep)`,
      citation: modPath,
    });
  }

  if (!thresholds.length) {
    return {
      probeId: 'privacy-threshold-floors',
      probeName: 'Privacy threshold floor property tests',
      verdict: 'GREEN',
      subProbes: [],
      evidence: [
        {
          summary: 'No MIN_* / k-anonymity thresholds declared for this product',
          citation: 'src/probes/privacy-threshold-probe.ts:1',
        },
      ],
    };
  }

  return {
    probeId: 'privacy-threshold-floors',
    probeName: 'Privacy threshold floor property tests',
    verdict: worstVerdict(subProbes),
    subProbes,
    evidence: [
      {
        summary: `Product aggregation output sweep on ${thresholds.length} threshold(s)`,
        citation: 'src/probes/privacy-threshold-probe.ts:1',
      },
    ],
  };
}
