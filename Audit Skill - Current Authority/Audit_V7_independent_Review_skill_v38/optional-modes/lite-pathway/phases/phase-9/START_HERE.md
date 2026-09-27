# Lite Combined Phases 8–10 — Segment 2: Conditional Remediation Verification

> Phase 9 executes only when remediation artifacts exist. The same `reviewer-4` continues; there is no fresh-agent boundary or separate report.

> Open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json) first.

## Entry condition

- If no remediation commit/patch/artifact is supplied: record `SKIPPED_NO_REMEDIATION` and go directly to [Phase 10](../phase-10/START_HERE.md).
- If remediation exists: bind its exact identity and perform the steps below.

## Steps when remediation exists

| Step | Action | Required work | Resource |
|---:|---|---|---|
| 1 | Bind remediation delta | Identify the exact changed source/config/dependency and every affected finding/property/target. | [Delta ledger](resources/PHASE9_REMEDIATION_DELTA_LEDGER.md) |
| 2 | Verify each claimed fix | Re-run the decisive candidate proof and confirm the finding's success condition is removed without relying on assertion alone. | [Remediation review](../../../../shared/domain-modules/remediation-review.md) |
| 3 | Inspect affected surface | Review changed code plus directly affected callers, state, privileges, accounting and integration behavior. Do not repeat unaffected audit work. | [Delta ledger](resources/PHASE9_REMEDIATION_DELTA_LEDGER.md) |
| 4 | Disposition | Record `REMEDIATED`, `PARTIALLY_REMEDIATED`, `NOT_REMEDIATED`, `REGRESSION_FOUND`, or `BLOCKED`, with exact evidence. | [Validation packet](../phase-8/resources/PHASE8_FINDING_VALIDATION_PACKET.md) |
| 5 | Continue to finalization | Update live graph/obligations/invalidation state and continue to [Phase 10](../phase-10/START_HERE.md) without a separate report or global seal. | [Traceability graph](../../shared/controller/SECURITY_TRACEABILITY_GRAPH.json) |

Broad unrelated regression campaigns are outside Lite scope. A newly discovered material security candidate is still recorded and validated before finalization.
