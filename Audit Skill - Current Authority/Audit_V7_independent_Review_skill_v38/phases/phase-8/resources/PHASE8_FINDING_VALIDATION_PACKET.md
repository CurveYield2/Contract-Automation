# Phase 8 Finding Validation Packet

Create one complete record for **every candidate**, including dismissed/duplicate candidates. Follow the mandatory validation order exactly.

## Candidate record
- Candidate ID:
- Candidate origin phase/artifact:
- Affected source/surface:
- Related `PROP-*` / `HYP-*` / `SIM-*`:

### 1. Identity
- Exact source/release identity:
### 2. Scope
- In-scope determination and evidence:
### 3. Security property
- Violated/threatened property and expected behavior:
### 4. Evidence
- Immutable evidence references/digests:
### 5. Reachability
- Preconditions, actors, permissions, state requirements, reachability conclusion:
### 6. Reproduction
- Reproduction method, deterministic result, evidence:
### 7. Contradictions
- Contrary evidence/alternative explanations considered and disposition:
### 8. Duplicate check
- Duplicate/related finding lineage and decision:
### 9. Impact
- Maximum credible impact, economic materiality, affected assets/users, bounds:
### 10. Severity
- Severity rationale under `SEVERITY_CALIBRATION.md`:
### 11. Disposition
- `VALIDATED_FINDING | DISMISSED | DUPLICATE | UNRESOLVED_LIMITATION`:
- Canonical `FIND-*` ID if validated:

## Adversarial challenge
- Strongest challenge to the finding conclusion:
- Challenge result:
- Residual uncertainty / confidence limitation:

## Packet index
| Candidate ID | Final disposition | Finding ID | Severity if validated | Evidence ref |
|---|---|---|---|---|
| | | | | |

## Phase reconciliation
- Candidate count / validated / dismissed / duplicate / unresolved:
- Evidence invalidation triggers:

## Campaign-global synchronization
Before phase sealing, mirror every material stable ID/relationship created or changed by this artifact into the campaign-local `SECURITY_TRACEABILITY_GRAPH`, and mirror every deferred/later-phase-required action into the canonical `CARRIED_FORWARD_OBLIGATION_LEDGER` with a stable `OBL-*` ID. Record the current immutable graph/ledger references and digests in the Phase Report. Narrative reminders do not replace these global artifacts.
