# Lite Combined Phases 2–5 — Segment 2: Architecture, Threats and Domain Applicability

> Continue in the same `reviewer-2` session. Do not reverify unchanged Source Intelligence or file a separate Phase-3 report.

> Open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json) first.

## Steps

| Step | Action | Required work | Resource |
|---:|---|---|---|
| 1 | Enter architecture/threat lens | Bind the same exact source and consume the Phase-2 property registry. | [Architecture lens](../../shared/lenses/architecture-threat-lens.md) |
| 2 | Model architecture and privilege | Map trust boundaries, authority transitions, upgrade paths, callbacks, external dependencies, and protected assets. | [Governance/privileges](../../../../shared/domain-modules/governance-privileges.md) |
| 3 | Build attack hypotheses | Create stable `HYP-*` records with actor, prerequisites, sequence, target property, success condition, and validation route. | [Threat model](../../../../shared/domain-modules/threat-model-attack-trees.md) |
| 4 | Classify all specialist domains once | Evaluate every domain against exact source and current evidence. `UNCERTAIN_INCLUDE` is triggered. | [Domain matrix](../../shared/controller/DOMAIN_APPLICABILITY_MATRIX.json) · [Registry](../../shared/controller/DOMAIN_APPLICABILITY_REGISTRY.json) |
| 5 | Record triggered specialist obligations | Bind every triggered domain to Phase-4 manual work and any candidate-specific Lite simulation obligation. | [Obligation ledger](../../shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json) |
| 6 | Continue without duplicate seal | Maintain live graph/domain/obligation state and continue directly to [Phase 4](../phase-4/START_HERE.md). Reopen domain classification later only when evidence changes a trigger fact. | [Combined report](../phase-5/resources/LITE_PHASE2_5_COMBINED_REPORT.md) |

Do not perform exhaustive standards proof or formal verification here. Those are triggered only by an explicit material standards claim or when needed to resolve a material candidate.
