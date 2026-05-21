# Fixture SST — NH deploy unit (contracts only)

```yaml
project: neighbourhood-hearts
project_type: firebase-functions-codebase
sst_version: '0.4'

meta:
  security_layer: []

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
