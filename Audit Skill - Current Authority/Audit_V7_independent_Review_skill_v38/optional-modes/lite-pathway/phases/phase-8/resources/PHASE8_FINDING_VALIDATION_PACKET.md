# Phase 8 Finding Validation Packet

Create one complete record for **every candidate**, including dismissed/duplicate candidates. Follow the mandatory validation order exactly.

## Candidate-family pre-index
Group candidates only when they share the same root cause, source anchor and decisive evidence path. Record the shared premise/evidence once, then reference it from each candidate record. Candidate-specific reachability, impact, severity and final disposition remain mandatory.

- Family/root-cause ID:
- Candidate IDs:
- Shared source anchor:
- Shared decisive evidence:
- Candidate-specific differences requiring separate validation:

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
- `VALIDATED_FINDING | REJECTED | DUPLICATE | INFORMATIONAL | INCONCLUSIVE | BLOCKED`:
- Canonical `FIND-*` ID if validated:

## Conclusion challenge
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
Maintain the graph and obligation ledger live. Seal their final checkpoint only in Phase 10 as part of the combined Phase 8–10 milestone.
