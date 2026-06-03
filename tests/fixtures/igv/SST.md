# Fixture SST — IGV deploy unit (truncated for Auditor self-tests)

```yaml
project: insight-genie-voice
project_type: firebase-functions-codebase
sst_version: '0.4'

meta:
  launch_gate:
    name: NHS
    date: '2026-05-25'
  runtime_probe_hints:
    ai_prompt_surfaces:
      - id: fixture.transcribe
        producer_file: tests/fixtures/igv/gemini-transcribe-fixture.ts
    csprng:
      - spine_id: igv.access_code
        sample_module: tests/fixtures/igv/access-code-gen.ts
  security_layer:
    - name: igv-facilitator-claim-auth
      layer: auth-middleware
      producer_file: packages/functions-igv/src/http/igv-app.ts
    - name: igv-firestore-deny-all-client
      layer: nosql-rules-engine
      producer_file: firestore.rules
    - name: igv-storage-deny-all-audio-path
      layer: storage-rules
      producer_file: storage.rules

critical_contracts:
  - transcription-only-ai-scope
  - firestore-deny-all-client-reads
  - facilitator-claim-required-with-orgId
  - access-code-server-side-validation-only
  - three-questions-exact
  - audio-mime-and-size-whitelist
  - region-europe-west2
  - soft-delete-via-excluded-flag
  - approved-endpoints-allowlist
  - no-self-registration
  - HI-GDPR-no-audio-persistence
  - prompt-level-pii-redaction

spine:
  - id: igv.access_code
    version: '1'
    producer:
      file: tests/fixtures/igv/access-code-gen.ts

mission: Insight Genie Voice runtime verification fixture
```
