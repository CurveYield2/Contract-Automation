# Phase 5 — Economic, Accounting, Mathematical & Procedural Retrace

> **CURRENT-PHASE READ BOUNDARY:** Read this card first. Do **not** open another phase folder. Open only the resource linked by the active step below; conditional resources are opened only when their trigger applies.

> **PHASE CONTRACT HARD GATE:** Before executing Step 1, open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json). It is the machine-readable contract for this phase: required inputs, ordered steps, outputs, global checkpoints, seal criteria, recovery routes, reviewer authority, and allowed next states. If this card and the contract appear inconsistent, stop phase progression and repair the packet/control inconsistency; do not choose the weaker requirement.

> **UNIVERSAL RULE IDS:** `U-EXEC-001`, `U-GITHUB-001`, `U-STATE-001`, `U-EVIDENCE-001`, `U-REPAIR-001`, `U-HUMAN-001`, `U-DISCLOSURE-001`, `U-SOURCEINTEL-001`, `U-UPDATES-001`, and `U-HUMANCOMMS-001` remain binding. Full normative text exists only in the [homepage](../../SKILL.md#universal-hard-rules); this phase card may add narrower requirements but must not redefine or weaken those rules.

> **SOURCE INTELLIGENCE REUSE GATE (`U-SOURCEINTEL-001`):** Before any active step that needs structural, runtime/deployment, or assurance-readiness facts, load the latest controller-accepted `SOURCE_INTELLIGENCE_BUNDLE_INDEX.json`; verify its committed index identity and every materially used component’s accepted revision, commit SHA, SHA-256, status, invalidation state, and exact source/build binding. A mutable path is navigation only. Reuse and verify accepted facts; **do not recreate Phase-1 inventories for orientation**. Raw source review remains mandatory for semantic reasoning, contradiction checks, reachability, reproduction, or remediation validation. On a mismatch, reject unaccepted bytes and apply the [Source Intelligence protocol](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) and Evidence Invalidation Matrix.

> **THIS PHASE REVIEWS:** functions, call/value-flow candidates, storage/accounting-relevant facts, external interfaces/dependencies, and source anchors relevant to economic/mathematical retrace.

## Phase card

| Step | Action | What to do | Open only when this step is active |
|---:|---|---|---|
| 1 | **Enter the isolated economic/accounting lens** | Bind exact source/revision and preserve lens isolation. | [SOLO_LENS_ISOLATION_PROTOCOL.md](../../shared/lenses/SOLO_LENS_ISOLATION_PROTOCOL.md) · [economic-accounting-lens.md](../../shared/lenses/economic-accounting-lens.md) |
| 2 | **Review economic correctness** | Model value flows, incentives, extraction paths, accounting conservation and adversarial economic states. | [economic-correctness.md](../../shared/domain-modules/economic-correctness.md) |
| 3 | **Verify contract mathematics** | Check units, bounds, rates, ratios, precision, rounding and edge behavior. | [mathematical-verification.md](../../shared/domain-modules/mathematical-verification.md) |
| 4 | **Review applicable vault/strategy economics** | Open only when triggered. | [domain-vaults-strategies.md](../../shared/domain-modules/domain-vaults-strategies.md) · [VAULT_STRATEGY_LEDGER.md](../../shared/domain-ledgers/VAULT_STRATEGY_LEDGER.md) |
| 5 | **Review applicable oracle economics** | Open only when triggered. | [domain-oracles.md](../../shared/domain-modules/domain-oracles.md) · [ORACLE_ASSURANCE_LEDGER.md](../../shared/domain-ledgers/ORACLE_ASSURANCE_LEDGER.md) |
| 6 | **Review applicable lending/liquidation economics** | Open only when triggered. | [domain-lending-liquidation.md](../../shared/domain-modules/domain-lending-liquidation.md) · [LENDING_LIQUIDATION_LEDGER.md](../../shared/domain-ledgers/LENDING_LIQUIDATION_LEDGER.md) |
| 7 | **Review applicable AMM/hook economics** | Open only when triggered. | [domain-amm-hooks.md](../../shared/domain-modules/domain-amm-hooks.md) · [AMM_HOOK_LEDGER.md](../../shared/domain-ledgers/AMM_HOOK_LEDGER.md) |
| 8 | **Review applicable staking/reward economics** | Open only when triggered. | [domain-staking-rewards.md](../../shared/domain-modules/domain-staking-rewards.md) · [STAKING_REWARD_LEDGER.md](../../shared/domain-ledgers/STAKING_REWARD_LEDGER.md) |
| 9 | **Perform the source-first procedural retrace** | Before reconciliation, use the restricted context packet and a procedural-independent source-first retrace; do not describe it as actor independence. | [procedural-independent-review-lens.md](../../shared/lenses/procedural-independent-review-lens.md) · [SOLO_LENS_ISOLATION_PROTOCOL.md](../../shared/lenses/SOLO_LENS_ISOLATION_PROTOCOL.md) |
| 10 | **Reconcile retrace against Phases 2–4** | Classify prior conclusions CONFIRMED / CONTRADICTED / NEW / UNRESOLVED and identify handoff-critical state. | [PHASE5_RETRACE_RECONCILIATION_MATRIX.md](resources/PHASE5_RETRACE_RECONCILIATION_MATRIX.md) · [SEVERITY_CALIBRATION.md](../../shared/policy/SEVERITY_CALIBRATION.md) |
| 11 | **Reconcile campaign-global security state** | Update the canonical Security Traceability Graph for this phase, enumerate and reconcile every obligation due now, add stable OBL-* records for new later-phase work, and freeze current graph/ledger digests for the Phase Report. An OPEN/IN_PROGRESS obligation due in this phase blocks sealing. Classify every material observed change under the Evidence Invalidation Matrix before reusing affected evidence. | [SECURITY_TRACEABILITY_GRAPH.json](../../shared/controller/SECURITY_TRACEABILITY_GRAPH.json) · [CARRIED_FORWARD_OBLIGATION_LEDGER.json](../../shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json) · [EVIDENCE_INVALIDATION_MATRIX.json](../../shared/controller/EVIDENCE_INVALIDATION_MATRIX.json) |
| 12 | **File the Phase 5 report and stop for response** | Seal Phase 5, reference the reconciliation digest, submit the report, enter `AUTO_ADVANCE_READY` and do not create the successor handoff yet. | [PHASE_REPORT.md](../../shared/reporting/PHASE_REPORT.md) · [AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md](../../shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md) |
| 13 | **File the Phase 5 report and trigger automatic successor handoff** | Seal Phase 5, reference the reconciliation/global-state digests, file the Phase Report, enter AUTO_ADVANCE_READY, and immediately build the P5_TO_P6 successor package. No human approval is required. | [PHASE_REPORT.md](../../shared/reporting/PHASE_REPORT.md) · [AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md](../../shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md) |
| 14 | **Create the P5_TO_P6A successor package automatically** | Immediately after Phase-5 seal/report, create campaign-local handoffs/P5_TO_P6/SUCCESSOR_HANDOFF.json, START_HERE_SUCCESSOR.md and WAKE_UP_MESSAGE.md. Route the fresh successor to Phase 6A reviewer-3A. Enter WAITING_FOR_SUCCESSOR_AGENT; do not execute Phase 6A. | [SOLO_WORKFLOW_STATE_MACHINE.json](../../shared/controller/SOLO_WORKFLOW_STATE_MACHINE.json) |
## Audit-module resources in this phase

- [`economic-correctness`](../../shared/domain-modules/economic-correctness.md)
- [`mathematical-verification`](../../shared/domain-modules/mathematical-verification.md)
- [`domain-vaults-strategies`](../../shared/domain-modules/domain-vaults-strategies.md)
- [`domain-oracles`](../../shared/domain-modules/domain-oracles.md)
- [`domain-lending-liquidation`](../../shared/domain-modules/domain-lending-liquidation.md)
- [`domain-amm-hooks`](../../shared/domain-modules/domain-amm-hooks.md)
- [`domain-staking-rewards`](../../shared/domain-modules/domain-staking-rewards.md)

## Preserved phase rules

> **READ ONLY FOR THE CURRENT SOLO PHASE.** This file is supporting audit methodology, not authority to self-advance.

## V7 runtime use

1. Use this support only while controller state is the matching phase and `ACTIVE`.
2. Apply every embedded method relevant to the target. Explicitly record applicability; when uncertain, include the method rather than silently dropping coverage.
3. The same Phase-2–5 reviewer (`reviewer-2`) executes all role concepts. Any V6.1 `Agent N`, worker, coordinator, or independent-review actor name inside preserved embedded methodology is an **audit lens label**, not a separate actor.
4. Preserve exact source/evidence identity and typed limitations.
5. Complete the mandatory structured filing, seal Phase-5 evidence, file the Phase Report, then immediately create/seal the `P5_TO_P6` successor handoff + wake-up message and enter `WAITING_FOR_SUCCESSOR_AGENT`. Fresh `reviewer-3A` receives Phase 6A; no human approval is required.

## Authorization

Authorization comes from the controller's exact current phase/revision/source binding plus automatic controller advancement from the sealed previous phase. There is no mailbox, worker lease, numbered-agent bootstrap, or unvalidated advancement path.


## Mandatory successor wake-up delivery

This phase ends at the `P5_TO_P6` fresh-reviewer boundary. After the required Phase Report and successful automatic seal authorization, create the generic successor handoff and bootstrap, seal the underlying handoff content, generate campaign-local `handoffs/P5_TO_P6/WAKE_UP_MESSAGE.md` from [`WAKE_UP_MESSAGE_TEMPLATE.md`](../../shared/handoff/WAKE_UP_MESSAGE_TEMPLATE.md), validate that it contains immutable 40-character-commit URLs and no placeholders, and then give the human its **exact contents in a separate standalone fenced `text` copy block** headed `WAKE UP MESSAGE FOR REPLACEMENT AGENT`. The human must not need to add or explain anything. The outgoing reviewer may not enter the successor phase.

## Mandatory end-of-phase structured filing

Before this phase may enter `EVIDENCE_SEALED`, complete `phases/phase-5/resources/PHASE5_RETRACE_RECONCILIATION_MATRIX.md` as the canonical **Phase 5 Retrace Reconciliation Matrix**, bind it to the exact phase/source identity, and record its durable reference/digest in `shared/reporting/PHASE_REPORT.md`. Do not substitute narrative prose for the structured artifact. Use explicit `NOT_APPLICABLE`/typed limitation states rather than blanks where a field or row does not apply.

The Phase Report must also complete the **Source Intelligence checkpoint**, including the accepted Bundle Index revision/commit/digest, every materially used component revision/commit/digest/status/invalidation state, reuse or regeneration status, and the relevant sections materially reviewed in this phase. The Phase Report must also complete the universal sections **Canonical outputs created**, **New canonical audit facts**, **Carried-forward obligations**, and **Evidence invalidation triggers**. It must classify every material observed change under the Evidence Invalidation Matrix and record `NO_MATERIAL_CHANGE_EVENT` when none occurred. It must additionally record the current campaign-local **Security Traceability Graph** reference/digest and **Carried-Forward Obligation Ledger** reference/digest. Before sealing, reconcile every obligation due in this phase; an `OPEN` or `IN_PROGRESS` due obligation forbids `EVIDENCE_SEALED`. The carried-forward obligations table in the Phase Report is a projection of the canonical ledger, not a separate source of truth.

### Shared embedded-module gate rule

A conclusion may satisfy a gate only when it is bound to the exact source commit and its required evidence is accepted by a separate reviewer or the controller.

### Shared embedded-module common mistakes

- Treating confidence or prose as execution evidence.
- Omitting an unresolved assumption from the output.
- Reusing evidence from a different source, request, profile, or release.
