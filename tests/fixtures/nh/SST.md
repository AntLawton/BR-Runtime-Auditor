# Fixture SST — NH deploy unit (contracts only)

```yaml
project: neighbourhood-hearts
project_type: firebase-functions-codebase
sst_version: '0.4'

meta:
  security_layer: []
  runtime_probe_hints:
    privacy_thresholds:
      - name: MIN_RECORDINGS_FOR_AGGREGATION
        value: 10
      - name: MIN_RECORDINGS_FOR_COMMISSION
        value: 20
      - name: DEFAULT_K_ANONYMITY
        value: 5
    distinct_secret_pairs:
      - a: NH_REGISTRATION_PEPPER
        b: NH_RECORDING_PEPPER
    db_rules:
      postgres_deny_queries:
        - SELECT 1 FROM citizens LIMIT 1
  env_var_contract:
    - name: NH_REGISTRATION_PEPPER
      description: MUST be a DIFFERENT value from NH_RECORDING_PEPPER
    - name: NH_RECORDING_PEPPER
      description: Distinct from NH_REGISTRATION_PEPPER

critical_contracts:
  - HI-zero-join-Layer1-Layer2
  - HI-distinct-peppers-registration-vs-recording
  - HI-Layer1-PII-Layer2-3-4-PII-free
  - HI-no-Cloud-Storage-for-voice-audio
  - HI-account-deletion-Layer1-only-Layer2-anonymised
  - pepper-secrets-via-Secret-Manager-in-prod
  - Gemini-single-multimodal-call-transcript-plus-analysis
  - region-europe-west2
  - approved-endpoints-allowlist
  - step8-magic-link-server-side-only
  - min-recordings-for-aggregation-10
  - min-recordings-for-commission-20
  - k-anonymity-default-5
  - claude-anthropic-only-for-text-LLM
```
