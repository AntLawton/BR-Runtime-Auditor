import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ParsedSst } from './types/sst.js';
import type { SubProbeResult, Verdict } from './types/probe-result.js';

export function worstVerdict(subProbes: SubProbeResult[]): Verdict {
  const order: Verdict[] = ['RED', 'AMBER', 'DEFERRED', 'SKIPPED', 'GREEN'];
  for (const v of order) {
    if (subProbes.some((s) => s.verdict === v)) return v;
  }
  return 'GREEN';
}

export function readProducerText(sst: ParsedSst, producerFile: string): string | undefined {
  const root = sst.repoRoot ?? sst.sstPath;
  const path = resolve(root, producerFile);
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

export function resolveRepoPath(sst: ParsedSst, relativePath: string): string {
  return join(sst.repoRoot ?? sst.sstPath, relativePath);
}
