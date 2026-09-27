# Phase 6A — Dynamic Assurance Design, Accounting Model & Harness Admission

> **CURRENT-SUBPHASE READ BOUNDARY:** Read the Phase-6 router first, then this card. Do not preload 6B/6C. You are `reviewer-3A` only.

> **COMPATIBILITY HARD RULE:** Open `../../resources/PHASE6_V29_COMPATIBILITY_AND_FALLBACK.md`. Future automation is optional until qualified; required assurance is not optional.

## Phase card

| Step | Action | What to do | Open only when active |
|---:|---|---|---|
| 1 | **Receive P5_TO_P6 and bind reviewer-3A** | Verify exact handoff/receipt, Source Intelligence bundle-index commit/digest, pinned core/readiness revisions, source/build/global state and migration state. | [Handoff protocol](../../../../shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md) · [Source Intelligence protocol](../../../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) · [Migration/fallback](../../resources/PHASE6_V29_COMPATIBILITY_AND_FALLBACK.md) |
| 2 | **Initialize Phase-6 reviewer/subgate state** | Set 6A ACTIVE and preserve any valid migrated P6.* terminal state. | [Reviewer state](../../resources/PHASE6_REVIEWER_STATE.json) · [Subgate state](../../resources/PHASE6_SUBGATE_STATE.json) |
| 3 | **Build the complete Dynamic Assurance Plan** | Fill every assurance track; no future engine may be assumed available without qualification evidence. | [Dynamic Assurance Plan](../../resources/PHASE6_DYNAMIC_ASSURANCE_PLAN.md) |
| 4 | **Build the Accounting Assurance Model** | Required by default for value/accounting-bearing DeFi targets; explicit evidence-backed N/A only. | [Accounting model](../../resources/PHASE6_ACCOUNTING_ASSURANCE_MODEL.md) |
| 5 | **Design randomized accounting attacks and known-attack dispositions** | Fill both independent plans. Use qualified KB if available; otherwise built-in fallback taxonomy. | [Randomized attack matrix](../../resources/PHASE6_RANDOMIZED_ATTACK_CAMPAIGN_MATRIX.md) · [Known attacks](../../resources/PHASE6_KNOWN_ATTACK_DISPOSITION.md) |
| 6 | **Execute P6.0 and accept the readiness-overlay revision** | Start from the accepted Phase-1 readiness inventory. Validate adequacy, create/repair only what is required, bind every changed tool/harness/config/skeleton identity, validate/commit the new overlay revision, classify `EIM-015`, update the bundle index, and prove Medusa readiness. Do not redo Phase-1 discovery. | [P6.0](../../resources/subgates/P6_0_PREFLIGHT.md) · [Harness requirements](../../resources/PHASE6_FUZZ_HARNESS_REQUIREMENTS.md) · [Readiness overlay](../../../../shared/source-intelligence/ASSURANCE_READINESS_OVERLAY_TEMPLATE.json) |
| 7 | **Seal 6A and hand off automatically** | File subphase report; P6.0 + design artifacts must be terminal. Create P6A_TO_P6B handoff/wake-up immediately and enter WAITING_FOR_SUCCESSOR_AGENT. | [Subphase report](../../resources/PHASE6_SUBPHASE_REPORT.md) · [Three-reviewer protocol](../../resources/PHASE6_THREE_REVIEWER_PROTOCOL.md) |
