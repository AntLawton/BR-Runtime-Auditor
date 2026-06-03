# Fixture SST — RoH deploy unit (contracts only)

```yaml
project: return-on-heartbeats
project_type: firebase-functions-codebase
sst_version: '0.4'

meta:
  security_layer: []
  runtime_probe_hints:
    privacy_thresholds:
      - name: DEFAULT_MINIMUM_AGGREGATION
        value: 5
        producer_file: tests/fixtures/roh/shared-constants-fixture.ts

critical_contracts:
  - HI-no-individual-attribution-T1
  - HI-cross-org-isolation-T2
  - HI-staff-only-read-own-captures-T3
  - HI-60-second-audio-deletion-T4
  - HI-no-PII-in-classifier-output
  - orgId-derived-server-side
  - three-role-model-staff-consultant-manager
  - aggregation-enforcement-min-group-size-5
  - audio-mime-and-size-whitelist-webm-ogg-10mb
  - claude-anthropic-only-for-text-LLM
  - region-europe-west2
  - consent-recorded-on-staff-setup-gdpr
  - approved-endpoints-allowlist
```
