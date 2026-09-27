# Phase 6 — Three-Agent Comprehensive Dynamic Assurance

> **CURRENT-PHASE READ BOUNDARY:** Read this router first. Do not preload another numbered phase or a different Phase-6 subphase. Resolve the durable `PHASE6_REVIEWER_STATE.json`, then open only the current 6A/6B/6C card.

> **PHASE CONTRACT HARD GATE:** Open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json) before routing. It preserves all existing P6.0–P6.8 / Process-1–11 requirements and adds the fresh 6A→6B→6C boundaries.

> **UNIVERSAL RULE IDS:** `U-EXEC-001`, `U-GITHUB-001`, `U-STATE-001`, `U-EVIDENCE-001`, `U-REPAIR-001`, `U-HUMAN-001`, `U-DISCLOSURE-001`, `U-SOURCEINTEL-001`, `U-UPDATES-001`, and `U-HUMANCOMMS-001` remain binding. `U-HUMAN-001` now means automatic post-seal advancement; no `CONTINUE` response is required.

> **NO PROCESS LOSS:** Existing Processes 1–11 and P6.0–P6.8 remain normative. v29 adds accounting assurance, randomized accounting-chaos attacks, known-attack disposition, mutation sensitivity and multidimensional coverage closure. Nothing from v28 Phase 6 is removed.

> **BACKWARD COMPATIBILITY:** If future six-layer/attack-engine automation is not qualified yet, use the exact manual fallback artifacts. Do not block or skip the audit because future automation is absent.

> **SOURCE INTELLIGENCE REUSE GATE (`U-SOURCEINTEL-001`):** Load the latest controller-accepted `SOURCE_INTELLIGENCE_BUNDLE_INDEX.json`; verify its committed identity and the pinned core/readiness component revision, commit SHA, SHA-256, status, invalidation state and exact source/build binding. A mutable path is navigation only. **Do not recreate or rebuild Phase-1 structural/readiness inventories for orientation.** Phase 6A validates adequacy and accepts a new readiness-overlay revision after repair; 6B/6C consume only that accepted revision. Raw source review remains mandatory for semantic reasoning, harness design, reachability and counterexample analysis.

> **THIS PHASE REVIEWS:** accepted Source Intelligence functions/selectors/call-interface mappings/source anchors/compiler artifacts/static candidates plus the accepted assurance-readiness overlay. Phase 6A owns adequacy validation/repair and accepts the next overlay revision; 6B/6C must not repeat its inventory/admission work.

## Phase card

| Step | Action | What to do | Open only when this step is active |
|---:|---|---|---|
| 1 | **Resolve Phase-6 migration/current subreviewer** | Load exact P6.* durable state. Apply the v28→v29 no-repeat migration table when upgrading an in-flight campaign. | [Compatibility/fallback](resources/PHASE6_V29_COMPATIBILITY_AND_FALLBACK.md) · [Reviewer state](resources/PHASE6_REVIEWER_STATE.json) |
| 2 | **Execute Phase 6A with fresh reviewer-3A** | Design complete dynamic assurance, accounting/attack plans, admit harnesses and complete P6.0. | [Phase 6A →](subphases/phase-6A/START_HERE.md) |
| 3 | **Seal 6A and create P6A_TO_P6B automatically** | File the 6A subphase report and wake-up package immediately; no human approval. reviewer-3A stops. | [Three-reviewer protocol](resources/PHASE6_THREE_REVIEWER_PROTOCOL.md) · [Handoff profiles](../../shared/handoff/SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json) |
| 4 | **Execute Phase 6B with fresh reviewer-3B** | Consume 6A and execute P6.1–P6.6 Medusa primary adversarial work, including randomized accounting and applicable known attacks. | [Phase 6B →](subphases/phase-6B/START_HERE.md) |
| 5 | **Seal 6B and create P6B_TO_P6C automatically** | Seal terminal Medusa evidence, file 6B subphase report and wake-up package; reviewer-3B stops. | [Three-reviewer protocol](resources/PHASE6_THREE_REVIEWER_PROTOCOL.md) |
| 6 | **Execute Phase 6C with fresh reviewer-3C** | Consume terminal Medusa evidence, execute independent Foundry P6.7, mutation sensitivity, coverage closure and P6.8 reconciliation. | [Phase 6C →](subphases/phase-6C/START_HERE.md) |
| 7 | **Reconcile campaign-global security state and file final Phase-6 report** | Close all Phase-6 obligations, reconcile invalidation/domain/traceability state, seal final summary and file Phase Report. | [Phase report](../../shared/reporting/PHASE_REPORT.md) · [Auto advancement](../../shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md) |
| 8 | **Create P6_TO_P7 successor package automatically** | Immediately create/seal successor handoff/start/wake-up artifacts for fresh reviewer-4. No human approval is required. | [Handoff protocol](../../shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md) |
| 9 | **Enter WAITING_FOR_SUCCESSOR_AGENT and stop** | reviewer-3C MUST NOT execute Phase 7. Fresh reviewer-4 accepts the P6_TO_P7 handoff. | [Workflow state machine](../../shared/controller/SOLO_WORKFLOW_STATE_MACHINE.json) |

## Technical execution routing

All GitHub Actions used by Phase 6 route through [GITHUB_ACTIONS_VIA_GITHUB_APP.md](../../shared/execution/GITHUB_ACTIONS_VIA_GITHUB_APP.md) and the existing Contract-Automation execution/preflight paths.

## Existing Process 1–11 ownership

```text
6A / P6.0: execution admission + complete campaign/accounting/attack design
6B / P6.1–P6.6: Processes 1–11 Medusa-side requirements and trigger decisions
6C / P6.7–P6.8: independent Foundry continuation, Process-5 Foundry refinement, final Process 1–11 reconciliation
```

## V7 runtime use

The current subreviewer executes only its subphase. Completed predecessor subphases are sealed inputs. A future automated Phase Plan/KB/chaos/mutation/coverage system may populate or accelerate the same required artifacts only after it is qualified; until then, the manual templates in `resources/` are authoritative operational fallbacks.
