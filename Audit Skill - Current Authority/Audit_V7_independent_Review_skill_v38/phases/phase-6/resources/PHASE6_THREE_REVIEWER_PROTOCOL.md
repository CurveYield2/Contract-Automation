# Phase 6 Three-Reviewer Protocol v1

Phase 6 is one numbered audit phase executed by **three mandatory fresh agents**.

```text
6A reviewer-3A — assurance design, accounting/attack plan, P6.0 admission
→ P6A_TO_P6B handoff
6B reviewer-3B — Medusa primary adversarial execution, P6.1–P6.6
→ P6B_TO_P6C handoff
6C reviewer-3C — independent Foundry, mutation/coverage closure, P6.7–P6.8
→ P6_TO_P7 handoff
```

## Internal seals

```text
P6A_ASSURANCE_DESIGN_SEALED
P6B_MEDUSA_EVIDENCE_SEALED
P6C_PHASE6_FINAL_SEALED
```

No human approval is required between them. Each outgoing subreviewer files `PHASE6_SUBPHASE_REPORT.md`, builds the exact successor package/wake-up message immediately, enters `WAITING_FOR_SUCCESSOR_AGENT`, gives the human the report + copy-ready wake-up block, then stops.

## No-repeat rule

Each successor consumes sealed predecessor artifacts. It may repair invalid evidence or execute explicit carried work, but must not repeat completed campaigns merely to understand context.

## Ownership of existing subgates

```text
6A: P6.0
6B: P6.1, P6.2, P6.3, P6.4, P6.5, P6.6
6C: P6.7, P6.8
```

All existing Process 1–11 semantics remain normative.
