---
project_id: "BR-Runtime-Auditor"
phase: A (brief authoring — Cowork, this session)
status: DRAFT — ready for Composer2 dispatch on Anthony sign-off
date: 2026-05-21
prior_work:
  - "[[BR-Runtime-Auditor-Parked]] — concept + S02 + S03 learnings"
  - "[[2026-05-21 - RoH NH BR Audits Complete + Auditor Build Roadmap]] — handover §7"
  - "S01/S02/S03 findings docs — first test fixture set"
linked: [[Blast-Radius-System-PT]]
tags: [br-runtime-skill, phase-a-brief, nhs-launch-load-bearing]
---

# BR Runtime Auditor — Phase A Brief (Composer2 dispatch package)

**Mission:** Build a reusable runtime-behaviour verification Auditor that closes the HI-4 source-vs-runtime boundary BR explicitly does not cover (User Guide §3, lines 44-62). Inputs an SST.md; emits GREEN/AMBER/RED per probe category with file-line citations. First run target: **IGV before 2026-05-25** (NHS launch deadline).

**Build owner:** Composer2 (Cursor). **Audit owner:** Opus-in-Cursor. **This brief authored by:** Cowork orchestrator (Anthony's brief author).

## 1. Why this exists (1 paragraph)

BR scans source structure. It cannot run the code. The three product audits (S01 IGV, S02 RoH, S03 NH) all went FULL GREEN structurally yet surfaced runtime invariants BR could not verify: auth gates rejecting unauth requests, db-rules actually denying client reads, AI prompts pinned at temperature 0.0, rate-limits triggering, peppers actually distinct, account-deletion preserving Layer 2/4. The Auditor is the second-layer verifier. It reads the SST and routes each `critical_contracts:` entry to a probe handler that exercises the deployed-equivalent behaviour against a Firebase emulator (IGV, RoH) or a Postgres Docker harness (NH).

## 2. Probe inventory — 10 categories

Seven universal + three NH-surfaced new classes. Each category specifies: SHAPE / POLYMORPHISM / SST CONFIG SOURCE.

| # | Category | Shape | Polymorphism axis | SST config source |
|---|---|---|---|---|
| 1 | Auth-gate-rejects | Emulator burst: no-token / bad-claim / wrong-org → expect 401/403/404 | N sub-probes sized to role count (IGV 2, RoH 3, NH 3+guest) | `meta.security_layer[]` where `layer: auth-middleware` |
| 2 | DB-rules-deny | Direct client-SDK read → expect `permission-denied` | Firestore (IGV/RoH) vs Postgres prepared-statement DAL (NH) | `meta.security_layer[]` where `layer: db-rules`; spine entries `*.dal*` |
| 3 | Egress-allow-list | Compare deployed function reachable hosts vs APPROVED-ENDPOINTS | None (universal) | `external_dependencies[]` |
| 4 | AI-prompt-pinned | (a) Read provider helper, assert verbatim base instruction + `temperature: 0.0`. (b) For any prompt assembled at runtime from variables (e.g. RoH multi-stage Sonnet+Opus routing), log final assembled prompt to fixture and compare to a golden file | N sub-probes sized to AI surface count (IGV 1, RoH 3, NH 3+) | Spine ids matching `*.classifier`, `*.enricher`, `*.routing`, `*.transcribe`, `*.llm_*_prompt` |
| 5 | CSPRNG-strength | Generate N=100k tokens, assert uniformity + zero collisions | Per token-generator (IGV access-code; NH magic-link; etc.) | Spine ids matching `*.access_code`, `*.magic_link`, `*.token_*` |
| 6 | Rate-limit-triggers | Emulator burst N+1 requests at lowered threshold → expect 429 | Per rate-limited route family | `critical_contracts:` entries matching `*rate-limit*`; or routes annotated with `checkCaptureRateLimit`/equivalents |
| 7a | Storage-rules-deny | Storage emulator: client-SDK write to audio path → expect `permission-denied` (mirrors Firestore deny-rules) | Per audio-bearing product (IGV, RoH, NH) | `storage.rules` deny blocks; security_layer entries `*-storage-*` |
| 7b | Real-bucket-audio-absence | Real Cloud Storage bucket prefix scan: assert `igv-audio/*`, `roh-audio/*`, `nh-audio/*` prefixes empty | Per data class | `critical_contracts:` matching `*no-cloud-storage-*`, `*no-PII-in-*` |
| 8 | Pepper-distinctness (NEW S03) | Read each declared distinct-secret pair via Secret Manager API; assert `≠`. If product declares no such pair, emit GREEN with "no distinct-secret invariant declared" — not silent no-op | NH has 1 declared pair (`NH_REGISTRATION_PEPPER` ≠ `NH_RECORDING_PEPPER`); IGV/RoH currently declare none; generic shape "two-secrets-must-differ" extensible | Spine ids matching `*.hash_service`, `*.pepper_*`; security_layer where `layer: pepper-hash-identifier`; explicit `distinct_secret_pairs:` list in SST when present |
| 9 | Account-deletion-polymorphism (NEW S03) | E2E: register → submit → delete → confirm Layer 1 gone, Layer 2/4 anonymised intact | NH-specific cross-DB (Postgres + Firestore); IGV/RoH have no analogous shape | `critical_contracts:` entries matching `*account-deletion-*`, `*Layer1-only*` |
| 10 | Privacy-threshold-floors (NEW S03, generalises RoH) | Property test sweeping group sizes ±2 around each threshold; assert sub-threshold never surfaces | RoH has 1 (`DEFAULT_MINIMUM_AGGREGATION=5`); NH has 3 (`MIN_RECORDINGS_FOR_AGGREGATION=10`, `MIN_RECORDINGS_FOR_COMMISSION=20`, `DEFAULT_K_ANONYMITY=5`); IGV has 0 | Spine entries `*.shared_constants`/`*.shared_nh_constants` exporting `MIN_*` / `*_K_ANONYMITY` |

**Routing table contract (load-bearing):** the Auditor enumerates the SST's `critical_contracts:` list, matches each entry name against a glob in a config-driven routing table, and dispatches to the matching probe handler. Glob patterns above are the v1 routing-table seed; add a `routing-table.yaml` co-located with the Auditor so future products can extend without code change. **Fallback rule (mandatory):** any `critical_contracts:` entry that matches zero globs → emit AMBER "unrouted contract" with the entry name in evidence. Never silently pass an unrouted contract. Opus audit (§8.1) verifies zero unrouted entries across IGV/RoH/NH on first run.

**Fail-closed cross-cutting rule (mandatory):** every probe category MUST also verify fail-closed behaviour — when the underlying dependency is unreachable (provider stub returns error, DB connection refused, Secret Manager 503), the function returns a non-2xx status, not 200 with empty data. Minimum coverage: Probe 1 (auth dependency unreachable → expect 503), Probe 2 (DB unreachable → expect 503), Probe 4 (AI provider unreachable → expect 503 or queued-retry, NOT silent empty response).

## 3. Architecture decisions (locked — do not re-litigate)

| Decision | Locked value | Reason |
|---|---|---|
| Skill shape | Standalone Auditor adjacent to BR (not a BR extension) | BR is in v1.0 maintenance per Element 27; Auditor reads SST.md as input contract only |
| Orchestrator pattern | Cowork brief author → Composer2 builder → Opus auditor — same as BR | §16, §17, §19, lean discipline reused |
| Firebase emulator | auth (9099), firestore (8080), functions (5001), storage (9199) — already declared at `firebase.json:322-337` | Don't invent ports; use what exists |
| Postgres harness | Docker per `nh-build-files/NH-DEV-TEST-WALKTHROUGH.md` | Reuse NH dev path; don't fork |
| Vertex AI + Anthropic calls | Stubbed during probe runs (intercept at provider layer) | Probes 1/2/4/6 don't need real AI; saves cost + avoids non-determinism |
| Secret Manager access | Read-only client with explicit scope; ENV-injected creds for local | Pepper-distinctness probe (cat #8) is the only consumer |
| Config source | SST.md `meta.*` + `critical_contracts:` + spine-id glob patterns | One source of truth per product; routing table provides the dispatch layer |
| Output shape | Per-probe verdict (GREEN/AMBER/RED) + file-line citation + replicable command/code path | Mirrors BR audit report shape (consistency = lower cognitive load) |
| File emission | `<deploy-unit>/br-runtime-report.md` NOT tracked in git; `br-runtime-findings-YYYY-MM-DD.md` IS tracked | Mirrors BR pattern (S02+S03 confirmed) |
| MCP timeout handling | If invoked via MCP, 45s timeout class is expected; subprocess still writes the report — read the file, don't retry | Documented IGV S01 pattern |

## 4. Per-product config inputs (read order)

1. SST.md (deploy-unit root) — spine, `meta.*`, `critical_contracts:`, `external_dependencies:`
2. `firebase.json` (monorepo root) — codebase routing, emulator ports, hosting CSP/Permissions-Policy
3. `firestore.rules` / `storage.rules` (monorepo root) — declared rules text (reference; runtime is the actual test)
4. `.env.example` (monorepo root) — env var producer signal
5. `routing-table.yaml` (Auditor-internal) — contract-name-glob → probe-handler dispatch
6. Findings docs (`br-audit-findings-YYYY-MM-DD.md`) — pre-computed HI-4 gap inventory; first test fixture set

## 5. Probe execution sequencing per run

Phase 1 — read-only static probes (no harness needed): #4 (prompt-pin), #5 (CSPRNG), #7 (sensitive-data-absent grep), #8 (pepper-distinctness if Secret Manager creds available).

Phase 2 — emulator-bound probes: #1 (auth), #2 (db-rules-deny Firestore variant), #6 (rate-limit).

Phase 3 — Postgres-harness probes (NH only): #2 (db-rules-deny Postgres variant), #9 (account-deletion E2E across Postgres+Firestore).

Phase 4 — property tests: #10 (privacy-threshold-floors).

Phase 5 — external/deferred: #3 (egress allow-list — needs deployed function + VPC introspection; defer post-launch with manual fallback per IGV S01 runbook).

Each phase is independent and can short-circuit on early RED for blast-radius load-bearing categories (#1, #2, #8, #10).

## 6. Output shape (per run)

Single Markdown file `br-runtime-report.md` at the deploy-unit root. Header: product name, run timestamp, Auditor version, SST version. Body: one section per probe category, each section emits:

- Verdict (GREEN/AMBER/RED).
- Sub-probe results table (where polymorphic — auth, db-rules, prompt-pin, threshold).
- Replicable command or code path (so a human can re-run any single probe in <5 min — IGV runbook precedent).
- File-line citations for assertion evidence.

Companion analyst doc (tracked in git): `br-runtime-findings-YYYY-MM-DD.md` — same shape as the BR findings docs (lock options on AMBER/RED, drift commentary).

## 7. Phase B build sequencing (Composer2 dispatch package)

Composer2 brief inputs (deliver as one bundle):

1. This brief (file path above).
2. BR-Runtime-Auditor-Parked.md (full, including S02+S03 addendums) — `C:\Users\Antho\FitToCareBrain\07-Products\BR-Runtime-Auditor-Parked.md`.
3. IGV manual runbook as concrete behaviour reference — `C:\Users\Antho\RoH-App\packages\functions-igv\br-runtime-checks-runbook.md`.
4. Three findings docs §3/§4 as test fixture seed.
5. BR self-SST as schema reference — `C:\Users\Antho\Blast Radius System\SST.md`.

Composer2 deliverable shape (Cursor session):

- Repo location: `C:\Users\Antho\BR-Runtime-Auditor\` — new standalone repo, sibling to `Blast Radius System` and `RoH-App`. Rationale: BR stays in v1.0 maintenance posture per Element 27; the Auditor is a downstream consumer of BR's SST schema, not a BR feature; standalone repo = clean Cursor workspace and future portability to product platforms beyond RoH-App.
- README.md + LICENSE (standard TypeScript repo conventions).
- `harness/` — emulator-boot helpers, Postgres-docker-boot helper, secret-manager-readonly client.
- `probes/` — 10 probe modules (one per category). Each exports a single `run(sst, ctx)` function returning `{ verdict, subProbes[], evidence[] }`.
- `routing-table.yaml` — glob → probe-module dispatch with the seed table from §2.
- `report-emit.ts` — Markdown emitter mirroring BR report shape.
- `cli.ts` — entry point: `br-runtime <sst-path>` with `--probe=<id>` filter and `--emulator-only` / `--with-postgres` flags.
- Test fixtures: snapshots of the three findings-doc §3/§4 tables as expected-output goldens for the first Auditor run.

Lean discipline: ≤800 LoC across the Auditor (mid-size bucket), ≤200-line build brief per Anthony's §19 discipline. Composer2 self-tests included but Phase C Opus audit is the gate.

## 8. Phase C audit asks (Opus-in-Cursor dispatch package)

Independent verification (S17 precedent — Composer2 self-tests don't catch certain regression classes):

1. Routing table glob coverage — every `critical_contracts:` entry across IGV/RoH/NH SSTs must match exactly one routing rule. Gaps = RED.
2. Polymorphism handling — auth probe (cat #1) must size sub-probes correctly for each of the three role-count cases.
3. Stub integrity — confirm zero real Vertex AI / Anthropic calls during a full probe run (assertion via network mock layer or recorded fetch log).
4. Phase 5 deferral — egress probe (cat #3) MUST surface as "deferred — see IGV S01 runbook §Check 3" rather than silently passing.
5. Idempotency — running the Auditor twice against the same SST produces byte-identical reports modulo: run timestamp, emulator-assigned ports, ephemeral container IDs, and any U