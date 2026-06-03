import { sweepThreshold } from '../privacy-floor.js';
import { readProducerText, worstVerdict } from '../probe-utils.js';
import type { HarnessContext } from '../types/harness.js';
import type { PrivacyThresholdHint } from '../types/sst.js';
import type { ProbeResult, SubProbeResult } from '../types/probe-result.js';

const THRESHOLD_CONST_RE =
  /(MIN_[A-Z0-9_]+|DEFAULT_[A-Z0-9_]*K_ANONYMITY|DEFAULT_MINIMUM_AGGREGATION)\s*=\s*(\d+)/g;

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

export async function runPrivacyThresholdProbe(ctx: HarnessContext): Promise<ProbeResult> {
  const thresholds = parseThresholdsFromHints(ctx);
  const subProbes: SubProbeResult[] = [];
  const delta = Number(process.env.BR_RUNTIME_THRESHOLD_DELTA ?? '2');

  for (const t of thresholds) {
    const sweep = sweepThreshold(t.value, delta);
    const leaks = sweep.filter((s) => s.groupSize < t.value && s.surfaces);
    const citation = t.producer_file ? `${t.producer_file}:1` : 'runtime_probe_hints';
    subProbes.push({
      id: t.name,
      verdict: leaks.length ? 'RED' : 'GREEN',
      detail: leaks.length
        ? `Sub-threshold leak at sizes: ${leaks.map((l) => l.groupSize).join(', ')}`
        : `Threshold ${t.value} — sub-threshold groups suppressed (±${delta} sweep)`,
      citation,
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
        summary: `Property sweep on ${thresholds.length} threshold(s)`,
        citation: 'src/probes/privacy-threshold-probe.ts:1',
      },
    ],
  };
}
