import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { csprngSurfaces } from '../sst-spine.js';
import { readProducerText, resolveRepoPath, worstVerdict } from '../probe-utils.js';
import type { HarnessContext } from '../types/harness.js';
import type { ProbeResult, SubProbeResult } from '../types/probe-result.js';

const CSPRNG_N = Number(process.env.BR_RUNTIME_CSPRNG_N ?? '100000');

function staticCsprngCheck(text: string): { ok: boolean; detail: string } {
  const usesCrypto =
    /crypto\.randomInt|crypto\.randomBytes|crypto\.getRandomValues|\brandomInt\s*\(/.test(text);
  const usesMath = /Math\.random/.test(text);
  if (!usesCrypto) return { ok: false, detail: 'No crypto CSPRNG API detected' };
  if (usesMath) return { ok: false, detail: 'Math.random present — not CSPRNG-safe' };
  return { ok: true, detail: 'crypto CSPRNG API present; Math.random absent' };
}

async function sampleTokens(
  ctx: HarnessContext,
  spineId: string,
  producerFile?: string,
): Promise<string[] | undefined> {
  const hint = ctx.sst.runtimeProbeHints.csprng?.find((c) => c.spine_id === spineId);
  const modPath = hint?.sample_module ?? hint?.producer_file ?? producerFile;
  if (!modPath) return undefined;
  try {
    const resolved = resolveRepoPath(ctx.sst, modPath);
    const url = pathToFileURL(resolved).href;
    const mod = (await import(/* @vite-ignore */ url)) as {
      generateToken?: () => string;
      default?: () => string;
    };
    const gen = mod.generateToken ?? mod.default;
    if (typeof gen !== 'function') return undefined;
    const tokens: string[] = [];
    for (let i = 0; i < CSPRNG_N; i++) tokens.push(gen());
    return tokens;
  } catch {
    return undefined;
  }
}

function statisticalCheck(
  tokens: string[],
  mockMode: boolean,
): { ok: boolean; detail: string; citation: string } {
  const set = new Set(tokens);
  if (set.size !== tokens.length) {
    return {
      ok: false,
      detail: `${tokens.length - set.size} collisions in N=${CSPRNG_N}`,
      citation: 'src/probes/csprng-probe.ts:1',
    };
  }
  if (!mockMode) {
    const buckets = new Map<string, number>();
    for (const t of tokens) {
      for (const ch of t) buckets.set(ch, (buckets.get(ch) ?? 0) + 1);
    }
    const counts = [...buckets.values()];
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance =
      counts.reduce((s, c) => s + (c - mean) ** 2, 0) / Math.max(1, counts.length - 1);
    const cv = Math.sqrt(variance) / mean;
    if (counts.length > 1 && cv > 0.55) {
      return {
        ok: false,
        detail: `High char-frequency variance (cv=${cv.toFixed(3)})`,
        citation: 'src/probes/csprng-probe.ts:1',
      };
    }
  }
  const digest = createHash('sha256').update(tokens.join('')).digest('hex').slice(0, 12);
  return {
    ok: true,
    detail: `N=${CSPRNG_N} zero collisions; sample digest ${digest}`,
    citation: 'src/probes/csprng-probe.ts:1',
  };
}

export async function runCsprngProbe(ctx: HarnessContext): Promise<ProbeResult> {
  const surfaces = csprngSurfaces(ctx.sst);
  const subProbes: SubProbeResult[] = [];

  for (const surface of surfaces) {
    const file = surface.producerFile;
    const citation = file ? `${file}:1` : `spine:${surface.id}`;
    if (file) {
      const text = readProducerText(ctx.sst, file);
      if (text) {
        const st = staticCsprngCheck(text);
        subProbes.push({
          id: `${surface.id} — static`,
          verdict: st.ok ? 'GREEN' : 'RED',
          detail: st.detail,
          citation,
        });
      }
    }

    const tokens = await sampleTokens(ctx, surface.id, file);
    if (tokens) {
      const stat = statisticalCheck(tokens, ctx.mockMode);
      subProbes.push({
        id: `${surface.id} — statistical`,
        verdict: stat.ok ? 'GREEN' : 'RED',
        detail: stat.detail,
        citation: stat.citation,
      });
    } else if (!file) {
      subProbes.push({
        id: surface.id,
        verdict: 'AMBER',
        detail: 'No producer_file or csprng sample_module hint',
        citation,
      });
    }
  }

  if (!surfaces.length) {
    subProbes.push({
      id: 'csprng-surfaces',
      verdict: 'GREEN',
      detail: 'No token-generator spine ids — nothing to sample',
      citation: 'docs/00-PHASE-A-BRIEF.md §2 row 5',
    });
  }

  return {
    probeId: 'csprng-strength',
    probeName: 'CSPRNG statistical strength',
    verdict: worstVerdict(subProbes),
    subProbes,
    evidence: [
      {
        summary: `Sample size N=${CSPRNG_N} per generator`,
        citation: 'src/probes/csprng-probe.ts:1',
      },
    ],
  };
}
