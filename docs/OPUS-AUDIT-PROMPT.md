# Opus Audit Prompt — BR Runtime Auditor Tranche A

**Audit target commit (Tranche A):** `fb57677` — branch `feature/tranche-a-build`  
**Repo:** `AntLawton/BR-Runtime-Auditor`  
**Gate:** Independent audit before Anthony runs the Auditor against IGV for NHS launch (2026-05-25).

Opus MUST check out or diff against commit `fb57677` exactly. Do not audit uncommitted working-tree changes or later commits unless Anthony explicitly expands scope.

---

You are Opus-in-Cursor running an independent audit on the BR Runtime Auditor build. Composer2 has finished Tranche A; this is the gate before Anthony runs the Auditor against IGV for NHS launch.

## Context (Anthony fork decisions — locked)

1. **Probe 7b HYBRID:** Auditor delivers Probe 7a (`storage-rules-deny` via emulator) only. Real Cloud Storage bucket prefix scan is **DEFERRED** to the product manual runbook §Check 7 (one-time pre-launch before 2026-05-25). Launch report header must show this deferral visibly.
2. **Routing:** Explicit per-contract rows in `src/routing-table.yaml`; `structural-deferred` → GREEN for non-runtime contracts; AMBER only for genuinely unrouted contracts.
3. **Scope:** Tranche A = IGV NHS launch gate (probes 1, 2, 6, 7a). NH Probe 8 (pepper-distinctness) is Tranche B.

## Audit checklist (Phase A brief §8 + Red Team findings)

1. **Routing table coverage** — every `critical_contracts:` entry across IGV/RoH/NH SST fixtures matches exactly one routing rule. Gaps = RED. Self-test: `tests/unit/sst-reader.test.ts` asserts 39/39.
2. **Polymorphism handling** — auth probe sub-probes correctly sized for each of three role-count cases (IGV 2, RoH 3, NH 3+guest). Tranche A implements IGV path only; RoH/NH auth deferred to Tranche B must not silently pass.
3. **Stub integrity** — confirm zero real Vertex AI / Anthropic calls during a full probe run. Verify via fetch-log recorded during integration tests (mock mode acceptable for Tranche A CI).
4. **Egress probe (Probe 3)** — MUST surface as "DEFERRED — manual runbook §Check 3" not silently pass. Launch report header MUST show DEFERRED status visibly for Probe 7b per fork #1.
5. **Idempotency** — running the Auditor twice against the same SST produces byte-identical reports modulo: run timestamp, emulator port, container ID, UUID in evidence paths (`BR_RUNTIME_DETERMINISTIC=1` supported).
6. **Findings-doc parity** — first IGV run reproduces S01 findings §3 entries 1, 2, 6 as RUNTIME-VERIFIED; entry 7b as DEFERRED with runbook pointer (not automated).
7. **Universal-scope discipline** — zero product-specific strings in `src/` (grep `IGV`, `RoH`, `NH`). `tests/fixtures/` excluded.
8. **Fail-closed coverage** — Probes 1, 2 verify non-2xx response on dependency failure (Probe 4 fail-closed is Tranche B).
9. **§16 + §17 discipline** — confirm no Anthony-pings for tech calls; all decisions logged inline in `docs/COMPOSER2-RED-TEAM.md`.

## Verification commands (run at commit `fb57677`)

```powershell
git checkout fb57677
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm format
rg "IGV|RoH|\bNH\b" src/
```

## Key files to read

| File | Purpose |
|---|---|
| `docs/00-PHASE-A-BRIEF.md` | Frozen Phase A contract |
| `docs/COMPOSER2-RED-TEAM.md` | Stage 1 findings + fork decisions |
| `src/routing-table.yaml` | 39-contract dispatch table |
| `src/probes/` | Tranche A probe handlers |
| `tests/integration/tranche-a-igv.test.ts` | Mock emulator integration |
| `tests/fixtures/igv/sst-probe-hints.yaml` | Copy-ready sidecar for RoH-App |

## Report shape

Single-line verdict (**READY** / **N FIXES** / **REWORK**) + numbered issues with severity + recommendation.
