import type { DistinctSecretPair, ParsedSst } from './types/sst.js';

const PEPPER_NAME_RE = /[A-Z][A-Z0-9_]*_PEPPER/g;

export function inferDistinctSecretPairs(sst: ParsedSst): DistinctSecretPair[] {
  const explicit = sst.runtimeProbeHints.distinct_secret_pairs ?? [];
  if (explicit.length) return explicit;

  const pepperVars = sst.envVarContract.filter((e) => e.name.includes('_PEPPER'));
  const pairs: DistinctSecretPair[] = [];
  const seen = new Set<string>();

  for (const entry of sst.envVarContract) {
    const desc = entry.description ?? '';
    if (!/DIFFERENT value|Distinct from/i.test(desc)) continue;
    const mentioned = [...desc.matchAll(PEPPER_NAME_RE)].map((m) => m[0]);
    const others = pepperVars.map((p) => p.name).filter((n) => n !== entry.name);
    for (const other of others) {
      if (mentioned.includes(other) || desc.includes(other)) {
        const key = [entry.name, other].sort().join('|');
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push({ a: entry.name, b: other });
        }
      }
    }
  }

  if (pairs.length === 0 && pepperVars.length >= 2) {
    const registration = pepperVars.find((p) => /REGISTRATION/i.test(p.name));
    const recording = pepperVars.find((p) => /RECORDING/i.test(p.name));
    if (registration && recording) {
      pairs.push({ a: registration.name, b: recording.name });
    }
  }

  return pairs;
}
