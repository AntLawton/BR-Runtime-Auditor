# Opus Independent Audit — BR Runtime Auditor Tranche B

**Auditor:** Opus (independent — did not build this code)
**Date:** 2026-06-03
**Target:** branch `feature/tranche-b-probes`, PR #4 (`6db0d41`), diffed against `main`
**Method:** committed-branch review + executed `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm format`, two deterministic CLI runs, a privacy-probe leak proof, and a full NH report render. Working tree was clean and equal to PR HEAD throughout (the stale start-of-session git snapshot was disregarded).

---

## One-line verdict

**FIX-FIRST** — probe #10 (privacy-threshold-floors) is non-functional: it is mathematically incapable of ever failing and cannot detect a sub-threshold leak, yet it reports GREEN with the words "sub-threshold groups suppressed". For an NHS privacy gate this is a launch-blocking false assurance and **must be fixed before merge**. The rest of the tranche is largely sound.

**Merge recommendation for PR #4:** Do **not** merge as-is. Merge once RED-1 is reworked and AMBER-1/AMBER-2/AMBER-3 are fixed or explicitly accepted.

---

## Verdict per audit item

| # | Item | Verdict |
|---|---|---|
| 1 | Universality (zero product names in `src/`; harness plug-ins; SST-driven dispatch) | **AMBER** |
| 2 | Routing coverage (every contract → exactly one rule; unrouted → AMBER) | **GREEN** (one AMBER sub-note: duplicate rows) |
| 3 | Stub integrity (zero real Vertex/Anthropic calls) | **GREEN** |
| 4 | Probe correctness (#4 / #5 / #8 / #10 + seeded leak) | **RED** |
| 5 | Polymorphism (sub-probe sizing across products) | **GREEN** |
| 6 | Idempotency (byte-identical modulo allowed fields) | **AMBER** |
| 7 | Deferrals honest (#3 egress, #9 NH deletion) | **AMBER** |
| 8 | Red-team + LoC-budget sanity | **AMBER** |

Build: PASS. Tests: 23/23 PASS. Lint: PASS. **Format: FAIL** (6 files — see AMBER-6).

---

## RED-1 — Probe #10 `privacy-threshold-floors` is a tautology that can never fail (item 4)

**This is the load-bearing finding and the reason the gate exists.**

The probe sweeps group sizes ±2 around each declared threshold and flags a "leak" with this filter:

```37:37:src/probes/privacy-threshold-probe.ts
    const leaks = sweep.filter((s) => s.groupSize < t.value && s.surfaces);
```

But `s.surfaces` is produced by the probe's own pure function, where `surfaces === (groupSize >= threshold)`:

```3:18:src/privacy-floor.ts
export function shouldSurfaceAggregate(groupSize: number, minThreshold: number): boolean {
  return groupSize >= minThreshold;
}

export function sweepThreshold(
  threshold: number,
  delta: number,
): { groupSize: number; surfaces: boolean }[] {
  const sizes = new Set<number>();
  for (let d = -delta; d <= delta; d++) {
    sizes.add(Math.max(0, threshold + d));
  }
  return [...sizes].sort((a, b) => a - b).map((groupSize) => ({
    groupSize,
    surfaces: shouldSurfaceAggregate(groupSize, threshold),
  }));
}
```

So the leak condition reduces to `(groupSize < threshold) && (groupSize >= threshold)` — **mathematically unsatisfiable for every threshold value**. The probe always returns GREEN.

**Proof (executed during this audit).** I ran the probe's exact filter for thresholds 5/10/20 and pathological values 0/1/−3/3, and ran the real probe against the NH fixture:

```
threshold=5  sweep= 3:false 4:false 5:true 6:true 7:true   => leaks=0
threshold=10 sweep= 8:false 9:false 10:true 11:true 12:true => leaks=0
threshold=20 sweep=18:false 19:false 20:true 21:true 22:true => leaks=0
NH verdict: GREEN  (MIN_RECORDINGS_FOR_AGGREGATION=GREEN, MIN_RECORDINGS_FOR_COMMISSION=GREEN, DEFAULT_K_ANONYMITY=GREEN)
threshold=0 => leaks=0 ; threshold=1 => leaks=0 ; threshold=-3 => leaks=0 ; threshold=3 => leaks=0
```

The probe **never reads the product's actual aggregation output**. It only parses the threshold *constant* (`src/probes/privacy-threshold-probe.ts:10-28`) and then sweeps synthetic numbers through the same floor function it checks them against. There is no fixture input — none — that can make it go RED. The rendered NH report states, with no evidentiary basis, "Threshold 10 — sub-threshold groups suppressed (±2 sweep)".

**The self-test that supposedly proves it catches a leak is fake.** It fabricates the leak object by hand and tests JavaScript's `&&` operator; it never invokes the probe:

```42:48:tests/unit/tranche-b-probes.test.ts
  it('catches deliberately seeded sub-threshold leak', () => {
    const sweep = sweepThreshold(5, 2);
    const leak = sweep.find((s) => s.groupSize === 3);
    expect(leak?.surfaces).toBe(false);
    const bad = { groupSize: 3, surfaces: true };   // <-- leak invented by hand
    expect(bad.groupSize < 5 && bad.surfaces).toBe(true);  // <-- tests `&&`, not the probe
  });
```

**Audit instruction "seed a deliberate sub-threshold leak and confirm #10 catches it": result = NOT CAUGHT.** Confirmed by execution above.

**Root cause:** the probe verifies its own arithmetic instead of the product's aggregation behaviour. The brief (§2 #10) requires asserting "sub-threshold groups never surface **in aggregate output**" — the probe consumes no aggregate output.

**Proper fix:** the probe must execute (or read recorded output from) the product's actual aggregation/k-anonymity function for group sizes around the threshold, and assert that sizes `< threshold` are suppressed in *that* output. Drive it from a `runtime_probe_hints` entry that names the aggregation module (mirroring the CSPRNG `sample_module` pattern). Then re-write the unit test to seed a genuinely leaky aggregation fixture and assert the probe returns RED.

**Workaround (interim, with caveat):** until reworked, treat #10 as **DEFERRED / not-yet-verifying** in reports rather than GREEN, so it does not give false assurance. Caveat: privacy-floor enforcement for NH stays manually verified until the probe is real.

---

## RED context for the other three B1 probes (item 4)

- **#5 `csprng-strength` — substantially correct.** Zero-collision check is real (`src/probes/csprng-probe.ts:48-55`); N defaults to 100,000 (`:8`); tokens are generated by importing and executing the declared generator (`:19-42`). Caveat: the uniformity check runs **only when `!mockMode`** and is a coarse coefficient-of-variation test, not a chi-square (`:56-73`), so uniformity is never exercised in CI. GREEN with note.
- **#8 `pepper-distinctness` — correct.** Emits GREEN-with-explicit-note when no pair is declared (`src/probes/pepper-probe.ts:10-24`; verified for IGV), and asserts `a !== b` reading the read-only Secret Manager plug-in when a pair is declared (`:38-59`; verified GREEN "Values differ" on the NH render). Pairs are inferred, not hardcoded (`src/pepper-pairs.ts`). GREEN.
- **#4 `ai-prompt-pinned` — partial; golden compare is a stub (AMBER).** Temperature-0 regex and a forbidden-summary-word heuristic exist (`src/probes/ai-prompt-probe.ts:7-18`), but:
  - The "golden-file compare for runtime-assembled prompts" required by the brief is **not implemented**. The code reads the golden file and only checks it is non-empty, comparing the file to its own path — no runtime prompt is assembled and no diff is performed — while reporting the misleading text "Runtime-assembled prompt compared to golden fixture":

```50:59:src/probes/ai-prompt-probe.ts
    if (hint?.golden_file) {
      try {
        const golden = readFileSync(resolveRepoPath(ctx.sst, hint.golden_file), 'utf8');
        const assembledPath = resolveRepoPath(ctx.sst, hint.golden_file);
        subProbes.push({
          id: `${surface.id} — golden`,
          verdict: golden.length > 0 ? 'GREEN' : 'RED',
          detail: 'Runtime-assembled prompt compared to golden fixture',
          citation: `${assembledPath}:1`,
        });
```

  - No fixture declares a `golden_file`, so this branch is **dead code across all three calibration products** (verified by grep).
  - "Verbatim base instruction" is not actually verified — only temperature pinning + a forbidden-word heuristic.

Because RED-1 alone is a hard fail and #4's golden compare is a stub, **item 4 = RED**.

---

## Item 1 — Universality: **AMBER**

Architecturally sound: dispatch is SST + `routing-table.yaml` driven (`src/routing.ts:26-37`), harnesses are plug-ins behind interfaces + factories (`src/types/harness.ts:9-53`, `loadHarness`/`loadNetworkMock`/`loadSecretManager`/`loadPostgresState`), and there are **no `if (product === …)` branches**.

But the brief's literal rule ("No IGV/RoH/NH strings in `src/`") is breached by residual product tokens:

- `src/probes/account-deletion-probe.ts:33` — `NH_DATABASE_URL` and `NH-DEV-TEST-WALKTHROUGH` in an evidence string.
- `src/harness/postgres.ts:1` — comment "availability gate for **NH** probes".
- `src/routing-table.yaml:78` — comment "neighbourhood product".

None create product-coupling (the Postgres harness also honours generic `DATABASE_URL`, `src/harness/postgres.ts:12), so this is a discipline/labelling breach, not an architectural one — hence AMBER, not RED. Note this also contradicts the Tranche B red-team's "Zero product names in `src/` — **GREEN**" claim (see AMBER-7).

## Item 2 — Routing coverage: **GREEN** (with a duplicate-row sub-note)

All 39 `critical_contracts` across the three fixtures (IGV 12 / RoH 13 / NH 14) map to an explicit row; zero fall through to the catch-all. Verified by `tests/unit/sst-reader.test.ts:24-41` and by my own enumeration against the fixtures. The unrouted fallback correctly emits **AMBER**, not a silent pass:

```122:125:src/routing-table.yaml
  - contract: '*'
    probe: structural-deferred
    verdict: AMBER
    note: Unrouted contract — no runtime probe handler
```

Sub-note (minor): `region-europe-west2` and `approved-endpoints-allowlist` each appear as **two** identical rows (`routing-table.yaml:23` & `:111`; `:31` & `:116`), so those contracts strictly match *two* rules, not "exactly one". `routeContract` uses first-match (`src/routing.ts:27`) and both duplicates carry identical verdicts, so behaviour is deterministic and safe — but the "exactly one rule" gate is only satisfied in spirit. The test asserts "routed", not "exactly one" (`tests/unit/sst-reader.test.ts:35-38`). De-duplicate for hygiene.

## Item 3 — Stub integrity: **GREEN**

Zero real Vertex AI / Anthropic calls during probe runs, proven three ways:
1. No provider-calling code exists in any probe — the only provider URL reference is the deliberate fail-closed simulation (`src/probes/ai-prompt-probe.ts:101`), which is routed through the network-mock wrapper and returns a synthetic 503, never hitting the network (`src/harness/network-mock.ts:29-36`).
2. The network-mock log assertion is empty during runs and surfaces GREEN ("No Vertex AI / Anthropic requests attempted") — verified on the NH render.
3. The fail-closed sim only runs in `!mockMode` and the zero-calls assertion runs *before* it.

Caveat (not a downgrade): the mock is a `fetch` *wrapper* (`network-mock.ts:18`), not an OS-level egress block — a future probe using a raw socket or a provider SDK with its own agent would bypass it. For the current probe set, actual egress is genuinely zero.

## Item 5 — Polymorphism: **GREEN**

Sub-probe sizing is SST/hint-driven with no hardcoding:
- Privacy thresholds: NH 3, RoH 1, IGV 0 — probe emits exactly that many sub-probes (verified: NH render shows 3; `tranche-b-probes.test.ts:95-99`).
- Pepper pairs: inferred from `env_var_contract` descriptions / `*_PEPPER` name pairing (`src/pepper-pairs.ts`), not hardcoded.
- CSPRNG / AI surfaces: glob-matched against the spine (`src/sst-spine.ts:3-11`), plus hint extensions.

(One design observation, not a defect: `runTrancheBProbes` unconditionally adds the three static probes for every product — `src/probes/index.ts:118` — so e.g. `ai-prompt-pinned` runs even where no AI surface exists; it then honestly emits AMBER "no surfaces" rather than a silent pass. Acceptable.)

## Item 6 — Idempotency: **AMBER**

Two deterministic runs (`BR_RUNTIME_DETERMINISTIC=1`, mock mode) against the IGV fixture were **not byte-identical**. The only difference is the CSPRNG sample digest, which is recomputed from freshly-generated random tokens each run and embedded in the report:

```
| igv.access_code — statistical | GREEN | N=1000 zero collisions; sample digest d160370a0ee8 | ... |
| igv.access_code — statistical | GREEN | N=1000 zero collisions; sample digest 50caa6bd424b | ... |
```

Source: `src/probes/csprng-probe.ts:74-78`. A random digest is **not** in the allowed-modulo list (timestamp, ports, container IDs) and is not suppressed under `BR_RUNTIME_DETERMINISTIC=1`. So the report cannot be diffed across runs. This is a one-line fix (omit/zero the digest when deterministic) but it currently fails the stated criterion — AMBER.

## Item 7 — Deferrals honest: **AMBER**

- **#9 NH account-deletion — honest.** Returns `DEFERRED` (never GREEN) whether or not Postgres is reachable (`src/probes/account-deletion-probe.ts:24-54`), and it appears in the report's "Visible deferrals" header (verified on the NH render). GREEN for this half.
- **#3 egress — NOT visibly surfaced as DEFERRED.** `egress-allow-list` is wired in `runProbe` (`src/probes/index.ts:44`) and routed `DEFERRED` in the table, **but neither orchestrator ever dispatches it** (it is absent from `TRANCHE_A_RUNTIME` and all `TRANCHE_B_*` sets, `src/probes/index.ts:15-31`). In the rendered NH report, `approved-endpoints-allowlist` shows as plain **"routed"** — indistinguishable from a covered contract — because the routing-coverage table prints only `routed`/`AMBER` and hides the verdict (`src/report-emit.ts:93-96`), and there is no probe-result section for it. A reader would reasonably assume egress is covered. This violates the brief's "egress MUST surface as DEFERRED, never silently GREEN / launch header MUST show DEFERRED visibly". Fix: execute `runEgressDeferred()` in the orchestrator (so it joins the deferral header) and/or render the DEFERRED verdict in the coverage table.

## Item 8 — Red-team & LoC sanity: **AMBER**

- The Tranche B red-team's universal-scope table claims **"Zero product names in `src/` — GREEN"**. That is **inaccurate** — NH tokens were introduced in this same tranche (see AMBER under item 1). The auditor's own clean-bill is partly self-certified here.
- **LoC budget** (red-team cap: "total `src/` ≤ 1,900, hard stop"): tracked `src/` totals **1,952 lines** including `routing-table.yaml` (121 lines of data); **1,831 lines** counting `.ts` only. So the claim "under cap" holds for code but the raw `src/` tree is ~52 lines over the stated 1,900 ceiling. Borderline; the counting convention was never pinned. Not a blocker, but the "under the agreed cap" claim is convention-dependent.
- **`pnpm format` fails** on 6 files (`src/mcp-wrapper.ts`, `src/privacy-floor.ts`, `src/probes/db-rules-probe.ts`, `src/probes/index.ts`, `src/sst-spine.ts`, `tests/unit/sst-reader.test.ts`) — yet `pnpm format` is in the audit's own verification command list and Composer reported "all green". Run `pnpm format:write`.

---

## Additional defect found while running (not in the checklist, but material)

**AMBER-CLI — the shipped `--mock` CLI path crashes for any product with `firestore_deny_paths`.** Running `node dist/cli.js <sst> --mock` (without `--tranche-b`) throws `fetch failed` and writes no report, because `db-rules-probe` performs a live `ctx.fetchFn(url)` against `127.0.0.1:8080` even in mock mode (`src/probes/db-rules-probe.ts:60`), and the CLI wires `fetchFn` to the *real* `fetch` (`src/harness/firebase.ts:89-94`). Only the test/integration harness injects a mock fetch (`tests/integration/tranche-a-igv.test.ts:13`), so the shipped mock path is effectively untested. Tranche A code, surfaced by Tranche B's mock-mode expectations — worth a fix so `--mock` is genuinely self-contained.

---

## RED items that MUST be fixed before merge

1. **RED-1 — Rework probe #10 so it verifies real product aggregation output and can actually fail; replace the fake self-test with one that seeds a genuine sub-threshold leak and asserts RED.** Until then it must report DEFERRED, not GREEN.

## Strongly-recommended before merge (AMBER)

2. **#4 golden-prompt compare** — implement a real assembled-vs-golden diff, or stop claiming "compared to golden fixture"; verify "verbatim base instruction".
3. **Egress #3 visibility** — make the DEFERRED status visible in the report (dispatch it / render the verdict).
4. **Idempotency** — suppress the CSPRNG digest under `BR_RUNTIME_DETERMINISTIC=1`.
5. **`--mock` CLI** — inject a mock fetch so mock runs are self-contained.
6. **`pnpm format`** — run `format:write`; remove residual NH tokens from `src/`; de-duplicate the two repeated routing rows; correct the red-team's "zero product names" claim.

---

## Plain-English summary for Anthony

The build mostly does what Composer says: it compiles, all its own tests pass, the routing covers every contract for all three products, it makes **zero** real (paid) AI calls, and the pepper-secret and token-randomness checks genuinely work.

**But one of the new privacy checks is broken in a way that matters.** The "privacy threshold" check — the one meant to guarantee that small groups of people can't be singled out in aggregate NHS data — **can never fail**. Because of a logic error, it always says "all good", even if the product were leaking. I proved this by trying to make it fail with every value I could and it stayed green every time. Worse, the test Composer wrote to "prove" this check works doesn't actually run the check at all — it hand-writes a fake result and tests a line of plain JavaScript. This is exactly the kind of "self-test passed a launch-blocking bug" problem this independent gate exists to catch.

A few smaller things: the AI-prompt check claims to compare prompts against a saved "golden" copy but doesn't really; the egress check is quietly shown as "routed" instead of clearly "deferred — do this manually"; running the tool twice gives slightly different reports; and the formatting check fails. None of those are dangerous on their own.

**My recommendation: do not merge PR #4 yet.** Send it back to fix the privacy check first (the rest can follow). Once the privacy check actually inspects real output and a proper test proves it catches a leak, this is close to mergeable.

*— End of independent audit.*

---

## Re-audit (fix round 1, 2026-06-03)

**Auditor:** Opus (independent — did not build this code, did not fix anything; execute-verify-report only)
**Target:** `feature/tranche-b-probes` HEAD `b8a5a58` ("Fix round 1") committed on top of original `6db0d41`.
**Method:** committed-branch re-verification of the RED + six AMBERs + regression gates, with two mandatory falsifiability probes (privacy leak, golden byte). All temporary edits were reverted; working tree was clean before and after.

### Pre-flight — PASS

```
$ git status
On branch feature/tranche-b-probes
nothing to commit, working tree clean

$ git log --oneline -2
b8a5a58 Fix round 1: RED-1 privacy probe + six AMBERs per OPUS-AUDIT-2026-06-03
6db0d41 Tranche B: probes 4, 5, 8, 10 and harness plug-ins.
```

HEAD is the fix-round commit on top of `6db0d41`; tree clean. Gate satisfied (not loose working-tree state). Fix-round diff surface = 31 files (incl. new `src/harness/mock-fetch.ts`, `tests/fixtures/{roh,nh}/aggregation-fixture.ts`, `tests/fixtures/privacy/leaky-aggregation-fixture.ts`, `tests/fixtures/igv/golden/transcribe-prompt.txt`).

### Execution battery — ALL GREEN

```
pnpm build  → tsc && copy-routing-table.mjs        → exit 0
pnpm test   → Test Files 6 passed (6); Tests 24 passed (24)
pnpm lint   → eslint src tests                      → exit 0 (clean)
pnpm format → prettier --check src tests            → "All matched files use Prettier code style!"
rg "IGV|RoH|\bNH\b" src/                            → exit 1 (ZERO matches)
```

### 1. RED-1 — privacy-threshold-floors — **RESOLVED (now load-bearing)**

The probe no longer checks its own arithmetic. It reads `t.aggregation_module` from the product hint, dynamically imports it, and calls the product's real `shouldSurfaceAggregate(groupSize, name)` (`src/probes/privacy-threshold-probe.ts:33-90`). Missing hint → `DEFERRED` (`:59-67`); unreadable module / missing export → `DEFERRED` (`:74-82`) — never GREEN. The seeded-leak unit test invokes the real `runPrivacyThresholdProbe` against `tests/fixtures/privacy/leaky-aggregation-fixture.ts` (surfaces `groupSize >= threshold-1`) and asserts RED (`tests/unit/tranche-b-probes.test.ts:46-65`).

**Falsifiability probe (mandatory) — PASS.** Temporarily edited the leaky fixture to correctly suppress (`return groupSize >= threshold`), re-ran the test:

```
× privacy-threshold-probe > catches deliberately seeded sub-threshold leak via product aggregation module
  → expected 'GREEN' to be 'RED'
```

The test FAILS when the fixture stops leaking — i.e. it genuinely depends on real product output. Edit reverted (`git diff --stat` empty); test passes again. This is a real, falsifiable probe.

### 2. Fake-test check (every new/changed test in diff) — **PASS**

All nine tests in `tranche-b-probes.test.ts` invoke the real probe entrypoints (`runPrivacyThresholdProbe`, `runAiPromptProbe`, `runCsprngProbe`, `runPepperProbe`, `runTrancheBProbes`) against `mockCtx(...)`; none hand-construct a result object. The original fake self-test (which built `const bad = { groupSize: 3, surfaces: true }` and tested JavaScript's `&&`) has been deleted. The only other changed test file, `sst-reader.test.ts`, is a Prettier line-wrap with no logic change. Two tests were independently proven to fail when their code-under-test regresses (RED-1 leak above; golden below).

### 3. AI golden compare — **RESOLVED**

`assemblePrompt()` is exported from the producer fixture (`tests/fixtures/igv/gemini-transcribe-fixture.ts:9-11`). The probe imports it, assembles the runtime prompt, and does a genuine string compare against the trimmed golden file (`src/probes/ai-prompt-probe.ts:74-96`), emitting RED on mismatch. Report row confirms a real compare: `fixture.transcribe — golden | GREEN | Runtime-assembled prompt matches golden fixture`.

**Falsifiability probe (mandatory) — PASS.** Mutated one byte of `tests/fixtures/igv/golden/transcribe-prompt.txt` (`only.` → `onlx.`), re-ran the golden test:

```
× ai-prompt-probe > passes mock mode with zero provider calls and golden compare
  → expected 'RED' to be 'GREEN'
```

One byte flips the probe non-GREEN. Golden file reverted (`git diff --stat` empty).

### 4. Egress #3 visibility — **RESOLVED**

`egress-allow-list` is now dispatched in `runTrancheAProbes` (`src/probes/index.ts:92-94`) and `formatRoutingStatus` renders the DEFERRED verdict (`src/report-emit.ts:23`). Rendered IGV report (mock CLI) shows it visibly DEFERRED in three places, distinct from "routed":

```
## Launch gate status (NHS 2026-05-25)
**Visible deferrals (Anthony fork decisions recorded):**
- **Egress allow-list integrity** — DEFERRED: ... §Check 3 (VPC/egress audit). Never silently pass.

## Routing coverage
| approved-endpoints-allowlist | egress-allow-list | DEFERRED — Manual runbook §Check 3 — VPC/egress audit post-launch |

### Egress allow-list integrity (`egress-allow-list`)
**Verdict:** DEFERRED
```

### 5. Idempotency — **RESOLVED**

Two runs with `BR_RUNTIME_DETERMINISTIC=1` + `--mock` against the IGV SST, diffed with `Compare-Object`:

```
$env:BR_RUNTIME_DETERMINISTIC='1'; $env:BR_RUNTIME_MOCK='1'
node dist/cli.js tests/fixtures/igv/SST.md --mock   (run 1 → run1.md)
node dist/cli.js tests/fixtures/igv/SST.md --mock   (run 2 → run2.md)
Compare-Object (Get-Content run1.md) (Get-Content run2.md)
===DIFF (empty = identical)===
                                            ← (no rows: byte-identical)
```

The CSPRNG digest is pinned (`csprng-probe.ts:74-77` → `sample digest deterministic`) and the timestamp is fixed (`report-emit.ts:74-76` → `1970-01-01T00:00:00.000Z`). Reports are now diffable across runs. (Temp `run1.md`/`run2.md` deleted; tree clean.)

### 6. `--mock` CLI — **RESOLVED**

`node dist/cli.js tests/fixtures/igv/SST.md --mock` (WITHOUT `--tranche-b`; IGV has `firestore_deny_paths`) completed offline:

```
Report written: .../tests/fixtures/igv/br-runtime-report.md
Overall: see report
===EXIT 0===
```

No `fetch failed`, no real network; `db-rules-deny` ran GREEN (`permission-denied (PERMISSION_DENIED)`). The harness uses `createMockFetch()` in mock mode (`src/harness/firebase.ts:81`: `const baseFetch = mockMode ? createMockFetch() : ...`), defined in `src/harness/mock-fetch.ts`.

### 7. Hygiene — **PASS**

`pnpm format` clean, `pnpm lint` clean, `rg` zero product tokens in `src/` (battery above). `docs/COMPOSER2-RED-TEAM.md` carries the dated `## Opus fix-round (2026-06-03)` section with a 7-row fix table (RED-1 + AMBER-2..7) and a re-audit-gate note.

---

## Re-audit one-line verdict

**MERGE** — the load-bearing RED-1 privacy probe is now real and provably falsifiable, the golden compare is a genuine byte compare, egress is visibly DEFERRED, runs are byte-identical under deterministic mode, `--mock` is self-contained, and all hygiene gates (build/test 24/24/lint/format/zero-tokens) are green.

## Plain-English summary for Anthony

Everything I sent back has been fixed, and I re-checked each one by trying to break it. The big one — the privacy check that previously could never fail — now actually runs the product's own "should this small group be shown?" logic and reports DEFERRED (not a false "all good") if that logic is missing. I proved it works by feeding it a deliberately leaky version: the check correctly went RED, and when I made the version safe again the test correctly failed because there was nothing to catch. I did the same trick on the AI-prompt check: I changed a single character in the saved "golden" copy and the check immediately flagged a mismatch, so it's genuinely comparing the real prompt now. The egress item is now clearly shown as "DEFERRED — do this manually" in three places instead of hiding behind "routed"; running the tool twice gives byte-for-byte identical reports; the offline `--mock` mode no longer tries to hit the network; and formatting, linting and the "no product names in the code" rule all pass. **My recommendation: this is safe to MERGE.** Nothing remains outstanding from the items I flagged. The one thing to keep on your radar (unchanged from before, not a blocker) is that the egress/VPC check and the NH account-deletion check are still intentionally manual runbook steps, not automated — they're honestly labelled as such, but someone still has to do them by hand before the NHS launch.

*— End of re-audit (fix round 1).*
