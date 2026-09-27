# Phase 6 v29 Compatibility, Capability Detection & Fallback Protocol

## Purpose

Phase 6 v29 MUST remain fully executable while the six-layer controller automation, Historical Exploit/Adversarial Simulation KB, accounting-chaos generator, mutation engine, and coverage analyzer are still being built.

**Absence of future automation is never permission to skip the assurance work and never a reason to block an audit when the work can be performed with the current skill + existing Contract-Automation paths.**

## Capability detection at Phase 6A

Record each capability as:

```text
QUALIFIED_AVAILABLE
AVAILABLE_NOT_QUALIFIED
UNAVAILABLE_USE_MANUAL_FALLBACK
```

Capabilities:

```text
SIX_LAYER_PHASE_PLANNER
HISTORICAL_EXPLOIT_KB
ACCOUNTING_CHAOS_GENERATOR
MUTATION_SENSITIVITY_ENGINE
AUTOMATIC_COVERAGE_GAP_ANALYZER
RUNTIME_DEPLOYMENT_OVERLAY
```

Only `QUALIFIED_AVAILABLE` automation may replace a manual fallback obligation.

## Fallback mapping

| Future capability | Immediate v29 fallback |
|---|---|
| Six-layer Phase Plan/Queue | Current Phase Contract + Phase-6 subphase/subgate state + campaign ledger + exact v29 templates |
| Historical Exploit KB | `PHASE6_KNOWN_ATTACK_DISPOSITION.md` built-in attack-family checklist + Phase-3 hypotheses + Phase-4 candidates + auditor security reasoning |
| Accounting-chaos generator | Auditor fills `PHASE6_RANDOMIZED_ATTACK_CAMPAIGN_MATRIX.md` and implements target-specific stateful Medusa/Foundry handlers from existing skeletons |
| Mutation engine | Auditor creates audit-only mutant/fault-injected fixture or known-failing equivalent and fills `PHASE6_MUTATION_SENSITIVITY_REPORT.md` |
| Automatic coverage-gap analyzer | Auditor fills `PHASE6_COVERAGE_GAP_REPORT.md` from campaign metrics/coverage/property/actor/state/accounting/attack evidence |
| Runtime Deployment Overlay | Use exact current Phase-7/live evidence when needed; Phase 6 remains source/build/frozen-fork bound and carries runtime-only attacks to Phase 7 |

## Non-substitution

A fallback is an execution mode, not a weaker assurance mode. The same required disposition must be produced.

```text
AUTOMATION UNAVAILABLE != NOT_APPLICABLE
AUTOMATION UNAVAILABLE != SKIP
```

## Existing v28 campaign migration

Never restart completed work solely because the skill upgraded.

| Durable v28 Phase-6 state at adoption | v29 mapping |
|---|---|
| No P6.0 work | Start Phase 6A normally |
| P6.0 terminal; P6.1 not started | reviewer-3A backfills only new v29 design/accounting/attack-plan artifacts, seals 6A, hands off to 6B |
| P6.1–P6.6 active | Current reviewer is treated as reviewer-3B; preserve every terminal prior subgate; backfill only newly required accounting/known-attack/randomized-attack work not already evidenced |
| P6.1–P6.6 terminal; P6.7 not started | Seal 6B from existing Medusa evidence plus required v29 backfill, then hand off to fresh 6C |
| P6.7/P6.8 active | Current reviewer is treated as reviewer-3C; preserve terminal Medusa work; add only required v29 mutation/coverage/accounting reconciliation work |
| Phase 6 already sealed under v28 and Phase 7 started | Do not reopen Phase 6 merely because v29 exists; preserve the original admitted skill/process identity unless a separate typed invalidation/rework decision requires it |

Every migration records the prior skill version, current P6.* states, preserved evidence refs, newly introduced obligations, and exact no-repeat decision.
