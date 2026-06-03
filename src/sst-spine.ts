import type { ParsedSst, SpineEntry } from './types/sst.js';

const AI_SPINE_GLOBS = [
  '*.classifier',
  '*.enricher',
  '*.routing',
  '*.transcribe',
  '*.llm_*_prompt',
];

const CSPRNG_SPINE_GLOBS = ['*.access_code', '*.magic_link', '*.token_*'];

export function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

export function spineMatchesGlob(id: string, glob: string): boolean {
  return globToRegExp(glob).test(id);
}

export function filterSpineByGlobs(spine: SpineEntry[], globs: string[]): SpineEntry[] {
  const seen = new Set<string>();
  const out: SpineEntry[] = [];
  for (const entry of spine) {
    if (seen.has(entry.id)) continue;
    if (globs.some((g) => spineMatchesGlob(entry.id, g))) {
      seen.add(entry.id);
      out.push(entry);
    }
  }
  return out;
}

export function aiPromptSurfaces(sst: ParsedSst): SpineEntry[] {
  const fromSpine = filterSpineByGlobs(sst.spine, AI_SPINE_GLOBS);
  const hints = sst.runtimeProbeHints.ai_prompt_surfaces ?? [];
  const hintEntries: SpineEntry[] = hints.map((h) => ({
    id: h.id,
    producerFile: h.producer_file,
    blockMarker: h.block_marker,
  }));
  const merged = [...fromSpine];
  for (const h of hintEntries) {
    if (!merged.some((e) => e.id === h.id)) merged.push(h);
  }
  return merged;
}

export function csprngSurfaces(sst: ParsedSst): SpineEntry[] {
  const fromSpine = filterSpineByGlobs(sst.spine, CSPRNG_SPINE_GLOBS);
  const hints = sst.runtimeProbeHints.csprng ?? [];
  for (const h of hints) {
    if (!fromSpine.some((e) => e.id === h.spine_id)) {
      fromSpine.push({
        id: h.spine_id,
        producerFile: h.producer_file,
      });
    }
  }
  return fromSpine;
}
