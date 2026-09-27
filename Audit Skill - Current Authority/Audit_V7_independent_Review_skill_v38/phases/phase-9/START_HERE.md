# Phase 9 — Remediation & Regression Review

> **CURRENT-PHASE READ BOUNDARY:** Read this card first. Do **not** open another phase folder. Open only the resource linked by the active step below; conditional resources are opened only when their trigger applies.

> **PHASE CONTRACT HARD GATE:** Before executing Step 1, open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json). It is the machine-readable contract for this phase: required inputs, ordered steps, outputs, global checkpoints, seal criteria, recovery routes, reviewer authority, and allowed next states. If this card and the contract appear inconsistent, stop phase progression and repair the packet/control inconsistency; do not choose the weaker requirement.

> **UNIVERSAL RULE IDS:** `U-EXEC-001`, `U-GITHUB-001`, `U-STATE-001`, `U-EVIDENCE-001`, `U-REPAIR-001`, `U-HUMAN-001`, `U-DISCLOSURE-001`, `U-SOURCEINTEL-001`, `U-UPDATES-001`, and `U-HUMANCOMMS-001` remain binding. Full normative text exists only in the [homepage](../../SKILL.md#universal-hard-rules); this phase card may add narrower requirements but must not redefine or weaken those rules.

> **SOURCE INTELLIGENCE REUSE GATE (`U-SOURCEINTEL-001`):** Before any active step that needs structural, runtime/deployment, or assurance-readiness facts, load the latest controller-accepted `SOURCE_INTELLIGENCE_BUNDLE_INDEX.json`; verify its committed index identity and every materially used component’s accepted revision, commit SHA, SHA-256, status, invalidation state, and exact source/build binding. A mutable path is navigation only. Reuse and verify accepted facts; **do not recreate Phase-1 inventories for orientation**. Raw source review remains mandatory for semantic reasoning, contradiction checks, reachability, reproduction, or remediation validation. On a mismatch, reject unaccepted bytes and apply the [Source Intelligence protocol](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) and Evidence Invalidation Matrix.

> **THIS PHASE REVIEWS:** the latest accepted bundle for the exact current source/build. A remediation source/build change requires a new immutable core, affected overlay rebind/replacement, and a newly accepted bundle-index revision before structural/runtime/readiness facts are reused.

## Phase card

| Step | Action | What to do | Open only when this step is active |
|---:|---|---|---|
| 1 | **Open the P8_TO_P9 successor bootstrap and verify the handoff** | Use the GitHub connector app inside the exact campaign workspace. Exhaust the recovery ladder before any blocker message. | [SUCCESSOR_HANDOFF_RECEPTION_CHECKLIST.md](../../shared/handoff/SUCCESSOR_HANDOFF_RECEPTION_CHECKLIST.md) · [SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json](../../shared/handoff/SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json) · [SUCCESSOR_HANDOFF_RECEIPT_TEMPLATE.json](../../shared/handoff/SUCCESSOR_HANDOFF_RECEIPT_TEMPLATE.json) · [SUCCESSOR_HANDOFF_PROTOCOL.md](../../shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md) |
| 2 | **Bind remediation delta and refresh the Source Intelligence bundle when required** | Bind old/new immutable source identities. If production source/build changed, **fill a new Source Intelligence version**, rebind/replace affected overlays, validate/commit them, and accept a new bundle-index revision before regression review. Compare old/new affected facts and preserve all prior revisions. If no remediation exists, record NO_REMEDIATION_ARTIFACTS_REQUIRED and reuse the matching accepted bundle. | [PHASE9_REMEDIATION_DELTA_LEDGER.md](resources/PHASE9_REMEDIATION_DELTA_LEDGER.md) · [SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) · [SOURCE_INTELLIGENCE_TEMPLATE.json](../../shared/source-intelligence/SOURCE_INTELLIGENCE_TEMPLATE.json) |
| 3 | **Review remediation semantics** | Verify the fix addresses the validated root cause without weakening unrelated guarantees. | [remediation-review.md](../../shared/domain-modules/remediation-review.md) |
| 4 | **Challenge independence/correlation** | Do not overstate repeated same-agent or shared-harness evidence as independent. | [ai-review-independence.md](../../shared/domain-modules/ai-review-independence.md) |
| 5 | **Re-evaluate risk/severity** | Confirm whether remediation changes reachability, impact or final finding disposition. | [security-risk-grading.md](../../shared/domain-modules/security-risk-grading.md) · [SEVERITY_CALIBRATION.md](../../shared/policy/SEVERITY_CALIBRATION.md) |
| 6 | **Regression-review implementation** | Use the accepted current-source Source Intelligence as the structural baseline, then retest affected functions, invariants, integrations and regression surfaces against exact revised source. Do not rebuild unaffected structural inventories. | [evm-contract-review.md](../../shared/domain-modules/evm-contract-review.md) · [GITHUB_ACTIONS_VIA_GITHUB_APP.md](../../shared/execution/GITHUB_ACTIONS_VIA_GITHUB_APP.md) |
| 7 | **Regression-review economics/accounting** | Retest affected economic/accounting invariants where applicable. | [economic-correctness.md](../../shared/domain-modules/economic-correctness.md) |
| 8 | **Reconcile invalidated and replacement evidence** | List stale evidence invalidated by the source delta, exact reruns, replacement evidence, residual risk and final finding states. | [PHASE9_REMEDIATION_DELTA_LEDGER.md](resources/PHASE9_REMEDIATION_DELTA_LEDGER.md) · [EVIDENCE_INVALIDATION_MATRIX.json](../../shared/controller/EVIDENCE_INVALIDATION_MATRIX.json) |
| 9 | **Reconcile campaign-global security state** | Update the canonical Security Traceability Graph for this phase, enumerate and reconcile every obligation due now, add stable OBL-* records for new later-phase work, and freeze current graph/ledger digests for the Phase Report. An OPEN/IN_PROGRESS obligation due in this phase blocks sealing. Classify every material observed change under the Evidence Invalidation Matrix before reusing affected evidence. | [SECURITY_TRACEABILITY_GRAPH.json](../../shared/controller/SECURITY_TRACEABILITY_GRAPH.json) · [CARRIED_FORWARD_OBLIGATION_LEDGER.json](../../shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json) · [EVIDENCE_INVALIDATION_MATRIX.json](../../shared/controller/EVIDENCE_INVALIDATION_MATRIX.json) |
| 10 | **File the phase report and auto-advance** | Seal the required structured artifact/global checkpoints, file the immutable Phase Report, enter AUTO_ADVANCE_READY, and immediately continue into the next same-reviewer phase under the Automatic Phase Advancement Protocol. Do not wait for human approval. | [PHASE_REPORT.md](../../shared/reporting/PHASE_REPORT.md) · [AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md](../../shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md) |
## Audit-module resources in this phase

- [`remediation-review`](../../shared/domain-modules/remediation-review.md)
- [`ai-review-independence`](../../shared/domain-modules/ai-review-independence.md)
- [`security-risk-grading`](../../shared/domain-modules/security-risk-grading.md)
- [`evm-contract-review`](../../shared/domain-modules/evm-contract-review.md)
- [`economic-correctness`](../../shared/domain-modules/economic-correctness.md)

## Preserved phase rules

> **READ ONLY FOR THE CURRENT SOLO PHASE.** This file is supporting audit methodology, not authority to self-advance.

## V7 runtime use

1. Use this support only while controller state is the matching phase and `ACTIVE`.
2. Apply every embedded method relevant to the target. Explicitly record applicability; when uncertain, include the method rather than silently dropping coverage.
3. A fresh `reviewer-5` executes Phases 9–10 and all role concepts required inside those phases. Any V6.1 `Agent N`, worker, coordinator, or independent-review actor name inside preserved embedded methodology is an **audit lens label**, not an additional actor.
4. Preserve exact source/evidence identity and typed limitations.
5. Complete the mandatory structured filing, seal required evidence, file `shared/reporting/PHASE_REPORT.md`, enter `AUTO_ADVANCE_READY`, and immediately continue to the next same-reviewer phase. Do not wait for human approval.

## Authorization

Authorization requires the exact current phase/revision/source binding, automatic Phase-8 successor-boundary authorization and an accepted campaign-local `handoffs/P8_TO_P9/SUCCESSOR_HANDOFF_RECEIPT.json` bound to fresh `reviewer-5`. There is no mailbox, worker lease, numbered-agent bootstrap, or unvalidated advancement path.


## Mandatory end-of-phase structured filing

Before this phase may enter `EVIDENCE_SEALED`, complete `phases/phase-9/resources/PHASE9_REMEDIATION_DELTA_LEDGER.md` as the canonical **Phase 9 Remediation Delta Ledger**, bind it to the exact phase/source identity, and record its durable reference/digest in `shared/reporting/PHASE_REPORT.md`. Do not substitute narrative prose for the structured artifact. Use explicit `NOT_APPLICABLE`/typed limitation states rather than blanks where a field or row does not apply.

If no fixes are supplied or required, the remediation ledger still must be completed with `NO_REMEDIATION_ARTIFACTS_REQUIRED` and an evidence-bound reason.

The Phase Report must also complete the **Source Intelligence checkpoint**, including the accepted Bundle Index revision/commit/digest, every materially used component revision/commit/digest/status/invalidation state, reuse or regeneration status, and the relevant sections materially reviewed in this phase. The Phase Report must also complete the universal sections **Canonical outputs created**, **New canonical audit facts**, **Carried-forward obligations**, and **Evidence invalidation triggers**. It must classify every material observed change under the Evidence Invalidation Matrix and record `NO_MATERIAL_CHANGE_EVENT` when none occurred. It must additionally record the current campaign-local **Security Traceability Graph** reference/digest and **Carried-Forward Obligation Ledger** reference/digest. Before sealing, reconcile every obligation due in this phase; an `OPEN` or `IN_PROGRESS` due obligation forbids `EVIDENCE_SEALED`. The carried-forward obligations table in the Phase Report is a projection of the canonical ledger, not a separate source of truth.

### Shared embedded-module gate rule

A conclusion may satisfy a gate only when it is bound to the exact source commit and its required evidence is accepted by a separate reviewer or the controller.

### Shared embedded-module common mistakes

- Treating confidence or prose as execution evidence.
- Omitting an unresolved assumption from the output.
- Reusing evidence from a different source, request, profile, or release.
