# BR Runtime Auditor

Universal runtime-behaviour verification for SST.md-driven products. Closes the HI-4 source-vs-runtime boundary that Blast Radius does not cover.

## Install

```powershell
pnpm install
pnpm build
```

## Run (Tranche A — IGV NHS launch)

Start Firebase emulators in the target monorepo, then:

```powershell
pnpm build
node dist/cli.js path/to/SST.md --target=C:\path\to\RoH-App
```

Mock mode (CI / self-tests, no emulator required):

```powershell
$env:BR_RUNTIME_MOCK=1
node dist/cli.js tests/fixtures/igv/SST.md --mock
```

Report written to `<deploy-unit>/br-runtime-report.md`.

## Running against real IGV

Copy the probe-hints sidecar beside the IGV SST in RoH-App:

**Destination:** `C:\Users\Antho\RoH-App\packages\functions-igv\sst-probe-hints.yaml`

**Install (one line):**

```powershell
Copy-Item tests\fixtures\igv\sst-probe-hints.yaml C:\Users\Antho\RoH-App\packages\functions-igv\sst-probe-hints.yaml
```

Edit `project_id` in the copied file to match your Firebase project ID, then start emulators in RoH-App and run:

```powershell
pnpm build
node dist/cli.js C:\Users\Antho\RoH-App\packages\functions-igv\SST.md --target=C:\Users\Antho\RoH-App
```

## Tranche A scope (2026-05-25 NHS gate)

| Probe | Category | Status |
|---|---|---|
| 1 | Auth gate rejects | Runtime (emulator) |
| 2 | DB rules deny | Runtime (emulator) |
| 6 | Rate limit triggers | Runtime (emulator) |
| 7a | Storage rules deny | Runtime (emulator) |
| 7b | Real bucket prefix scan | **DEFERRED** — IGV runbook §Check 7 manual |

## Test

```powershell
pnpm test
```

## Docs

- Phase A brief: `docs/00-PHASE-A-BRIEF.md`
- Red Team: `docs/COMPOSER2-RED-TEAM.md`
