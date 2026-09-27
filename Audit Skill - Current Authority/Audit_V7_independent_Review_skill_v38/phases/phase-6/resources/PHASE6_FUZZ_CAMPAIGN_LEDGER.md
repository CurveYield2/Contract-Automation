# Phase 6 Fuzz Campaign Ledger v2

## Internal sub-gate checkpoint

Authoritative internal progress record: `phases/phase-6/resources/PHASE6_SUBGATE_STATE.json`.

For each P6.0–P6.8 transition record the current sub-gate-state digest and the campaign evidence/ledger references that satisfied the gate. A later sub-gate may not be treated as valid merely because campaign rows exist if the predecessor gate did not reach a permitted terminal status.

## Audit identity

- Campaign ID:
- Audit token/generation:
- Frozen source commit/digest:
- Phase-5 handoff digest:
- `reviewer-3` identity/session lineage:
- Controller-admitted execution contract:
- Contract-Automation release:
- Runner release:

## Existing mutable Anvil RPC binding

- Required profile: `SIM_ARCHIVE_PRIMARY_ETHEREUM_01`
- Preflight status: `PASS | FAILED`
- Chain: `ethereum`
- Chain ID observed: `1 | <value>`
- Frozen block number: `<number>`
- Frozen block hash: `<hash>`
- Medusa fork mode proven: `YES | NO`
- Foundry same-fork identity proven: `YES | NO`
- Alternate/requester RPC used: `NO` required
- RPC URL persisted in durable evidence: `NO` required
- Infrastructure blocker / repair evidence: `<ref or NONE>`

**Failure rule:** any `NO` on required binding/proof or any alternate RPC/secret persistence prevents Phase-6 PASS.

## Harness / model inventory

| Artifact | Purpose | Production or audit-only | SHA-256 / immutable identity | Exact source binding |
|---|---|---|---|---|
| | | | | |

## Process status matrix

Allowed status for Processes 1–7: `COMPLETED` / `FAILED`.  
Allowed status for Processes 8–11: `COMPLETED` / `FAILED` / `NOT_TRIGGERED`.

| # | Process | Class | Status | Evidence reference | Residual limitation |
|---|---|---|---|---|---|
| 1 | Broad randomized exploration | ALWAYS | | | |
| 2 | Human-derived property/invariant fuzzing | ALWAYS | | | |
| 3 | Semi-targeted randomized fuzzing | ALWAYS | | | |
| 4 | Stateful transaction-sequence fuzzing | ALWAYS for stateful target | | | |
| 5 | Coverage-guided refinement + rerun | ALWAYS | | | |
| 6 | Targeted adversarial fuzz campaigns | ALWAYS | | | |
| 7 | Boundary/dictionary-directed fuzz generation | ALWAYS | | | |
| 8 | Explicit multi-actor state-machine model | TRIGGER | | | |
| 9 | Independent ghost/reference model | TRIGGER | | | |
| 10 | Differential fuzzing | TRIGGER | | | |
| 11 | Advanced corpus/deep-campaign escalation | TRIGGER | | | |

## Engine-order proof

- Medusa first campaign start evidence:
- Final required Medusa campaign terminal evidence:
- Native Foundry first campaign start evidence:
- Proof native Foundry began only after terminal Medusa evidence:

## Campaign register

| Campaign ID | Logical node | Engine | Purpose | Targets/selectors | Actors/senders | Properties/hypotheses | Seed/config | Runs/depth/calls/time | Corpus in/out | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | |

## Phase-2–5 property / hypothesis mapping

| Property / hypothesis ID | Source phase/evidence | Fuzzable? | Primary disposition | Campaign/evidence | Outcome |
|---|---|---:|---|---|---|
| | | | | | |

Primary disposition: `TARGETED_FUZZ`, `DETERMINISTIC_SIMULATION`, `STATIC_OR_MANUAL_PROOF`, `NOT_APPLICABLE_WITH_REASON`.

## Boundary dictionary

| Boundary class | Source/spec/math basis | Values or generator strategy | Campaigns exercised | Evidence |
|---|---|---|---|---|
| | | | | |

## Actor/state-machine model

| Actor/role | Permissions | Initial state | Allowed flows | Forbidden/adversarial flows | Evidence |
|---|---|---|---|---|---|
| | | | | | |

## Coverage reconciliation

| Coverage dimension | Initial/broad result | After refinement | Residual gap | Security significance | Disposition |
|---|---|---|---|---|---|
| Code/instruction/basic-block | | | | | |
| Contract/function/selector | | | | | |
| Invariant/property | | | | | |
| Actor/authority | | | | | |
| State transition/lifecycle | | | | | |
| Threat/hypothesis | | | | | |
| Boundary/time | | | | | |
| Dependency/integration | | | | | |

## Mandatory refinement evidence

### Medusa refinement cycle

- Initial gap:
- Harness/config/corpus change:
- Reason:
- Rerun identity:
- Before/after result:
- Remaining limitation:

### Native Foundry refinement cycle

- Initial gap/metric concern:
- Handler/target/bound/config change:
- Reason:
- Rerun identity:
- Before/after result:
- Remaining limitation:

## Trigger assessment — Processes 8–11

### Process 8 — multi-actor model

- Trigger facts:
- Status:
- Evidence/rationale:

### Process 9 — independent ghost/reference model

- Trigger facts:
- Status:
- Evidence/rationale:

### Process 10 — differential fuzzing

- Candidate reference(s):
- Trust/independence assessment:
- Status:
- Evidence/rationale:

### Process 11 — advanced corpus/deep escalation

- Trigger facts:
- Status:
- Escalation/stopping rationale:
- Evidence:

## Counterexamples / candidates

| Candidate ID | Engine/campaign | Minimized sequence/input | Reachability status | Production vs harness/model issue | Phase-8 routing |
|---|---|---|---|---|---|
| | | | | | |

## Final Phase-6 process conclusion

- All Processes 1–7 valid terminal evidence: YES / NO
- Processes 8–11 trigger decisions complete: YES / NO
- Medusa-before-Foundry ordering proven: YES / NO
- Mandatory Medusa refinement/rerun complete: YES / NO
- Mandatory Foundry refinement/rerun complete: YES / NO
- All material Phase-2–5 fuzzable properties/hypotheses mapped: YES / NO
- Security-surface coverage reconciled: YES / NO
- Production source unchanged by audit harnessing: YES / NO
- Residual limitations:
- Phase-6 process status:
