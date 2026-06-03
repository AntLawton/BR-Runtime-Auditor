# Opus Audit Prompt — BR Runtime Auditor Tranche B

**Audit target:** branch `feature/tranche-b-probes` (after Composer2 Tranche B complete + **2026-06-03 Opus fix-round**)  
**Repo:** `AntLawton/BR-Runtime-Auditor`  
**Gate:** Independent audit before Anthony runs full three-product calibration.

Opus MUST diff against the Tranche B PR branch. Do not audit uncommitted working-tree changes unless Anthony expands scope.

**Fix-round note (2026-06-03):** Composer2 addressed RED-1 (privacy probe tautology), golden compare, egress visibility, idempotency digest, `--mock` fetch, format, and NH token cleanup per `docs/OPUS-AUDIT-2026-06-03.md`. Re-audit items 3–6 before merge.

---

You are Opus-in-Cursor running an independent audit on the BR Runtime Auditor **Tranche B** build. Composer2 has finished B1 (+ B2 skeleton); this is the gate before portfolio-wide runtime verification.

## Context (locked)

1. **Universal tool** — zero product names in `src/`; IGV/RoH/NH exist only under `tests/fixtures/`.
2. **Tranche A unchanged** — probes 1, 2, 6, 7a remain; 7b and egress stay DEFERRED/manual.
3. **LoC budget** — Tranche A ~938 LoC; B1 ≤550 new; B2 ≤400 new; total `src/` cap 1,900 (see `docs/COMPOSER2-RED-TEAM.md` Tranche B section).

## Audit checklist (Tranche B brief + Red Team TB-*)

1. **Routing coverage** — every `critical_contracts:` entry across all three product SST fixtures matches **exactly one** routing rule. Any unrouted entry = **RED**. Self-test: `tests/unit/sst-reader.test.ts` asserts 39/39.
2. **Stub integrity** — confirm **zero** real Vertex AI / Anthropic calls during a full probe run (network-mock log assertion). Load-bearing for probe #4.
3. **Pepper / threshold correctness** — probe #8 emits GREEN-with-note (not silent pass) when no distinct-secret pair is declared; probe #10 catches a deliberately seeded sub-threshold leak in unit tests (`privacy-floor` + fixture sweep).
4. **Polymorphism** — probes size sub-probes from SST spine + hints (no hardcoded product branches); NH has 3 thresholds, RoH 1, IGV 0.
5. **Idempotency** — two runs against the same SST produce byte-identical reports modulo timestamp, emulator ports, container IDs (`BR_RUNTIME_DETERMINISTIC=1`).
6. **Egress + manual-deferral integrity** — probe #3 surfaces as **DEFERRED** (manual runbook §Check 3), never silently GREEN.

## Verification commands

```powershell
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm format
rg "IGV|RoH|\bNH\b" src/
```

## Key files

| File | Purpose |
|---|---|
| `docs/COMPOSER2-RED-TEAM.md` | Tranche B red-team (2026-06-03) |
| `src/probes/ai-prompt-probe.ts` | Probe #4 |
| `src/probes/csprng-probe.ts` | Probe #5 |
| `src/probes/pepper-probe.ts` | Probe #8 |
| `src/probes/privacy-threshold-probe.ts` | Probe #10 |
| `src/harness/network-mock.ts` | Provider-layer intercept |
| `src/harness/secret-manager.ts` | Read-only secret plug-in |
| `src/routing-table.yaml` | 39+ contract dispatch |
| `tests/unit/tranche-b-probes.test.ts` | B1 mock-mode self-tests |

## Report shape

Single-line verdict (**READY** / **N FIXES** / **REWORK**) + numbered issues with severity + recommendation.
