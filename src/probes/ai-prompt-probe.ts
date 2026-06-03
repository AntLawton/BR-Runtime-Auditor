import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { aiPromptSurfaces } from '../sst-spine.js';
import { readProducerText, resolveRepoPath, worstVerdict } from '../probe-utils.js';
import type { HarnessContext } from '../types/harness.js';
import type { ProbeResult, SubProbeResult } from '../types/probe-result.js';

const TEMP_ZERO_RE = /temperature\s*:\s*0(?:\.0)?\b/;
const FORBIDDEN_SUMMARY_RE = /summariz|interpret|insight|themes?/i;

function checkPromptFile(text: string): { ok: boolean; detail: string } {
  if (!TEMP_ZERO_RE.test(text)) {
    return { ok: false, detail: 'temperature not pinned to 0.0' };
  }
  const marker = text.match(/systemInstruction|system:\s*[`'"]|You are transcrib/i);
  if (!marker && FORBIDDEN_SUMMARY_RE.test(text)) {
    return { ok: false, detail: 'prompt may allow summarisation language' };
  }
  return { ok: true, detail: 'temperature 0.0 and no forbidden summary language detected' };
}

async function assembleRuntimePrompt(
  ctx: HarnessContext,
  producerFile: string,
): Promise<string | undefined> {
  try {
    const resolved = resolveRepoPath(ctx.sst, producerFile);
    const mod = (await import(/* @vite-ignore */ pathToFileURL(resolved).href)) as {
      assemblePrompt?: () => string;
    };
    if (typeof mod.assemblePrompt === 'function') return mod.assemblePrompt();
  } catch {
    /* fall through to producer text heuristic */
  }
  const text = readProducerText(ctx.sst, producerFile);
  if (!text) return undefined;
  const temp = text.match(/temperature\s*:\s*([\d.]+)/)?.[1] ?? '0.0';
  const instruction =
    text.match(/systemInstruction:\s*['"]([^'"]+)['"]/)?.[1] ??
    text.match(/systemInstruction:\s*`([^`]+)`/)?.[1];
  if (!instruction) return undefined;
  return `temperature: ${temp}\nsystemInstruction: ${instruction}`;
}

export async function runAiPromptProbe(ctx: HarnessContext): Promise<ProbeResult> {
  const surfaces = aiPromptSurfaces(ctx.sst);
  const subProbes: SubProbeResult[] = [];

  for (const surface of surfaces) {
    const file = surface.producerFile;
    if (!file) {
      subProbes.push({
        id: surface.id,
        verdict: 'AMBER',
        detail: 'No producer_file on spine entry',
        citation: 'SST.md spine',
      });
      continue;
    }

    const text = readProducerText(ctx.sst, file);
    const citation = `${file}:1`;
    if (!text) {
      subProbes.push({
        id: surface.id,
        verdict: 'AMBER',
        detail: `Producer file not readable at ${resolveRepoPath(ctx.sst, file)}`,
        citation,
      });
      continue;
    }

    const hint = ctx.sst.runtimeProbeHints.ai_prompt_surfaces?.find((h) => h.id === surface.id);
    if (hint?.golden_file) {
      try {
        const goldenPath = resolveRepoPath(ctx.sst, hint.golden_file);
        const golden = readFileSync(goldenPath, 'utf8').trimEnd();
        const assembled = await assembleRuntimePrompt(ctx, hint.producer_file ?? file);
        if (!assembled) {
          subProbes.push({
            id: `${surface.id} — golden`,
            verdict: 'AMBER',
            detail: 'Could not assemble runtime prompt for golden compare',
            citation: goldenPath,
          });
        } else {
          const match = assembled.trimEnd() === golden;
          subProbes.push({
            id: `${surface.id} — golden`,
            verdict: match ? 'GREEN' : 'RED',
            detail: match
              ? 'Runtime-assembled prompt matches golden fixture'
              : 'Runtime-assembled prompt differs from golden fixture',
            citation: goldenPath,
          });
        }
      } catch {
        subProbes.push({
          id: `${surface.id} — golden`,
          verdict: 'AMBER',
          detail: 'Golden prompt file missing',
          citation: hint.golden_file,
        });
      }
    }

    const check = checkPromptFile(text);
    subProbes.push({
      id: surface.id,
      verdict: check.ok ? 'GREEN' : 'RED',
      detail: check.detail,
      citation,
    });
  }

  if (!surfaces.length) {
    subProbes.push({
      id: 'ai-surfaces',
      verdict: 'AMBER',
      detail: 'No spine ids matching AI globs and no ai_prompt_surfaces hints',
      citation: 'docs/00-PHASE-A-BRIEF.md §2 row 4',
    });
  }

  if (ctx.networkMock) {
    const blocked = ctx.networkMock.assertZeroBlockedCalls();
    subProbes.push({
      id: 'network-mock — zero real AI provider calls',
      verdict: blocked.ok ? 'GREEN' : 'RED',
      detail: blocked.ok
        ? 'No Vertex AI / Anthropic requests attempted'
        : `${blocked.log.length} blocked provider call(s) logged`,
      citation: 'src/harness/network-mock.ts:1',
    });
  }

  if (!ctx.mockMode && ctx.fetchFn) {
    const failUrl = 'https://api.anthropic.com/v1/messages';
    const failClosed = await ctx.fetchFn(failUrl, {
      method: 'POST',
      headers: { 'X-BR-Simulate-AI-Down': '1' },
    });
    const ok = failClosed.status >= 500;
    subProbes.push({
      id: 'fail-closed — AI provider unreachable',
      verdict: ok ? 'GREEN' : 'AMBER',
      detail: ok
        ? `HTTP ${failClosed.status} on simulated outage`
        : `HTTP ${failClosed.status} — expected non-2xx`,
      citation: 'src/harness/network-mock.ts:1',
    });
  }

  return {
    probeId: 'ai-prompt-pinned',
    probeName: 'AI prompt pinned at temperature 0.0',
    verdict: worstVerdict(subProbes),
    subProbes,
    evidence: [
      {
        summary: `Checked ${surfaces.length} AI surface(s); network-mock active`,
        citation: 'src/probes/ai-prompt-probe.ts:1',
      },
    ],
  };
}
