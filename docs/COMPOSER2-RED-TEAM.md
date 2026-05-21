# COMPOSER2 Red Team — BR Runtime Auditor Phase A Brief

**Date:** 2026-05-21  
**Auditor:** Composer2 (pre-build pass)  
**Inputs read:** `COMPOSER2-START-HERE.md`, `docs/00-PHASE-A-BRIEF.md` (frozen copy), `BR-Runtime-Auditor-Parked.md`, IGV runbook, three findings docs §3/§4, BR self-SST, IGV/RoH/NH SSTs, `firebase.json:322-337`, NH dev walkthrough, BR User Guide §3.

---

## Strategic forks for Anthony (decisions required before Stage 2)

1. **Probe 7b vs Hard NO on real Cloud Storage.** Phase A brief §2 defines Probe 7b as a *real* GCS bucket prefix scan (`igv-audio/*`, etc.). `COMPOSER2-START-HERE.md` Hard NO #103 says *"No real Cloud Storage / production deploys triggered from probes. Emulator + harness only."* Tranche A (NHS launch) lists 7b as launch-critical. **Which wins for 2026-05-25 IGV gate?** Options: (a) read-only `gsutil ls` against prod bucket with local ADC creds — launch gate only, documented one-time manual step; (b) re-scope 7b to storage-emulator write-deny (Probe 7a only) for launch, defer bucket scan to manual runbook like Probe 3; (c) hybrid — emulator 7a in Auditor, bucket scan stays in IGV runbook §Check 7 with findings doc update.

2. **AMBER “unrouted contract” noise vs Opus zero-gap gate.** Opus checklist item #1 requires *every* `critical_contracts:` entry across three SSTs to match *exactly one* routing rule — gaps = RED. Simulated coverage against brief §2 seed globs leaves **19/39 contracts unrouted** (see Finding RT-01). First IGV run will emit many AMBERs unless routing table is expanded. **Accept launch with intentional AMBERs on structural-only contracts** (e.g. `region-europe-west2`), or **require full 39/39 routing before any launch report**?

3. **Secret Manager creds for Probe 8 at NHS launch.** Pepper-distinctness needs Secret Manager read in prod; emulator uses `.env` peppers per NH walkthrough §1. Tranche A is Firebase-only (no Probe 8). If Anthony wants pepper check before NH go-live, confirm whether launch scope includes NH Probe 8 or IGV-only Tranche A.

---

## Findings summary

| ID | Severity | Topic |
|---|---|---|
| RT-01 | RED | Routing-table seed globs cover ~51% of critical_contracts; Opus gate requires 100% |
| RT-02 | RED | Probe 7b (real bucket) contradicts Hard NO #103 |
| RT-03 | RED | Auth/db probe inputs not derivable from SST alone — hidden coupling to RoH-App source |
| RT-04 | AMBER | Rate-limit probe requires limit injection strategy (runbook edits source) |
| RT-05 | AMBER | 800 LoC budget vs 10 probes + harness + SST reader — scope pressure |
| RT-06 | AMBER | Brief §5 Phase 1 references “#7 grep” but §2 splits 7a/7b — sequencing ambiguity |
| RT-07 | AMBER | NH auth polymorphism “3+guest” underspecified vs SST (citizen + ftc + guest paths) |
| RT-08 | AMBER | Fail-closed rule names Probes 1/2/4 only; Probes 6/8/9/10 uncalled |
| RT-09 | AMBER | `distinct_secret_pairs:` SST field absent; NH peppers only in env_var_contract |
| RT-10 | AMBER | Multi-codebase emulator URL discovery not specified in brief |
| RT-11 | AMBER | Overlapping glob matches (e.g. NH pepper contracts) — “exactly one rule” needs priority |
| RT-12 | GREEN | Emulator ports locked to firebase.json — no port invention needed |
| RT-13 | GREEN | Postgres harness path documented in NH walkthrough — reusable |
| RT-14 | GREEN | Universal-scope discipline clear; product identity from SST meta |

---

## RT-01 — Routing table coverage gap (RED)

**Evidence:** Enumerated all `critical_contracts:` entries:

- IGV (`packages/functions-igv/SST.md:186-198`): 12 entries — 6 unrouted with expanded seed globs
- RoH (`packages/functions/SST.md:243-256`): 13 entries — 8 unrouted
- NH (`packages/functions-nh/SST.md:324-338`): 14 entries — 4 unrouted

**Unrouted examples (would emit AMBER per brief §2 fallback):**

| Product | Contract | Why unrouted |
|---|---|---|
| IGV | `transcription-only-ai-scope` | No glob; spine id is `igv.transcribe` not `*.classifier` |
| IGV | `three-questions-exact`, `audio-mime-and-size-whitelist`, `region-europe-west2`, `soft-delete-via-excluded-flag`, `no-self-registration` | Structural invariants — no probe category |
| RoH | `HI-no-individual-attribution-T1`, `HI-cross-org-isolation-T2`, `HI-staff-only-read-own-captures-T3` | T1→Probe 10; T2/T3→Probe 2 sub-probes but contract names don't match db-rules globs |
| RoH | `HI-60-second-audio-deletion-T4`, `orgId-derived-server-side`, `audio-mime-*`, `claude-anthropic-only-*`, `region-europe-west2` | No matching glob |
| NH | `Gemini-single-multimodal-call-*`, `claude-anthropic-only-*`, `region-europe-west2` | AI vendor scope — partial overlap with Probe 4 spine globs only |

**Tech lock (applied — no Anthony ping):** Expand `routing-table.yaml` v1 with explicit per-contract globs plus a catch-all:

```yaml
# Priority-ordered: first match wins (resolves RT-11)
rules:
  - glob: "firestore-deny-all-client-reads"
    probe: db-rules-deny
  - glob: "HI-staff-only-read-own-captures-T3"
    probe: db-rules-deny
  - glob: "HI-cross-org-isolation-T2"
    probe: db-rules-deny
  # ... one explicit row per contract name where probe exists ...
  - glob: "region-europe-west2"
    probe: structural-deferred
    verdict: GREEN
    note: "Structural-only — verified by BR audit; no runtime probe"
  - glob: "*"
    probe: structural-deferred
    verdict: AMBER
    note: "Unrouted contract — no runtime probe handler"
```

For Opus gate #1: **every contract must map to exactly one row** — use explicit contract-name rows (39 total) rather than fuzzy globs alone. Fuzzy globs remain for future products.

**Decision recorded:** Build routing table as explicit 39-row seed generated from three SST fixtures at test time; generator script lives in `tests/` not `src/`.

---

## RT-02 — Probe 7b vs Hard NO contradiction (RED)

**Symptom source:** Brief §2 row 7b: *"Real Cloud Storage bucket prefix scan"*. Hard NO #103: *"No real Cloud Storage"*. IGV runbook §Check 7 uses GCP Console / `gsutil ls` on production bucket.

**Root cause:** Parked concept merged manual runbook Check 7 (production inspection) into automated Probe 7b without reconciling launch Hard NOs.

**Proper fix:** Pending Anthony answer on Strategic Fork #1. Interim build plan:

- **If (b) chosen:** Probe 7b emits `DEFERRED — manual runbook §Check 7` (same pattern as Probe 3 egress). Tranche A delivers 7a via storage emulator only.
- **If (a) chosen:** Probe 7b runs only when `--allow-readonly-gcs` flag set; default off; never writes. Document in README as launch-only opt-in.

**Workaround (explicit caveats):** Treat 7b as manual for NHS launch; Tranche A self-tests cover 1/2/6/7a only. Caveat: launch report won't show RUNTIME-VERIFIED for bucket absence unless Anthony runs runbook §Check 7 manually.

---

## RT-03 — SST insufficient for probe execution (RED)

**Gap:** Probes need HTTP paths, rate-limit constants, Firestore collection paths, and seed data — not present in SST YAML blocks.

Examples:

- Auth Probe 1: runbook hardcodes `/igv/engagements`, `/igv/validate-code` — SST `security_layer` cites `igv-app.ts:69` but not routes (`packages/functions-igv/SST.md:74-85`).
- Rate Probe 6: limits at `igv-app.ts:41-45` per findings §3.6 — not in SST.
- DB Probe 2: collection `igv-engagements` in runbook — SST says `firestore.rules:288-293` but not collection name in machine-parseable field.

**Tech lock (applied):** Introduce **`meta.runtime_probe_hints`** as optional SST extension (product SST edits, not BR-the-tool). Shape:

```yaml
meta:
  runtime_probe_hints:
    emulator:
      functions_base_path: "igvApi"  # from firebase.json codebase export name
      region: "europe-west2"
    auth:
      protected_routes:
        - { method: GET, path: "/igv/engagements", middleware: "requireFacilitator" }
      public_rate_limited_routes:
        - { method: POST, path: "/igv/validate-code", limit_const: "PUBLIC_VALIDATE_PER_HOUR", test_override: 5 }
    db_rules:
      firestore_deny_paths: ["igv-engagements/{id}"]
```

Auditor reads hints when present; falls back to spine `producer_file` regex scan (Express `app.get/post` patterns) with AMBER if ambiguous. **First pass for IGV Tranche A:** ship hints in `tests/fixtures/igv/sst-probe-hints.yaml` merged at test time — avoids blocking on RoH-App SST edits before 2026-05-23. Production run uses `--target` repo SST + optional sidecar `sst-probe-hints.yaml` co-located with SST.

**Evidence path:** `packages/functions-igv/src/http/igv-app.ts:41` (rate limits), `:69` (auth), runbook lines 52-67 (routes).

---

## RT-04 — Rate-limit probe needs limit injection (AMBER)

**Symptom:** IGV runbook §Check 6 instructs editing `igv-app.ts:41` to `PUBLIC_VALIDATE_PER_HOUR = 5` — violates unattended probe principle.

**Root cause:** Limits are source constants, not env-configurable.

**Proper fix (tech lock):** Probe harness sets `process.env.BR_RUNTIME_RATE_LIMIT_OVERRIDE=5` only if product code reads it — **it doesn't today**. For Tranche A: harness uses **`--probe-env-json`** injected into Firebase emulator child process via `firebase emulators:exec` wrapper, plus **documented one-shot patch** applied in test fixture copy of constants via dynamic import mock — too heavy.

**Pragmatic lock for Tranche A:** Rate probe parses `producer_file` AST for `const PUBLIC_*_PER_HOUR = N`, temporarily rewrites via emulator hot-reload is impossible. **Use burst count = declared limit + 1 at full declared limit** for RoH (`checkCaptureRateLimit` uses Firestore counter — testable at real limits with 801 requests — slow but correct). For IGV public IP limit (800/hr): **lower limit via `runtime_probe_hints.test_override`** requiring SST hint `test_override: 5` and a **test-only emulator flag** `BR_RUNTIME_LOWER_LIMITS=true` read in platform-lib — **out of scope for Auditor repo**.

**Tranche A decision:** IGV rate probe uses **`runtime_probe_hints` test_override** merged from fixture; documents that production RoH-App must add optional env read in a follow-up ticket OR accept 801-request burst (slow integration test, skipped in CI quick mode).

---

## RT-05 — 800 LoC budget pressure (AMBER)

**Count estimate:** 10 probe stubs × ~40 LoC + harness (~150) + SST reader (~120) + CLI (~80) + report (~60) + routing loader (~40) = **~790 LoC** with zero error handling.

**Tech lock:** Shared `probe-result.ts` types (~30 LoC), one `harness/emulator.ts` (~100 LoC), probes as thin dispatchers. Defer Postgres harness to Tranche B file. Property tests (Probe 10) import constants via SST spine file path grep — no full AST. If over budget: **collapse Probes 7a+7b into `storage-probe.ts`**, Probes 8+9 into `secrets-lifecycle-probe.ts`.

---

## RT-06 — Probe 7 numbering inconsistency (AMBER)

Brief §5 Phase 1: *"#7 (sensitive-data-absent grep)"* — §2 splits **7a** (storage-rules-deny) and **7b** (bucket scan). Phase 2 doesn't list 7a.

**Tech lock:** Phase 1 static = Probes 4, 5, 8. Phase 2 emulator = 1, 2, 6, **7a**. Phase 5 deferred = 3, **7b** (if real bucket) or manual. Update internal sequencing doc in `docs/CHANGELOG.md` at Tranche A start — no brief edit (frozen).

---

## RT-07 — NH auth polymorphism underspecified (AMBER)

Brief §2: *"NH 3+guest"*. SST documents `nh-citizen-auth`, `nh-ftc-auth`, plus guest paths (`nh-campaign-guest-join`, `nh-upgrade-guest`) per `packages/functions-nh/SST.md:740` footnote.

**Tech lock:** Auth probe sizes sub-probes from `security_layer` entries where `layer: auth-middleware` (count = 2 for NH) **plus** one guest-path probe (unauthenticated access to protected citizen route must fail). Total NH auth sub-probes = 3 middleware gates + 1 guest boundary = 4, not 3.

---

## RT-08 — Fail-closed coverage incomplete (AMBER)

Brief §2 mandates fail-closed for dependency failure on Probes 1, 2, 4 minimum. Probes 6 (rate limit + Firestore), 8 (Secret Manager), 9 (Postgres+Firestore) have similar failure modes.

**Tech lock:** Implement fail-closed sub-test for Probes 1, 2, 4 in Tranche A/B as brief requires. Probes 6, 8, 9 get fail-closed in Tranche B when harness exists. Probe 10 (property test) fails CLOSED if constants file unreadable.

---

## RT-09 — `distinct_secret_pairs` absent from SST (AMBER)

Brief §2 Probe 8 references explicit `distinct_secret_pairs:` in SST. NH SST uses `env_var_contract` descriptions only (`NH_REGISTRATION_PEPPER`, `NH_RECORDING_PEPPER` at `packages/functions-nh/SST.md:22-48`).

**Tech lock:** Probe 8 derives pairs from `env_var_contract` entries whose descriptions contain *"MUST be a DIFFERENT value"* or matching `*_PEPPER` suffix pairs declared in same SST. No `distinct_secret_pairs` field required for v1. If zero pairs inferred → GREEN *"no distinct-secret invariant declared"* per brief.

---

## RT-10 — Multi-codebase emulator URLs (AMBER)

RoH-App has three function codebases (`firebase.json:12,23,34`). Emulator URL pattern: `http://127.0.0.1:5001/{projectId}/{region}/{exportName}/...`.

**Tech lock:** CLI reads `firebase.json` from `--repo-root` (walk up from SST path). Maps SST deploy-unit path → codebase name → exported function name from `src/index.ts` export scan or `runtime_probe_hints.emulator.functions_base_path`. Default region `europe-west2` from SST `critical_contracts` entry or hint.

---

## RT-11 — Overlapping glob matches (AMBER)

NH contracts `HI-distinct-peppers-*` and `pepper-secrets-via-Secret-Manager-*` both match `*pepper*`.

**Tech lock:** Routing table ordered **most-specific first** (full contract name rows before wildcards). Opus test #1 satisfied by explicit 39-row table (RT-01).

---

## RT-12 — Emulator ports (GREEN)

`firebase.json:322-337` — auth 9099, functions 5001, firestore 8080, storage 9199. Brief §3 locked. No action.

---

## RT-13 — Postgres harness (GREEN)

`NH-DEV-TEST-WALKTHROUGH.md` documents `pnpm run nh:local-pg:up`, `NH_DATABASE_URL`, pepper env vars. Tranche B harness wraps same commands. No action for Tranche A.

---

## RT-14 — Universal scope (GREEN)

No product strings in planned `src/`. Product name from SST `meta` / spine header. Harness plug-in interface: `HarnessPlugin { boot(), teardown(), id }` with factory `loadHarness(sst)`. Firebase + Postgres implementations only in Tranche A/B scope.

---

## Edge cases the brief misses

1. **Emulator already running:** CLI must detect ports in use — attach vs fail with clear message (runbook line 39).
2. **MCP 45s timeout:** Brief §3 documents report-file read pattern — CLI must always flush report to disk before exit even on timeout.
3. **Cross-tenant auth Probe C:** Requires seed engagements in Firestore emulator — harness must run Admin SDK seed script; not documented in brief.
4. **Idempotency modulo list:** Brief §8.5 includes UUID in evidence paths — report emitter must use deterministic fixture IDs in test mode (`BR_RUNTIME_DETERMINISTIC=1`).
5. **IGV findings §3.7 vs Probe 7:** Findings mention *"audio retention lifecycle"* (IaC rules); brief Probe 7b is *prefix empty scan* — different shapes. Route `HI-GDPR-no-audio-persistence` to 7b; lifecycle rules remain manual/deferred.
6. **RoH Probe 4 polymorphism:** Three AI surfaces (classifier, lean enricher, coach routing) — golden files need per-spine-id fixture paths under `tests/fixtures/roh/golden-prompts/`.
7. **NH Probe 9 E2E:** Requires Postgres + Firestore + Auth — longest Tranche B probe; budget 150 LoC cap or split to integration test only.

---

## Contradictions resolved (tech calls)

| Conflict | Resolution |
|---|---|
| Parked doc per-product YAML vs brief routing-table | routing-table.yaml + optional probe hints sidecar wins |
| Runbook 7 categories vs brief 10 probes | 10 probes supersede; runbook maps to subset |
| Findings N=10000 vs brief N=100k for CSPRNG | Brief N=100k wins (`Phase A §2 row 5`) |
| IGV runbook Check 3 deferred vs brief Phase 5 | Probe 3 always DEFERRED with visible header status |

---

## Stage 2 entry criteria

- [x] Red Team recorded in this file  
- [x] Anthony answers Strategic Forks #1–#3 (recorded 2026-05-21):
  - **Fork #1:** Option (c) HYBRID — Probe 7a (`storage-rules-deny`) in Auditor; real-bucket prefix scan stays in IGV manual runbook §Check 7 as one-time pre-launch check before 2026-05-25. Launch report header shows deferral visibly.
  - **Fork #2:** Explicit per-contract routing rows; `structural-deferred` → GREEN for non-runtime contracts; AMBER reserved for genuinely unrouted contracts.
  - **Fork #3:** IGV-only Tranche A is 2026-05-25 NHS launch gate; NH Probe 8 (pepper-distinctness) ships Tranche B.
- [x] `docs/00-PHASE-A-BRIEF.md` frozen copy present  

**Build path locked:** Tranche A delivers probes 1, 2, 6, 7a + 7b DEFERRED header; not 7b automated.

---

## Recommended build order (Stage 2)

1. Repo scaffold (pnpm, vitest, eslint, tsconfig)  
2. `sst-reader.ts` + routing-table.yaml (39 explicit rows from fixtures)  
3. `report-emit.ts` + `cli.ts` skeleton  
4. Harness: Firebase emulator boot/health  
5. Tranche A probes: 1, 2, 6, 7a (+ 7b DEFERRED unless fork #1 = a)  
6. Integration tests against `tests/fixtures/igv/` with merged probe hints  
7. Tranche B: remaining probes + Postgres harness + network mock  

---

*End of Red Team pass. Stage 1 complete.*
