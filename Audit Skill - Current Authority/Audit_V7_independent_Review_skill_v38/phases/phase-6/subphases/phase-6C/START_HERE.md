# Phase 6C — Independent Foundry Validation, Harness Sensitivity & Assurance Closure

> **CURRENT-SUBPHASE READ BOUNDARY:** Read the Phase-6 router first, then this card. You are fresh `reviewer-3C`. Medusa terminal evidence is an input, not work to repeat.

## Phase card

| Step | Action | What to do | Open only when active |
|---:|---|---|---|
| 1 | **Receive P6B_TO_P6C** | Verify 6B seal, P6.1–P6.6 terminal order, terminal Medusa evidence/corpus/counterexamples and exact remaining Foundry obligations. | [Handoff protocol](../../../../shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md) |
| 2 | **P6.7 native Foundry independent campaigns** | Execute Foundry fuzz/invariants informed by Medusa but independently designed; include accounting and known-attack/counterexample continuations. | [P6.7](../../resources/subgates/P6_7_NATIVE_FOUNDRY.md) |
| 3 | **Foundry deliberate refinement/rerun** | Review metrics/security gaps, materially change tests/handlers/dictionaries/models and rerun as required by Process 5. | [Methodology](../../resources/PHASE6_FUZZ_CAMPAIGN_METHODOLOGY.md) |
| 4 | **Prove critical harness sensitivity** | Use qualified mutation engine if available; otherwise audit-only mutants/fault fixtures/known failing equivalents. Repair every critical SURVIVED gap. | [Mutation report](../../resources/PHASE6_MUTATION_SENSITIVITY_REPORT.md) · [Fallback](../../resources/PHASE6_V29_COMPATIBILITY_AND_FALLBACK.md) |
| 5 | **Complete multidimensional coverage-gap analysis** | Reconcile source/property/accounting/actor/state/motif/known-attack/boundary/model/Medusa/Foundry/mutation coverage. High-risk unexplained gaps block seal. | [Coverage gap report](../../resources/PHASE6_COVERAGE_GAP_REPORT.md) |
| 6 | **P6.8 final reconciliation** | Finalize all Processes 1–11 plus v29 accounting/chaos/known-attack/mutation/coverage obligations and candidate routing. | [P6.8](../../resources/subgates/P6_8_RECONCILIATION.md) · [Campaign summary](../../resources/PHASE6_CAMPAIGN_RESULT_SUMMARY.md) |
| 7 | **Reconcile global state and file final Phase-6 report** | Update graph/domain/OBL/invalidation state; file universal Phase Report. No human approval gate. | [Phase report](../../../../shared/reporting/PHASE_REPORT.md) · [Auto advancement](../../../../shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md) |
| 8 | **Create P6_TO_P7 successor package automatically** | Seal wake-up message, enter WAITING_FOR_SUCCESSOR_AGENT and stop; fresh reviewer-4 executes Phase 7. | [Three-reviewer protocol](../../resources/PHASE6_THREE_REVIEWER_PROTOCOL.md) · [Boundary profiles](../../../../shared/handoff/SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json) |
