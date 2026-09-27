# Lite Combined Phases 2–5 — Segment 3: Complete Manual and Specialist Review

> Continue in the same `reviewer-2` session. This segment retains the complete source-first manual security review. Cost reduction comes from removing repeated reporting/reconciliation—not from reducing contract coverage.

> Open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json) first.

## One-pass multi-lens rule

Perform **one principal semantic source traversal**. Keep the EVM review, privilege review, and every TRIGGERED/UNCERTAIN_INCLUDE specialist lens active during that same traversal. Record multiple observations against the same source anchor instead of rereading the contract once per lens. Reopen raw source only for a targeted unresolved question or contradiction. This reduces repeated context loading without reducing coverage.

## Steps

| Step | Action | Required work | Resource |
|---:|---|---|---|
| 1 | Enter manual implementation lens | Review the exact source first and preserve coverage against the accepted structural inventory. | [Manual lens](../../shared/lenses/manual-implementation-lens.md) |
| 2 | Cover every in-scope contract and material reachable function | Review state transitions, access control, external calls, callbacks, storage, accounting, token behavior, failure behavior, and integration assumptions. Record coverage and candidate IDs. | [EVM review](../../../../shared/domain-modules/evm-contract-review.md) · [Coverage registry](resources/PHASE4_MANUAL_COVERAGE_CANDIDATE_REGISTRY.md) |
| 3 | Review every privilege path | Verify governance/admin/emergency/upgrade authority and transition correctness. | [Governance/privileges](../../../../shared/domain-modules/governance-privileges.md) |
| 4 | Execute every activated specialist domain | Perform the copied specialist method for every `TRIGGERED`/`UNCERTAIN_INCLUDE` material domain. A skip requires current `NOT_TRIGGERED` evidence. | [Domain registry](../../shared/controller/DOMAIN_APPLICABILITY_REGISTRY.json) |
| 5 | Use standards/formal work only when materially triggered | Execute exhaustive standards proof only for an explicit material conformance claim; use formal verification only when necessary to resolve a material property/candidate that cannot be adequately resolved by retained Lite methods. | [Standards policy](../../shared/policy/STANDARDS_CONFORMANCE.md) |
| 6 | Reconcile manual candidates | Ensure every material observation is a stable candidate, resolved non-issue with evidence, or typed limitation. Create Phase-5 economic/math and Lite 6–7 targeted obligations. | [Traceability graph](../../shared/controller/SECURITY_TRACEABILITY_GRAPH.json) |
| 7 | Continue without duplicate seal | Do not reclassify unchanged domains, reverify Source Intelligence, or file a Phase-4 report. Continue directly to [Phase 5](../phase-5/START_HERE.md). | [Combined report](../phase-5/resources/LITE_PHASE2_5_COMBINED_REPORT.md) |
