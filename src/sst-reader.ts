import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { ParsedSst, RuntimeProbeHints } from './types/sst.js';

const YAML_BLOCK_RE = /```yaml\n([\s\S]*?)```/;

function extractYamlBlock(markdown: string): Record<string, unknown> {
  const match = YAML_BLOCK_RE.exec(markdown);
  if (!match?.[1]) {
    throw new Error('SST.md: no ```yaml spine block found');
  }
  return parseYaml(match[1]) as Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function mergeProbeHints(
  base: RuntimeProbeHints,
  overlay?: RuntimeProbeHints,
): RuntimeProbeHints {
  if (!overlay) return base;
  return {
    emulator: { ...base.emulator, ...overlay.emulator },
    auth: {
      protected_routes: overlay.auth?.protected_routes ?? base.auth?.protected_routes,
      public_rate_limited_routes:
        overlay.auth?.public_rate_limited_routes ?? base.auth?.public_rate_limited_routes,
    },
    db_rules: {
      firestore_deny_paths:
        overlay.db_rules?.firestore_deny_paths ?? base.db_rules?.firestore_deny_paths,
      storage_deny_paths: overlay.db_rules?.storage_deny_paths ?? base.db_rules?.storage_deny_paths,
    },
  };
}

export function readProbeHintsSidecar(sstPath: string): RuntimeProbeHints | undefined {
  const sidecar = join(dirname(sstPath), 'sst-probe-hints.yaml');
  try {
    const raw = parseYaml(readFileSync(sidecar, 'utf8')) as {
      runtime_probe_hints?: RuntimeProbeHints;
    };
    return raw.runtime_probe_hints;
  } catch {
    return undefined;
  }
}

export function parseSstFile(sstPath: string, repoRoot?: string): ParsedSst {
  const absPath = resolve(sstPath);
  const markdown = readFileSync(absPath, 'utf8');
  const yaml = extractYamlBlock(markdown);
  const meta = asRecord(yaml.meta) ?? {};
  const hintsFromSst = asRecord(meta.runtime_probe_hints) as RuntimeProbeHints | undefined;
  const hintsSidecar = readProbeHintsSidecar(absPath);
  const mission = typeof yaml.mission === 'string' ? yaml.mission : undefined;

  return {
    project: String(yaml.project ?? 'unknown'),
    projectType: yaml.project_type ? String(yaml.project_type) : undefined,
    sstVersion: yaml.sst_version ? String(yaml.sst_version) : undefined,
    productName: mission?.slice(0, 80),
    criticalContracts: asArray<string>(yaml.critical_contracts),
    securityLayer: asArray<Record<string, unknown>>(meta.security_layer).map((entry) => ({
      name: String(entry.name ?? ''),
      layer: String(entry.layer ?? ''),
      provider: entry.provider ? String(entry.provider) : undefined,
      producer_file: entry.producer_file ? String(entry.producer_file) : undefined,
      description: entry.description ? String(entry.description) : undefined,
    })),
    runtimeProbeHints: mergeProbeHints(hintsFromSst ?? {}, hintsSidecar),
    repoRoot: repoRoot ? resolve(repoRoot) : dirname(absPath),
    sstPath: absPath,
    rawYaml: yaml,
  };
}

export function loadProbeHintsYaml(content: string): RuntimeProbeHints {
  const parsed = parseYaml(content) as { runtime_probe_hints?: RuntimeProbeHints };
  return parsed.runtime_probe_hints ?? {};
}
