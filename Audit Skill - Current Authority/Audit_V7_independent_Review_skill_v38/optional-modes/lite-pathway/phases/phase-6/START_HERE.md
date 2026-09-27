# Merged Lite Phases 6–7 — Deployment/Configuration Simulation and Targeted Validation

> **LITE EXECUTION AUTHORITY:** One `reviewer-3L` (`gpt-5.6-sol`, `high`) performs this merged milestone. There are no 6A/6B/6C reviewers, no Phase-6 campaign fan-out, and no independent Phase-7 deployment.

> Open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json) first. Do not import excluded Full-path campaigns into this Lite run.

## Retained purpose

Prove whether the exact release can be built and deployed under its real configuration, then prove or disprove every material candidate with deterministic simulations and basic targeted fuzzing.

## Steps

| Step | Action | Required work | Resource |
|---:|---|---|---|
| 1 | Accept P5_TO_P6 | Verify exact campaign/source/build, combined Phase-2–5 milestone, candidates, target obligations, and successor receipt. | [Handoff checklist](../../shared/handoff/SUCCESSOR_HANDOFF_RECEPTION_CHECKLIST.md) |
| 2 | Admit the exact build once | Compile/build the exact source and toolchain. Reuse a valid Phase-1 build only when identity remains exact; otherwise repair and rerun admission. | [Execution protocol](resources/LITE_PHASE6_7_EXECUTION_PROTOCOL.md) |
| 3 | Simulate the complete deploy/config sequence | Execute all constructors, initializers, dependencies, addresses, roles, ownership/governance transfers, approvals, wiring and post-deploy state checks required for a usable release. | [Deploy/config matrix](resources/LITE_DEPLOY_CONFIG_MATRIX.md) |
| 4 | Map every material candidate to a proof target | Define exact setup, actor, transaction sequence, expected secure outcome, exploit/failure oracle, variable bounds and decisive evidence. | [Target matrix](resources/LITE_TARGETED_TEST_MATRIX.md) |
| 5 | Run deterministic candidate simulations | Group compatible candidates that share the exact source/fork/deploy/config identity into coherent execution batches and reuse a deterministic post-deploy snapshot when safe. Preserve candidate-specific setup, oracle, traces and results so batching never merges dispositions. | [Execution protocol](resources/LITE_PHASE6_7_EXECUTION_PROTOCOL.md) |
| 6 | Run basic targeted fuzzing | Batch compatible candidate fuzz targets when they share the exact environment, while retaining independent candidate oracles/evidence. Vary only candidate-relevant parameters and immediate boundaries with constrained generators. This is not broad discovery, stateful random exploration, chaos, Medusa, mutation, differential/reference or coverage-guided work. | [Target matrix](resources/LITE_TARGETED_TEST_MATRIX.md) |
| 7 | Disposition every target | Mark each target `SUPPORTED`, `DISPROVED`, `INCONCLUSIVE`, or `BLOCKED`, with exact evidence and limitation. An inconclusive target remains a Phase-8 validation obligation. | [Evidence record](resources/LITE_PHASE6_7_EVIDENCE.md) |
| 8 | Seal the merged milestone | Enumerate all Full-only omissions, reconcile the graph/obligation/invalidation state, record the Phase-7 completion marker, and file one merged report. | [Evidence record](resources/LITE_PHASE6_7_EVIDENCE.md) · [Phase Report](../../shared/reporting/PHASE_REPORT.md) |
| 9 | Handoff to reviewer-4 | Create `P67_TO_P8`, enter `WAITING_FOR_SUCCESSOR_AGENT`, and stop. | [Lite handoff protocol](../../shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md) |

## Expressly excluded from Lite

- Medusa and multi-engine fuzz orchestration.
- Broad, semi-targeted, stateful or coverage-guided random discovery.
- Chaos, mutation, differential/reference-model, corpus/deep and exhaustive known-attack campaigns.
- Broad lifecycle simulation beyond the complete deploy/config path and candidate-specific proof sequences.
- Comprehensive coverage closure or iterative coverage-expansion campaigns.

These omissions must be disclosed as residual assurance limits. They are not required-process failures in Lite mode and they become explicit Full-upgrade targets.
