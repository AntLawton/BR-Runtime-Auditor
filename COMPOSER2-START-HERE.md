# COMPOSER2 — Build BR Runtime Auditor (START HERE)

You are Composer2 in Cursor. Build a standalone TypeScript project: **BR Runtime Auditor** — a universal runtime-behaviour verification tool that closes the HI-4 source-vs-runtime boundary Blast Radius (BR) explicitly does not cover.

Open at: `C:\Users\Antho\BR-Runtime-Auditor` (this repo). Anthony Lawton owns this work. **NHS launch window opens 2026-05-25** — IGV runtime verification (probes 1, 2, 6, 7b) must complete before then.

---

## Three stages — strict order

Run each to completion. Do NOT skip Stage 1.

### Stage 1 — Red Team the brief BEFORE coding

Read the Phase A brief and all reference docs listed below. Then run YOUR OWN audit pass against the brief. Look for: gaps in probe coverage, contradictions in architecture decisions, hidden assumptions, edge cases the brief misses, places where you'd otherwise have to invent a missing decision.

Write findings to `docs/COMPOSER2-RED-TEAM.md` in this repo. Severity GREEN/AMBER/RED per finding. **Apply tech-call fixes inline** — do not ping Anthony for permission on technical decisions (§16, see Disciplines). **Surface strategic forks only** — anything affecting product surface area, scope, cost, or external dependencies gets a numbered question for Anthony at the top of the doc.

Do not begin Stage 2 until your Red Team pass is recorded.

### Stage 2 — Build the Auditor

Follow the brief. Deliver in two tranches:

- **Tranche A (NHS-launch critical, target completion 2026-05-23):** Probes 1 (auth-gate-rejects), 2 (DB-rules-deny — Firestore variant), 6 (rate-limit-triggers), 7b (real-bucket audio-absence). Firebase emulator harness only. End-to-end runnable against IGV. Self-tests passing.
- **Tranche B (full, target completion 2026-05-24):** Probes 3, 4, 5, 7a, 8, 9, 10. Postgres Docker harness. Network-mock layer for Vertex AI + Anthropic. Routing-table.yaml driver. Full SST schema reader.

Both tranches: file-line-anchored citations in every probe output; report shape mirrors BR's audit report format.

### Stage 3 — Prepare Opus handoff

After Stage 2 self-tests pass, write `docs/OPUS-AUDIT-PROMPT.md` (template at end of this file) and notify Anthony the build is ready for independent audit.

---

## Universal scope — non-negotiable

The Auditor is universal. It must work on **any product with an SST.md**, not just RoH-App's three. Concretely:

- **Zero product-specific names in source.** No `IGV`, `RoH`, `NH` strings except in `tests/fixtures/`. Product identity comes from SST `meta.product_name` or equivalent — not from hardcoded cases.
- **Stack-agnostic harness plug-ins.** Implement Firebase + Postgres harnesses now (sufficient for IGV/RoH/NH). Architect harness-loading as a plug-in pattern (interface + factory) so future stacks (AWS Lambda, GCP Cloud Run, Supabase, etc.) slot in without touching probe code.
- **Probe handlers configured via SST + routing-table.yaml.** Not via hardcoded product branches.

If you find yourself writing `if (product === 'IGV')` anywhere in src, stop and re-design.

---

## Disciplines (Anthony's working rules — non-negotiable)

- **§16 NO TECH QS TO ANTHONY.** Anthony is strategic, not technical. Lock every technical decision inline with reasoning + evidence + recorded decision in the relevant file or in `docs/COMPOSER2-RED-TEAM.md`. Strategic forks only escalate.
- **§17 NO QUICK FIX.** On any bug or design issue, deliver three messages: (1) root cause, (2) proper fix, (3) optional workaround with explicit caveats. No silent hacks.
- **Lean discipline.** Code budget ≤800 LoC across `src/`. Push back if a probe requires more — re-scope rather than balloon.
- **File-path-anchored references.** Every claim, every test fixture, every report citation must cite `path/to/file:line`.
- **Single-line verdict on report-back.** When done, report shape: ONE LINE verdict + ONE LINE recommendation + GO-or-ASK.
- **Plain English when reporting to Anthony.** Strip jargon. No probe IDs in user-facing reports without a one-sentence English meaning. Anthony's UX: ONE link, not commands.

---

## Reference docs (read in order — absolute paths)

1. **Phase A brief (primary contract):** `C:\Users\Antho\FitToCareBrain\07-Products\BR-Runtime-Auditor-Phase-A-Brief.md`
2. **Parked concept (context + S02/S03 learnings):** `C:\Users\Antho\FitToCareBrain\07-Products\BR-Runtime-Auditor-Parked.md`
3. **IGV manual runbook (concrete probe-behaviour reference):** `C:\Users\Antho\RoH-App\packages\functions-igv\br-runtime-checks-runbook.md`
4. **Three findings docs (test fixture seed + HI-4 gap inventory):**
   - `C:\Users\Antho\RoH-App\packages\functions-igv\br-audit-findings-2026-05-20.md` (IGV §3)
   - `C:\Users\Antho\RoH-App\packages\functions\br-audit-findings-2026-05-21.md` (RoH §3)
   - `C:\Users\Antho\RoH-App\packages\functions-nh\br-audit-findings-2026-05-21.md` (NH §4)
5. **BR self-SST (schema reference for SST.md parsing):** `C:\Users\Antho\Blast Radius System\SST.md`
6. **Three product SSTs (test fixtures + first-run targets):**
   - `C:\Users\Antho\RoH-App\packages\functions-igv\SST.md`
   - `C:\Users\Antho\RoH-App\packages\functions\SST.md`
   - `C:\Users\Antho\RoH-App\packages\functions-nh\SST.md`
7. **Firebase emulator config (port references):** `C:\Users\Antho\RoH-App\firebase.json` lines 322-337
8. **NH dev/test walkthrough (Postgres Docker harness reference):** `C:\Users\Antho\RoH-App\nh-build-files\NH-DEV-TEST-WALKTHROUGH.md`
9. **BR User Guide §3 (HI-4 boundary — the Auditor's reason to exist):** `C:\Users\Antho\FitToCareBrain\07-Products\BR-User-Guide-for-New-Agents.md` lines 44-62

After reading, copy the Phase A brief into `docs/00-PHASE-A-BRIEF.md` (frozen for audit traceability).

---

## Tech-call locks (do not re-litigate)

- Language: **TypeScript** (matches BR + RoH-App stack).
- Package manager: **pnpm**.
- Test framework: **vitest**.
- CLI runtime: **Node 20** (matches Firebase Functions runtime).
- Linting: **eslint + prettier** with strict TS settings.
- Lockfile: commit `pnpm-lock.yaml`.
- Report output: `br-runtime-report.md` written to target deploy-unit root — NOT git-tracked (add to `.gitignore` of target by convention).
- Findings output: `br-runtime-findings-YYYY-MM-DD.md` — analyst supplement, IS git-tracked when generated.

---

## Hard NOs

- No real Vertex AI / Anthropic API calls during probe runs. Stub at provider layer. Cost across all probe runs = zero.
- No hardcoded product strings in source (`tests/fixtures/` excepted).
- No commits without `pnpm test` green.
- No silent unrouted-contracts. Routing-table fallback rule (per brief §2) is mandatory: unmatched entries emit AMBER "unrouted contract".
- No silent fail-open passes. Every probe verifies non-2xx response on dependency failure (per brief §3 fail-closed rule).
- No BR-the-tool changes. BR is v1.0 maintenance. Read-only consumer of BR's SST schema.
- No real Cloud Storage / production deploys triggered from probes. Emulator + harness only.

---

## Final deliverable shape (after Tranche B)

```
BR-Runtime-Auditor/
├── README.md                       # what it is, install, run, link to brief
├── LICENSE
├── package.json, pnpm-lock.yaml, tsconfig.json, eslint.config.js, .prettierrc, .gitignore
├── src/
│   ├── cli.ts                      # br-runtime <sst-path> [--target=<repo>] [--probe=<id>] [--emulator-only] [--with-postgres]
│   ├── sst-reader.ts               # BR-schema SST.md parser, schema-versioned
│   ├── routing-table.yaml          # contract-glob → probe-handler dispatch (per brief §2)
│   ├── report-emit.ts              # Markdown emitter
│   ├── probes/                     # one module per category (10)
│   └── harness/                    # emulator-boot, postgres-docker-boot, secret-manager-readonly, network-mock
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/{igv,roh,nh}/      # test fixtures only — no fixtures in src/
└── docs/
    ├── 00-PHASE-A-BRIEF.md         # frozen copy at build time
    ├── COMPOSER2-RED-TEAM.md       # Stage 1 output
    ├── OPUS-AUDIT-PROMPT.md        # Stage 3 output
    └── CHANGELOG.md                # per tranche
```

---

## Opus audit prompt template (write this in Stage 3)

```markdown
You are Opus-in-Cursor running an independent audit on the BR Runtime Auditor build. Composer2 has finished; this is the gate before Anthony runs the Auditor against IGV for NHS launch.

Audit checklist (per Phase A brief §8 + Composer2 Red Team findings):

1. Routing table glob coverage — every critical_contracts: entry across IGV/RoH/NH SSTs matches exactly one routing rule. Gaps = RED.
2. Polymorphism handling — auth probe sub-probes correctly sized for each of three role-count cases (IGV 2, RoH 3, NH 3+guest).
3. Stub integrity — confirm zero real Vertex AI / Anthropic calls during a full probe run. Verify via fetch-log recorded during integration tests.
4. Egress probe (Probe 3) MUST surface as "DEFERRED — manual runbook §Check 3" not silently pass. Launch report header MUST show DEFERRED status visibly.
5. Idempotency — running the Auditor twice against the same SST produces byte-identical reports modulo: run timestamp, emulator port, container ID, UUID in evidence paths.
6. Findings-doc parity — first IGV run reproduces S01 findings §3 entries 1, 2, 6, 7b as RUNTIME-VERIFIED (or surfaces AMBER/RED with replicable evidence).
7. Universal-scope discipline — zero product-specific strings in src/ (grep IGV, RoH, NH). tests/fixtures excluded.
8. Fail-closed coverage — Probes 1, 2, 4 verify non-2xx response on dependency failure.
9. §16 + §17 discipline — confirm no Anthony-pings for tech calls; all decisions logged inline with reasoning.

Report shape: single-line verdict (READY / N FIXES / REWORK) + numbered issues with severity + recommendation.
```

---

## Begin

Start **Stage 1 now**. Read everything in "Reference docs" first. Then write `docs/COMPOSER2-RED-TEAM.md`. Do not begin Stage 2 until the Red Team pass is complete and recorded.

When Stage 2 finishes, report to Anthony: single-line verdict + recommendation + GO/ASK.
