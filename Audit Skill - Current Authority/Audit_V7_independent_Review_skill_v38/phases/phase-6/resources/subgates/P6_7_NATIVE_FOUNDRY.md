# P6.7 — Native Foundry Fuzz / Invariant Campaigns

**Hard entry gate:** P6.1–P6.6 are terminal and all required Medusa work is sealed. Native Foundry MUST NOT begin earlier.

## Required execution

1. Inspect supplied Foundry fuzz/invariant artifacts; create/repair audit-only `testFuzz_*`, invariant/stateful handlers, fixtures, mocks, actor/ghost/reference models, dictionaries and scripts when missing or unusable.
2. Bind Foundry to the same preflight-frozen mutable Anvil identity used by Medusa.
3. Incorporate Medusa counterexamples, corpus observations, coverage gaps and Phase-2–5 properties/hypotheses rather than restarting from a generic test plan.
4. Execute native Foundry property/invariant/stateful campaigns.
5. Inspect handler-call, revert/discard, state-change, actor, property and coverage metrics.
6. Make a justified refinement and perform a mandatory rerun even if the first run appears healthy.
7. Execute dedicated targeted-adversarial Foundry campaigns and boundary/dictionary-directed cases.
8. Execute any Process 8–11 method that is applicable on the Foundry side and preserve its already-determined trigger rationale.
9. Preserve exact tool version, config, seeds, run/depth/case/call evidence, harness/model hashes, counterexamples/reproductions and residual limitations.

**Exit:** terminal native Foundry evidence exists; the Foundry side of Process 5 has its mandatory metrics/coverage refinement and rerun; Foundry-expressible property/stateful/boundary/targeted/advanced work is complete; no required campaign was silently omitted. Overall Process 1–11 dispositions are finalized only in P6.8.

Resources:
- [`PHASE6_FUZZ_HARNESS_REQUIREMENTS.md`](../PHASE6_FUZZ_HARNESS_REQUIREMENTS.md)
- [`PHASE6_FUZZ_CAMPAIGN_LEDGER.md`](../PHASE6_FUZZ_CAMPAIGN_LEDGER.md)
- [`PHASE6_FUZZING_EXTERNAL_REFERENCES.md`](../PHASE6_FUZZING_EXTERNAL_REFERENCES.md)
