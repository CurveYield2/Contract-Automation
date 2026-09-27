# Phase 6 Internal Sub-Gate Protocol v2

Phase 6 remains one numbered controller phase, but v29 requires three fresh subreviewers.

## Ownership and hard sequencing

```text
reviewer-3A / Phase 6A: P6.0
→ P6A_TO_P6B accepted handoff
reviewer-3B / Phase 6B: P6.1 → P6.2 → P6.3 → P6.4 → P6.5 → P6.6
→ terminal Medusa evidence + P6B_TO_P6C accepted handoff
reviewer-3C / Phase 6C: P6.7 → P6.8
```

Valid gate statuses remain `PENDING`, `ACTIVE`, `COMPLETED`, `COMPLETED_WITH_LIMITATION`, `FAILED_BLOCKING`.

- A later gate never activates before predecessor terminality.
- `COMPLETED_WITH_LIMITATION` cannot conceal omitted mandatory work.
- `FAILED_BLOCKING` routes to repair/retry/typed limitation policy; there is no human `CONTINUE` gate.
- Every transition records exact source/tool/harness/fork/evidence identities and OBL-* state.
- Existing Process 1–11 vocabulary remains controlled by `PHASE6_FUZZ_CAMPAIGN_METHODOLOGY.md`.
- P6.7 cannot activate until P6.1–P6.6 and required Medusa evidence are terminal plus fresh reviewer-3C accepts P6B_TO_P6C.
- P6.8 cannot seal Phase 6 until native Foundry refinement/rerun and v29 accounting/chaos/known-attack/mutation/coverage requirements are reconciled.

## Progressive disclosure

Open only the current Phase-6 subphase card and current P6.* gate card. The full methodology remains normative for process preservation.
