import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type {
  EnvVarContractEntry,
  LaunchGate,
  ParsedSst,
  RuntimeProbeHints,
  SpineEntry,
} from './types/sst.js';

const YAML_BLOCK_RE = /```yaml\r?\n([\s\S]*?)```/;

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

function parseSpine(value: unknown): SpineEntry[] {
  return asArray<Record<string, unknown>>(value).map((entry) => {
    const producer = asRecord(entry.producer);
    return {
      id: String(entry.id ?? ''),
      producerFile: producer?.file ? String(producer.file) : undefined,
      blockMarker: producer?.block_marker ? String(producer.block_marker) : undefined,
    };
  });
}

function parseEnvVarContract(meta: Record<string, unknown>): EnvVarContractEntry[] {
  return asArray<Record<string, unknown>>(meta.env_var_contract).map((e) => ({
    name: String(e.name ?? ''),
    description: e.description ? String(e.description) : undefined,
  }));
}

function parseLaunchGate(value: unknown): LaunchGate | undefined {
  const rec = asRecord(value);
  if (!rec) return undefined;
  const name = rec.name ? String(rec.name) : undefined;
  const date = rec.date ? String(rec.date) : undefined;
  if (name && date) return { name, date };
  return undefined;
}

export function mergeProbeHints(
  base: RuntimeProbeHints,
  overlay?: RuntimeProbeHints,
): RuntimeProbeHints {
  if (!overlay) return base;
  return {
    ...base,
    ...overlay,
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
      postgres_deny_queries:
        overlay.db_rules?.postgres_deny_queries ?? base.db_rules?.postgres_deny_queries,
    },
    ai_prompt_surfaces: overlay.ai_prompt_surfaces ?? base.ai_prompt_surfaces,
    csprng: overlay.csprng ?? base.csprng,
    distinct_secret_pairs: overlay.distinct_secret_pairs ?? base.distinct_secret_pairs,
    privacy_thresholds: overlay.privacy_thresholds ?? base.privacy_thresholds,
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

function findProjectRoot(startPath: string): string {
  let dir = resolve(dirname(startPath));
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(dirname(startPath));
    dir = parent;
  }
}

export function parseSstFile(sstPath: string, repoRoot?: string): ParsedSst {
  const absPath = resolve(sstPath);
  const resolvedRepoRoot = repoRoot ? resolve(repoRoot) : findProjectRoot(absPath);
  const markdown = readFileSync(absPath, 'utf8');
  const yaml = extractYamlBlock(markdown);
  const meta = asRecord(yaml.meta) ?? {};
  const hintsFromSst = meta.runtime_probe_hints as RuntimeProbeHints | undefined;
  const hintsSidecar = readProbeHintsSidecar(absPath);
  const mergedHints = mergeProbeHints(hintsFromSst ?? {}, hintsSidecar);
  const launchGate = parseLaunchGate(meta.launch_gate) ?? parseLaunchGate(mergedHints.launch_gate);
  const mission = typeof yaml.mission === 'string' ? yaml.mission : undefined;

  return {
    project: String(yaml.project ?? 'unknown'),
    projectType: yaml.project_type ? String(yaml.project_type) : undefined,
    sstVersion: yaml.sst_version ? String(yaml.sst_version) : undefined,
    productName: mission?.slice(0, 80),
    criticalContracts: asArray<string>(yaml.critical_contracts),
    spine: parseSpine(yaml.spine),
    envVarContract: parseEnvVarContract(meta),
    securityLayer: asArray<Record<string, unknown>>(meta.security_layer).map((entry) => ({
      name: String(entry.name ?? ''),
      layer: String(entry.layer ?? ''),
      provider: entry.provider ? String(entry.provider) : undefined,
      producer_file: entry.producer_file ? String(entry.producer_file) : undefined,
      description: entry.description ? String(entry.description) : undefined,
    })),
    runtimeProbeHints: mergedHints,
    launchGate,
    repoRoot: resolvedRepoRoot,
    sstPath: absPath,
    rawYaml: yaml,
  };
}

export function loadProbeHintsYaml(content: string): RuntimeProbeHints {
  const parsed = parseYaml(content) as { runtime_probe_hints?: RuntimeProbeHints };
  return parsed.runtime_probe_hints ?? {};
}
