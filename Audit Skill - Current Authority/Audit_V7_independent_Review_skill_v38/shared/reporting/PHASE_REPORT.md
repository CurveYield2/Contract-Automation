# Audit V7 Phase Report

## Phase identity
- Campaign / generation:
- Phase / revision:
- Exact source identity:
- Exact release identity, when release-bound:
- Controller version/schema:
- Report digest/reference:

## Source Intelligence checkpoint
- Latest accepted Source Intelligence Bundle Index reference / revision:
- Bundle Index accepted commit SHA / SHA-256:
- Bound source digest:
- Bound build digest:
- Reuse status: `CREATED | REUSED_VERIFIED | REUSED_WITH_LIMITATION | REGENERATED_NEW_SOURCE | INVALIDATED_PENDING_REPLACEMENT | NOT_APPLICABLE`
- Relevant sections materially reviewed this phase:
- Discrepancy / replacement / limitation / OBL-* references:

| Component | Logical artifact ID | Canonical path (navigation only) | Accepted revision | Accepted commit SHA | Accepted SHA-256 | Status / invalidation | Last verified phase | Preserved snapshot ref |
|---|---|---|---|---|---|---|---|---|
| Immutable core | `SI-CORE` | | | | | | | |
| Runtime/deployment overlay | `SI-RUNTIME-OVERLAY` | | | | | | | |
| Assurance-readiness overlay | `SI-READINESS-OVERLAY` | | | | | | | |

- Component revisions materially relied on by this phase:
- Current mutable-path bytes independently matched to the accepted revision/digest: `YES | NOT_USED | NO_BLOCKS_SEAL`
- Phase-owned acceptance action: `NONE | INITIALIZED_PHASE1 | ACCEPTED_READINESS_PHASE6A | ACCEPTED_RUNTIME_GAS_PHASE7 | REGENERATED_REBOUND_PHASE9 | FINAL_VERIFIED_PHASE10`

## Executive result
- Phase status: `PASS | INFORMATIONAL_ISSUE_FOUND | LOW_ISSUE_FOUND | MEDIUM_ISSUE_FOUND | HIGH_ISSUE_FOUND | CRITICAL_ISSUE_FOUND | FAIL`
- Process health:
- Highest validated/candidate security significance in this phase:
- Automatic progression status: `AUTO_ADVANCE_READY | WAITING_FOR_SUCCESSOR_AGENT | COMPLETE | BLOCKED`

## What this phase reviewed
Describe the exact scope, surfaces, contracts/functions/integrations, invariants, and phase-specific objectives.

## Work performed
List substantive review actions and technical executions in enough detail to reproduce or locate evidence.

## Canonical outputs created
Every mandatory phase-specific structured artifact must appear here before `EVIDENCE_SEALED`.

| Artifact / stable ID | Type | Durable reference | Digest / immutable identity | Status | Limitation |
|---|---|---|---|---|---|
| | | | | | |

## Campaign-global security traceability checkpoint
- Canonical graph reference:
- Graph digest / immutable identity:
- Graph revision:
- Nodes/edges materially added or changed this phase:
- Material properties/hypotheses/candidates without required downstream disposition:
- Traceability limitations requiring later action:

## Campaign-global obligation checkpoint
- Canonical obligation ledger reference:
- Ledger digest / immutable identity:
- Ledger revision:
- Obligations due in this phase:
- Due obligations satisfied / N/A / superseded:
- Due obligations BLOCKED_CARRIED with permitted destination and blocker evidence:
- Due obligations still `OPEN` or `IN_PROGRESS`: **must be 0 before EVIDENCE_SEALED**
- New OBL-* IDs created this phase:

## Evidence produced
For every major item give type, exact source/request/job/artifact/result identity, durable reference, digest when available, status, and limitation.

## Coverage and reconciliation
- Expected surfaces / properties:
- Reviewed:
- Unreviewed:
- Explicit applicability decisions:
- Contradictions / unresolved evidence gaps:

## Findings and candidate issues
Separate validated findings from unvalidated candidates/observations. Include IDs, affected surface, impact, evidence, current severity/disposition, and duplicate relationships.

## New canonical audit facts
Record stable IDs created or materially updated in this phase. Use typed IDs such as `PROP-*`, `HYP-*`, `CAND-*`, `FIND-*`, `ASSUMP-*`, `DEP-*`, `BOUND-*`, `SIM-*`, or another explicitly defined stable family.

| ID | Type | Canonical fact / state | Source/evidence basis | Downstream consumers |
|---|---|---|---|---|
| | | | | |

## Carried-forward obligations
This table is the human-readable projection of the canonical `CARRIED_FORWARD_OBLIGATION_LEDGER`; it is not an independent store. Do not rely on prose such as “check later.” Every unresolved or intentionally deferred item must have a stable `OBL-*` ID in the canonical ledger and identify the exact later phase and action.

| Obligation ID | Originating evidence / fact | Required later phase | Required action | Completion condition | Current status |
|---|---|---:|---|---|---|
| | | | | | |

## Evidence invalidation event reconciliation
Apply `shared/controller/EVIDENCE_INVALIDATION_MATRIX.json` to every material change observed in or before this phase. If no material change event occurred, record `NO_MATERIAL_CHANGE_EVENT`.

| INV-* ID / event | Matrix rule | Effect | Evidence invalidated/rebound/reconciled | Replacement/retest evidence or OBL-* | Status |
|---|---|---|---|---|---|
| | | | | | |

## Evidence invalidation triggers
State exactly what change would make some or all sealed evidence from this phase stale. Include source hash changes, compiler/config changes, deployment/address changes, dependency state changes, or other phase-specific invalidators. If a category cannot invalidate the phase, say `NOT_APPLICABLE` with reason.

| Trigger | Evidence affected | Required response |
|---|---|---|
| | | |

## Technical/process limitations
Record failed or not-applicable tools, recovery attempts, stale-evidence rejection, source limitations, and the `PROCEDURAL_INDEPENDENCE_ONLY` limitation whenever relevant.

## Automatic next transition
State exactly which phase/subphase/reviewer state follows this report, which sealed artifacts/evidence become inputs, and whether execution continues immediately or a fresh successor package is required. Same-reviewer progression continues immediately after filing.

## Advancement checkpoint
- Controller state after submission: `AUTO_ADVANCE_READY | WAITING_FOR_SUCCESSOR_AGENT | COMPLETE | BLOCKED`
- Seal/completeness evidence authorizing progression:
- Next phase/subphase/reviewer:
- Successor handoff reference when applicable:

No per-phase human approval or `CONTINUE` response is required.
