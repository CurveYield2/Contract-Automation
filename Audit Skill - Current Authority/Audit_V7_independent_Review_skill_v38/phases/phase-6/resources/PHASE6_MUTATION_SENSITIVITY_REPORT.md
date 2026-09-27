# Phase 6 Harness Mutation / Sensitivity Report — Exact Fill Template

## Safety fence
- Production source digest:
- Audit-only mutant/fault-fixture location/digest:
- Proof admitted production source was not modified:

## Critical property sensitivity

Use `KILLED | SURVIVED | INVALID_MUTATION | UNREACHABLE_MUTATION | ALTERNATE_SENSITIVITY_PROOF | NOT_APPLICABLE_WITH_EVIDENCE`.

| Property/invariant ID | Criticality/rationale | Fault/mutation class | Expected failure | Observed | Evidence | Required repair if SURVIVED |
|---|---|---|---|---|---|---|
| | | | | | | |

## Minimum mutation classes considered when relevant
- remove/weaken authorization;
- skip debit/credit/accounting update;
- skip reward debt/checkpoint;
- skip fee/reserve/supply update;
- reverse/weaken comparison or rounding;
- allow double claim;
- bypass solvency/min-out/state check;
- stale index/rate use.

Every critical `SURVIVED` result creates `HARNESS_QUALITY_GAP` and blocks Phase-6 seal until repaired/retested or a permitted typed limitation is recorded.
