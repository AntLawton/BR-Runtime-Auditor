# Opus RE-AUDIT Prompt — Tranche B Fix Round 1 (2026-06-03)

**You are Opus-in-Cursor running a focused, independent re-audit.** You did not build this code and you must not fix anything — execute, verify, report.

**Target:** branch `feature/tranche-b-probes` (PR #4, `AntLawton/BR-Runtime-Auditor`), AFTER the 2026-06-03 fix-round commit.
**Scope:** ONLY the items below (the RED + six AMBERs from `docs/OPUS-AUDIT-2026-06-03.md`) plus regression gates. Do NOT re-audit the items that were GREEN in the original audit (routing coverage, stub integrity, polymorphism, pepper) beyond running the full test suite.

## Pre-flight (hard gate)

1. `git status` must be clean and HEAD must include the fix-round commit (the original Tranche B commit was `6db0d41`; the fix round must be committed on top). If the working tree has uncommitted changes or HEAD is still `6db0d41`, **STOP and report `BLOCK: fix round not committed`** — do not audit loose working-tree state.
2. `git diff 6db0d41..HEAD --stat` — the fix-round diff is your audit surface. Any NEW code in it (e.g. `findProjectRoot()` CLI repo-root resolution, `src/harness/mock-fetch.ts`) is in scope even though it wasn't in the original fix list.

## Execution battery (run all; paste raw output)

```powershell
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm format
rg "IGV|RoH|\bNH\b" src/
```

Any failure = FIX-FIRST. The `rg` must return zero matches.

## Item-by-item re-verification

**1. RED-1 — probe #10 privacy-threshold-floors (load-bearing).**
- Read `src/probes/privacy-threshold-probe.ts`: confirm it obtains `shouldSurfaceAggregate` from the product's `aggregation_module` hint and inspects REAL module output — not its own arithmetic. Confirm missing/unreadable module → `DEFERRED`, never `GREEN`.
- Run the seeded-leak unit test and confirm it invokes `runPrivacyThresholdProbe` (the real probe) against `tests/fixtures/privacy/leaky-aggregation-fixture.ts` and asserts `RED`.
- **Falsifiability probe (mandatory):** temporarily edit the leaky fixture so it correctly suppresses sub-threshold sizes, re-run the test, confirm it now FAILS (probe returns GREEN where the test expects RED). Revert your edit. A test that passes both ways = RED.

**2. Fake-test check (applies to EVERY new/changed test in the diff).** Each test must invoke the real code path under test. Any test that hand-constructs the result object, or that cannot fail when the code under test is broken, = **RED**. This project has twice shipped self-tests that passed broken safety code — this check is the reason the gate exists.

**3. AI golden compare.** Confirm `assemblePrompt()` is exported and the probe performs a genuine byte compare against the golden file (IGV wired at `tests/fixtures/igv/golden/transcribe-prompt.txt`). **Falsifiability probe:** temporarily mutate one byte of the golden file, run the probe path, confirm it goes RED/non-GREEN. Revert.

**4. Egress #3 visibility.** Run the CLI against a fixture and confirm the rendered report shows `DEFERRED — …` for the egress/allow-list contract — visibly distinct from covered contracts. "routed" with a hidden verdict = FIX-FIRST.

**5. Idempotency.** Two runs with `BR_RUNTIME_DETERMINISTIC=1` (mock mode, same SST) must be byte-identical modulo the originally allowed fields (timestamp, ports, container IDs). Diff the two outputs and paste the result. The CSPRNG digest must be pinned.

**6. `--mock` CLI.** `node dist/cli.js <sst> --mock` (WITHOUT `--tranche-b`) on a fixture with `firestore_deny_paths` must complete offline and write a report — no `fetch failed`, no real network. Confirm `createMockFetch()` is what the harness uses in mock mode.

**7. Hygiene.** `pnpm format` and `pnpm lint` clean (battery above); zero product tokens in `src/` (battery above); confirm `docs/COMPOSER2-RED-TEAM.md` has the dated fix-round entry.

## Report

Append findings to `docs/OPUS-AUDIT-2026-06-03.md` under a new section `## Re-audit (fix round 1, 2026-06-03)`. Per item: verdict + pasted runtime evidence (not narration).

End with:
- Single-line verdict: **MERGE** / **FIX-FIRST** / **BLOCK**
- One plain-English paragraph for Anthony (non-technical): what is now safe to rely on, what (if anything) is not, and what he should do next.
