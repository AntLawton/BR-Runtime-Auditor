import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import type { ContractRoute, RoutingCoverage } from './types/probe-result.js';

interface RoutingTableFile {
  version: string;
  rules: ContractRoute[];
}

let cachedTable: RoutingTableFile | undefined;

export function loadRoutingTable(customPath?: string): RoutingTableFile {
  if (cachedTable && !customPath) return cachedTable;
  const here = dirname(fileURLToPath(import.meta.url));
  const tablePath = customPath ?? join(here, 'routing-table.yaml');
  const parsed = parseYaml(readFileSync(tablePath, 'utf8')) as RoutingTableFile;
  if (!parsed.rules?.length) {
    throw new Error(`routing-table.yaml at ${tablePath} has no rules`);
  }
  if (!customPath) cachedTable = parsed;
  return parsed;
}

export function routeContract(contract: string, table = loadRoutingTable()): ContractRoute {
  const explicit = table.rules.find((r) => r.contract === contract);
  if (explicit) return explicit;
  const fallback = table.rules.find((r) => r.contract === '*');
  if (fallback) return { ...fallback, contract };
  return {
    contract,
    probe: 'structural-deferred',
    verdict: 'AMBER',
    note: 'Unrouted contract — no runtime probe handler',
  };
}

export function buildRoutingCoverage(contracts: string[]): RoutingCoverage[] {
  const table = loadRoutingTable();
  return contracts.map((contract) => {
    const route = routeContract(contract);
    const explicit = table.rules.some((r) => r.contract === contract);
    return {
      contract,
      probe: route.probe,
      routed: explicit,
      verdict: route.verdict,
      note: route.note,
    };
  });
}

export function contractsForProbe(contracts: string[], probeId: string): string[] {
  return contracts.filter((c) => routeContract(c).probe === probeId);
}

export function uniqueProbesForContracts(contracts: string[]): string[] {
  const probes = new Set(contracts.map((c) => routeContract(c).probe));
  return [...probes];
}
