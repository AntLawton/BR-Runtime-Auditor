# Changelog

## Tranche A (2026-05-21)

- Stage 2 Tranche A: probes 1 (auth), 2 (db-rules-deny Firestore), 6 (rate-limit), 7a (storage-rules-deny)
- Probe 7b DEFERRED per Anthony fork #1 (HYBRID): real bucket scan stays in IGV runbook §Check 7
- Explicit routing-table.yaml with per-contract rows; structural-deferred GREEN for non-runtime contracts
- Firebase emulator harness with mock mode for CI self-tests
- IGV fixture at `tests/fixtures/igv/` with merged `sst-probe-hints.yaml`
