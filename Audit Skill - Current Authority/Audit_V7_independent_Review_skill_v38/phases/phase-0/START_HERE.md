# Phase 0 — Audit Admission, Source Identity & Capability Preflight

> **CURRENT-PHASE READ BOUNDARY:** Read this card first. Do **not** open another phase folder. Open only the resource linked by the active step below; conditional resources are opened only when their trigger applies.

> **PHASE CONTRACT HARD GATE:** Before executing Step 1, open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json). It is the machine-readable contract for this phase: required inputs, ordered steps, outputs, global checkpoints, seal criteria, recovery routes, reviewer authority, and allowed next states. If this card and the contract appear inconsistent, stop phase progression and repair the packet/control inconsistency; do not choose the weaker requirement.

> **UNIVERSAL RULE IDS:** `U-EXEC-001`, `U-GITHUB-001`, `U-STATE-001`, `U-EVIDENCE-001`, `U-REPAIR-001`, `U-HUMAN-001`, `U-DISCLOSURE-001`, `U-SOURCEINTEL-001`, `U-UPDATES-001`, and `U-HUMANCOMMS-001` remain binding. Full normative text exists only in the [homepage](../../SKILL.md#universal-hard-rules); this phase card may add narrower requirements but must not redefine or weaken those rules.

## Phase card

| Step | Action | What to do | Open only when this step is active |
|---:|---|---|---|
| 1 | **Resolve or create the exact campaign** | Use the GitHub connector app only. Follow the homepage campaign-routing procedure; bind exact campaign generation, workspace path, controller branch and source identity. | [AUDIT_CONTROLLER_AND_GITHUB_PROTOCOL.md](../../shared/controller/AUDIT_CONTROLLER_AND_GITHUB_PROTOCOL.md) |
| 2 | **Admit and inventory the source** | Mechanically stage/inventory the exact source without semantic conclusions; preserve repository/commit or archive digest and extraction evidence. | [SOLO_AUDIT_STATE.json](../../shared/controller/SOLO_AUDIT_STATE.json) |
| 3 | **Prove instruction and capability readiness** | Actively prove the GitHub connector can perform a minimal read against both required repositories (`CurveYield2/Audit-Controller` and `CurveYield2/Contract-Automation`), then record controller/GitHub, build/analyzer, fuzz/simulation, durable evidence, and reporting capability. A connected-app status alone is not sufficient proof. | [PHASE0_CAPABILITY_PREFLIGHT.md](resources/PHASE0_CAPABILITY_PREFLIGHT.md) · [GITHUB_ACTIONS_VIA_GITHUB_APP.md](../../shared/execution/GITHUB_ACTIONS_VIA_GITHUB_APP.md) · [INSTRUCTION_READ_PROOF.json](resources/INSTRUCTION_READ_PROOF.json) |
| 4 | **Seal Phase 0 state** | Bind reviewer-1, source fence, current phase/revision and every typed limitation. | [SOLO_WORKFLOW_STATE_MACHINE.json](../../shared/controller/SOLO_WORKFLOW_STATE_MACHINE.json) |
| 5 | **Reconcile campaign-global security state** | Update the canonical Security Traceability Graph for this phase, enumerate and reconcile every obligation due now, add stable OBL-* records for new later-phase work, and freeze current graph/ledger digests for the Phase Report. An OPEN/IN_PROGRESS obligation due in this phase blocks sealing. Classify every material observed change under the Evidence Invalidation Matrix before reusing affected evidence. | [SECURITY_TRACEABILITY_GRAPH.json](../../shared/controller/SECURITY_TRACEABILITY_GRAPH.json) · [CARRIED_FORWARD_OBLIGATION_LEDGER.json](../../shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json) · [EVIDENCE_INVALIDATION_MATRIX.json](../../shared/controller/EVIDENCE_INVALIDATION_MATRIX.json) |
| 6 | **File the phase report and auto-advance** | Seal the required structured artifact/global checkpoints, file the immutable Phase Report, enter AUTO_ADVANCE_READY, and immediately continue into the next same-reviewer phase under the Automatic Phase Advancement Protocol. Do not wait for human approval. | [PHASE_REPORT.md](../../shared/reporting/PHASE_REPORT.md) · [AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md](../../shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md) |
## Audit-module resources in this phase

- No separate embedded audit-module files for this phase.

## Preserved phase rules

> **READ ONLY FOR PHASE 0.**

## Objective

Admit the exact engagement, source, controller, capabilities, evidence path, and Phase-0–1 reviewer (`reviewer-1`) identity without performing premature semantic audit conclusions.


## Mandatory end-of-phase structured filing

Before this phase may enter `EVIDENCE_SEALED`, complete `phases/phase-0/resources/PHASE0_CAPABILITY_PREFLIGHT.md` as the canonical **Phase 0 Capability Preflight**, bind it to the exact phase/source identity, and record its durable reference/digest in `shared/reporting/PHASE_REPORT.md`. Do not substitute narrative prose for the structured artifact. Use explicit `NOT_APPLICABLE`/typed limitation states rather than blanks where a field or row does not apply.

The Phase Report must also complete the universal sections **Canonical outputs created**, **New canonical audit facts**, **Carried-forward obligations**, and **Evidence invalidation triggers**. It must classify every material observed change under the Evidence Invalidation Matrix and record `NO_MATERIAL_CHANGE_EVENT` when none occurred. It must additionally record the current campaign-local **Security Traceability Graph** reference/digest and **Carried-Forward Obligation Ledger** reference/digest. Before sealing, reconcile every obligation due in this phase; an `OPEN` or `IN_PROGRESS` due obligation forbids `EVIDENCE_SEALED`. The carried-forward obligations table in the Phase Report is a projection of the canonical ledger, not a separate source of truth.

## Required work

- Pin campaign token/generation and source identity.
- Mechanically stage/inventory source using the controller-supported GitHub Git Data or uploaded-source route.
- Record repository/commit or source ZIP digest and extraction/inventory evidence.
- Run capability preflight for controller/GitHub, exact build/analyzer, fuzz/simulation path, durable evidence, and report/publication path. GitHub capability admission MUST include successful live connector reads against both required repositories; merely observing that the app is configured/connected is insufficient.
- Establish Phase-0–1 reviewer (`reviewer-1`) identity and applicable instruction-read proof.
- Run harmless report/publication smoke when the active controller requires it.
- Create initial phase state and fencing metadata.
- Generate the Phase-0 report, enter `AUTO_ADVANCE_READY`, and immediately continue to Phase 1 after seal validation.

No numbered agents, workers, mailboxes, replacement actors, or polls are created.

