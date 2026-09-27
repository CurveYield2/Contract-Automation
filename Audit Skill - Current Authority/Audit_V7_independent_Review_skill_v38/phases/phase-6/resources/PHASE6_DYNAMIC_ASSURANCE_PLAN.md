# Phase 6 Dynamic Assurance Plan — Exact Fill Template

## Identity
- Campaign/generation:
- Exact source/build digests:
- Source Intelligence ref/digest:
- P5_TO_P6 handoff/receipt:
- Capability mode for each future automation: `QUALIFIED_AVAILABLE | AVAILABLE_NOT_QUALIFIED | UNAVAILABLE_USE_MANUAL_FALLBACK`

## Mandatory assurance-track matrix

Every row requires an exact disposition; blanks are forbidden.

| Track | Applicable? | Properties / hypotheses / surfaces | Execution method / engine | Required evidence | Status |
|---|---|---|---|---|---|
| Broad randomized discovery | | | Medusa | | `PLANNED/N_A_WITH_EVIDENCE` |
| Security properties/invariants | | | Medusa + Foundry | | |
| Accounting assurance | | | model + executable properties/reference model | | |
| Randomized accounting attack/chaos | | | Medusa/Foundry/Anvil if runtime-only | | |
| Stateful multi-actor lifecycle | | | Medusa + Foundry | | |
| Targeted hypotheses | | | Medusa + Foundry | | |
| Known/historical attack patterns | | | qualified KB or manual fallback | | |
| Boundary/numerical/time | | | Medusa + Foundry | | |
| Ghost/reference/differential | | | triggered methods | | |
| Harness mutation sensitivity | | | Phase 6C | | |
| Coverage/refinement/rerun | YES | Medusa + Foundry | both engines | | |
| Candidate reproduction/routing | YES | | | | |

## Medusa campaign inventory
- Broad campaign IDs:
- Property/invariant campaign IDs:
- Stateful/multi-actor campaign IDs:
- Accounting-chaos campaign IDs:
- Targeted hypothesis campaign IDs:
- Known-attack adaptation campaign IDs:
- Boundary/dictionary campaign IDs:
- Triggered advanced campaign IDs:

## Foundry independent continuation inventory
- Native property/invariant campaign IDs:
- Counterexample/reproduction IDs:
- Independent accounting campaign IDs:
- Targeted attack IDs:
- Mutation-sensitivity IDs:

## Phase-7 carry only when runtime state is genuinely required
- Attack/simulation ID:
- Why Phase 6 cannot execute it faithfully:
- Exact runtime dependency:
- OBL-* ID / Phase-7 destination:

## Seal readiness for 6A
- All mandatory tracks dispositioned:
- Medusa harness/preflight ready:
- Required templates populated:
- No unresolved design gap hidden as N/A:
