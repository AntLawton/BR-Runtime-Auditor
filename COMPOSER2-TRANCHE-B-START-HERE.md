# COMPOSER2 — BR Runtime Auditor TRANCHE B (START HERE)

You are Composer2 in Cursor. You are **upgrading an existing, shipped tool** — the BR Runtime Auditor at `C:\Users\Antho\BR-Runtime-Auditor`. Tranche A shipped 2026-05-21 and is in production use. Do **not** rebuild it. This brief adds the remaining probe coverage so the Auditor protects all of Anthony's live products, not just IGV.

Owner: Anthony Lawton (strategic, **non-technical** — see Disciplines). Authored by the Cowork orchestrator, 2026-06-03.

> **Read `COMPOSER2-START-HERE.md` (the original dispatch) first for the full Disciplines and Universal-Scope rules. They all still apply unchanged. This document layers Tranche B scope on top.**

> 🌐 **UNIVERSAL TOOL — THIS IS NOT A ROH-APP TOOL.** The BR Runtime Auditor (like Blast Radius and BR-Semantic) is a portfolio-wide product that must work for **any** SST-driven product on **any** stack, now and in future. IGV, RoH and NH are only the **first calibration fixtures** — they are the test set, not the boundary. Concretely: (a) **zero** product names or platform assumptions in `src/` (only in `tests/fixtures/`); (b) every harness (Firebase, Secret Manager, network-mock, Postgres) is a **plug-in behind an interface + factory** so a future stack — AWS, Cloud Run, Supabase, a non-Firebase product — slots in without touching probe code; (c) probe dispatch is driven by the SST + `routing-table.yaml`, and the **unrouted-contract fallback must keep working for products not yet in the table** (emit AMBER "unrouted", never silent pass). If anything you build would only work for RoH-App's three products, stop and redesign. Verify this explicitly in your Stage 1 red-team.

---

## Three stages — strict order (unchanged from Tranche A)

### Stage 1 — RED TEAM THIS BRIEF *before* writing any code
Read this brief + the reference docs. Then run your own adversarial pass over **this brief**: gaps, contradictions, hidden assumptions, edge cases, missing decisions, and anything that would force you to invent scope mid-build. Append your findings to `docs/COMPOSER2-RED-TEAM.md` under a new `## Tranche B red-team (2026-06-03)` heading, GREEN/AMBER/RED per finding.
- **Apply tech-call fixes inline** (§16 — do not ask Anthony technical questions).
- **Surface strategic forks only** as numbered questions at the top of that section (scope, cost, external dependencies, product-surface changes). The LoC-budget question in §"Scope guardrail" below is one such fork — resolve it in Stage 1.
- Do **not** start Stage 2 until the red-team pass is recorded.

### Stage 2 — Build (in two sub-tranches; ship B1 before starting B2)
Follow §"What to build" below. Maintain the existing architecture: one probe module per category exporting `run<Name>Probe(ctx): Promise<ProbeResult>`, registered in `src/probes/index.ts`, dispatched by `src/routing-table.yaml`. Every probe output carries `path/to/file:line` citations. Mock-mode self-tests (vitest) for every new probe, mirroring the Tranche A probe tests.

### Stage 3 — Prepare Opus handoff
Update `docs/OPUS-AUDIT-PROMPT.md` with the Tranche B audit asks (§"Stage 3 Opus audit asks"), then report ready. **One-line verdict + one-line recommendation + GO-or-ASK** to Anthony, in plain English.

---

## Current state (what already exists — do not duplicate)

- **Live probes (real):** `auth-probe.ts`, `db-rules-probe.ts` (Firestore variant), `rate-limit-probe.ts`, `storage-probe.ts` (incl. `runBucketScanDeferred`).
- **Stubbed (return `DEFERRED`):** the six Tranche B categories are currently routed to `runTrancheBDeferred()` in `src/probes/deferred-probe.ts`: `ai-prompt-pinned`, `csprng-strength`, `pepper-distinctness`, `privacy-threshold-floors`, `account-deletion-polymorphism`, `egress-allow-list`.
- **Harness:** `src/harness/firebase.ts` only. **No Postgres harness, no Secret Manager client, no network-mock layer yet.**
- **Routing:** `src/routing-table.yaml` covers the voice product (12 contracts) and staff-capture product (13). **NH (the third product, ~14 contracts) is not yet in the table.**
- **Orchestration:** `runTrancheAProbes()` exists in `src/probes/index.ts`. There is **no** `runTrancheBProbes()` orchestrator or phase-sequencer yet.

This brief turns the stubs into real probes, adds the missing harness pieces, and completes product coverage.

---

## What to build

### Tranche B1 — MUST-HAVE (ship this first; high security value, low harness burden)

These are the probes that protect privacy and secrets. Three of the four are static/property probes needing **no emulator**, so they are fast to ship and run anywhere.

| Probe | Category | Acceptance criteria (from Phase A brief §2) |
|---|---|---|
| **#4 `ai-prompt-pinned`** | AI prompt integrity | Read each provider helper named by spine ids (`*.classifier`, `*.enricher`, `*.routing`, `*.transcribe`, `*.llm_*_prompt`); assert verbatim base instruction + `temperature: 0.0`. For prompts assembled at runtime from variables, log the final assembled prompt to a fixture and compare to a golden file. **Network-mock layer must prove zero real Vertex AI / Anthropic calls during the run.** |
| **#5 `csprng-strength`** | Token randomness | For each token generator (`*.access_code`, `*.magic_link`, `*.token_*`), generate N=100k tokens; assert statistical uniformity + zero collisions. Pure compute, no emulator. |
| **#8 `pepper-distinctness`** | Secret separation | Read each declared `distinct_secret_pairs` via a **read-only Secret Manager client**; assert the two values differ. If a product declares no such pair, emit **GREEN with an explicit "no distinct-secret invariant declared" note** — never a silent no-op. |
| **#10 `privacy-threshold-floors`** | Aggregation safety | Property test sweeping group sizes ±2 around each declared threshold (`MIN_*`, `*_K_ANONYMITY`); assert sub-threshold groups never surface in aggregate output. |

**Also in B1:**
- **NH product routing.** Add the ~14 NH `critical_contracts:` rows to `routing-table.yaml`, mapping each to a probe or `structural-deferred: GREEN`. After this, run all three product SSTs and confirm **zero "unrouted contract" AMBERs**.
- **Flip the routing rows** for the four B1 probes from `DEFERRED` to active.
- **`runTrancheBProbes()` orchestrator** + Phase-1 (static) / Phase-4 (property) sequencing per Phase A §5.
- **Cross-cutting fail-closed check** on probe #4 (AI provider unreachable → non-2xx / queued-retry, never silent empty 200).
- **Harness additions:** network-mock layer (provider-layer intercept) and read-only Secret Manager client. Architect both as harness plug-ins (interface + factory) per the Universal-Scope rule — no product-specific branches.

### Tranche B2 — NICE-TO-HAVE (higher effort; ship only after B1 is clean)

| Probe / item | Why it's B2 |
|---|---|
| **#2 `db-rules-deny` — Postgres variant** + **#9 `account-deletion-polymorphism`** | Both need a **Postgres Docker harness** (NH only). #9 is a cross-DB E2E (Postgres + Firestore): register → submit → delete → confirm Layer-1 PII gone, Layer-2/4 anonymised intact. Real value for NH GDPR, but the heaviest item — keep separate. |
| **#3 `egress-allow-list`** | The Phase A brief itself defers this (needs a deployed function + VPC introspection). Keep it surfacing as **DEFERRED → manual runbook §Check 3**, never a silent pass. Only promote to a real probe if Stage 1 finds a sandboxed way to do it. |
| **MCP wrapper** | Convenience so the Auditor is invokable like BR's six MCP tools. Mirror BR's MCP pattern. Pure ergonomics — no new verification power — so it ranks last. |

---

## Scope guardrail (resolve in Stage 1 red-team)

The original budget was **≤800 LoC across `src/`** for the whole tool. Tranche B will likely exceed that. **Do not balloon silently and do not ask Anthony a tech question about it.** In Stage 1, propose a revised LoC budget (B1 and B2 separately) with reasoning, record it in `docs/COMPOSER2-RED-TEAM.md`, and build to it. If B1 alone would blow a sensible budget, re-scope (e.g. defer #10's property-test breadth) rather than expand.

---

## Universal-scope reminder (non-negotiable — from the original dispatch)

- **Zero product-specific names in `src/`.** No `IGV`/`RoH`/`NH` strings outside `tests/fixtures/`. Product identity comes from the SST + hints, never hardcoded branches. If you write `if (product === 'NH')`, stop and redesign.
- Probe dispatch is **SST + routing-table driven**, not hardcoded.
- New harness pieces (Secret Manager, network-mock, Postgres) are **plug-ins behind an interface**, so future stacks slot in without touching probe code.

---

## Reference docs (read in order — absolute paths)

1. **Original dispatch (Disciplines + Universal Scope — all still apply):** `C:\Users\Antho\BR-Runtime-Auditor\COMPOSER2-START-HERE.md`
2. **Phase A brief (the probe contract — §2 probe inventory, §5 sequencing, §8 audit asks):** `C:\Users\Antho\FitToCareBrain\07-Products\BR-Runtime-Auditor-Phase-A-Brief.md`
3. **Parked concept (S02/S03 polymorphism learnings — drives NH coverage):** `C:\Users\Antho\FitToCareBrain\07-Products\BR-Runtime-Auditor-Parked.md`
4. **User Guide (run mechanics, hints-file authoring, common errors):** `C:\Users\Antho\FitToCareBrain\07-Products\BR-Runtime-Auditor-User-Guide-for-New-Agents.md`
5. **The three product SSTs (fixtures + first-run targets):** `…\RoH-App\packages\functions-igv\SST.md`, `…\packages\functions\SST.md`, `…\packages\functions-nh\SST.md`
6. **Three findings docs (golden-output seed):** the `br-audit-findings-*.md` beside each SST.
7. **NH dev/test walkthrough (Postgres Docker harness — B2 only):** `C:\Users\Antho\RoH-App\nh-build-files\NH-DEV-TEST-WALKTHROUGH.md`

---

## Stage 3 Opus audit asks (record in `docs/OPUS-AUDIT-PROMPT.md`)

1. **Routing coverage:** every `critical_contracts:` entry across all three product SSTs matches **exactly one** routing rule. Any unrouted entry = RED.
2. **Stub integrity:** confirm **zero** real Vertex AI / Anthropic calls during a full probe run (network-mock log assertion). This is the load-bearing check for probe #4.
3. **Pepper / threshold correctness:** probe #8 emits GREEN-with-note (not silent pass) when no distinct-secret pair is declared; probe #10 catches a deliberately seeded sub-threshold leak in a fixture.
4. **Polymorphism:** probes size sub-probes correctly across the three products' differing role counts / threshold counts (no hardcoding).
5. **Idempotency:** two runs against the same SST produce byte-identical reports modulo timestamp, emulator ports, and container IDs.
6. **Egress + manual-deferral integrity:** #3 surfaces as DEFERRED (manual runbook), never silently GREEN.

---

## Definition of done

- **B1:** probes 4, 5, 8, 10 real and passing mock-mode self-tests; NH routing complete; zero unrouted contracts across all three products; `runTrancheBProbes()` wired into `cli.ts`; B1 LoC within the Stage-1-agreed budget; Opus audit asks 1–4 green.
- **B2 (if reached):** Postgres harness + probes 2-Postgres & 9; egress confirmed DEFERRED; optional MCP wrapper. Opus asks 5–6 green.
- **Report to Anthony:** one line on what's now protected that wasn't, one line on any residual manual step (egress), GO-or-ASK.
