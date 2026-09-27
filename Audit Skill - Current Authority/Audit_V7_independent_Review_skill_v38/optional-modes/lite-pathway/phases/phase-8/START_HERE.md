# Lite Combined Phases 8–10 — Segment 1: Candidate Validation

> `reviewer-4` (`gpt-5.6-sol`, `high`) executes Phases 8–10 continuously. Phase 9 runs only when remediation artifacts exist. One combined milestone seals in Phase 10.

> Open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json) first.

## Candidate-family deduplication rule

Before deep validation, group candidates that clearly share the same root cause, source anchor and decisive evidence path. Validate the shared premise once, then give **every candidate** its own reachability/impact/severity/disposition record. A shared premise may reduce duplicate reads/tests; it may not erase candidate-specific differences or convert candidates to `DUPLICATE` without reviewer judgment.

## Steps

| Step | Action | Required work | Resource |
|---:|---|---|---|
| 1 | Accept P67_TO_P8 | Verify exact campaign/source/build, merged Phase 6–7 evidence, all target dispositions, residual obligations and successor receipt. | [Handoff checklist](../../shared/handoff/SUCCESSOR_HANDOFF_RECEPTION_CHECKLIST.md) |
| 2 | Validate every material candidate | Independently inspect source and decisive evidence; reproduce or otherwise establish reachability, impact, prerequisites and property violation. | [Validation packet](resources/PHASE8_FINDING_VALIDATION_PACKET.md) |
| 3 | Calibrate finding outcome | Mark each candidate `VALIDATED_FINDING`, `REJECTED`, `DUPLICATE`, `INFORMATIONAL`, `INCONCLUSIVE` or `BLOCKED`, with evidence and severity rationale. | [Severity policy](../../shared/policy/SEVERITY_CALIBRATION.md) |
| 4 | Provide remediation guidance | For each validated finding, state the security objective and concrete repair direction without rewriting unrelated code. | [Finding template](../../shared/reporting/FINDING_TEMPLATE.md) |
| 5 | Choose the only conditional branch | If remediation artifacts are supplied, continue to [Phase 9](../phase-9/START_HERE.md). Otherwise mark Phase 9 `SKIPPED_NO_REMEDIATION` and continue to [Phase 10](../phase-10/START_HERE.md). | [Controller](../../shared/controller/AI_Auditor_Controller.md) |

Do not run a separate broad adversarial no-go review or repeat the merged Phase 6–7 campaign. Request only the smallest decisive evidence needed to resolve a material candidate.
