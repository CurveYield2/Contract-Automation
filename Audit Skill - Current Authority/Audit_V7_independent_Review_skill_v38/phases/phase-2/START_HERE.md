# Phase 2 — Security Specification & Properties

> **CURRENT-PHASE READ BOUNDARY:** Read this card first. Do **not** open another phase folder. Open only the resource linked by the active step below; conditional resources are opened only when their trigger applies.

> **PHASE CONTRACT HARD GATE:** Before executing Step 1, open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json). It is the machine-readable contract for this phase: required inputs, ordered steps, outputs, global checkpoints, seal criteria, recovery routes, reviewer authority, and allowed next states. If this card and the contract appear inconsistent, stop phase progression and repair the packet/control inconsistency; do not choose the weaker requirement.

> **UNIVERSAL RULE IDS:** `U-EXEC-001`, `U-GITHUB-001`, `U-STATE-001`, `U-EVIDENCE-001`, `U-REPAIR-001`, `U-HUMAN-001`, `U-DISCLOSURE-001`, `U-SOURCEINTEL-001`, `U-UPDATES-001`, and `U-HUMANCOMMS-001` remain binding. Full normative text exists only in the [homepage](../../SKILL.md#universal-hard-rules); this phase card may add narrower requirements but must not redefine or weaken those rules.

> **SOURCE INTELLIGENCE REUSE GATE (`U-SOURCEINTEL-001`):** Before any active step that needs structural, runtime/deployment, or assurance-readiness facts, load the latest controller-accepted `SOURCE_INTELLIGENCE_BUNDLE_INDEX.json`; verify its committed index identity and every materially used component’s accepted revision, commit SHA, SHA-256, status, invalidation state, and exact source/build binding. A mutable path is navigation only. Reuse and verify accepted facts; **do not recreate Phase-1 inventories for orientation**. Raw source review remains mandatory for semantic reasoning, contradiction checks, reachability, reproduction, or remediation validation. On a mismatch, reject unaccepted bytes and apply the [Source Intelligence protocol](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) and Evidence Invalidation Matrix.

> **THIS PHASE REVIEWS:** contracts, functions, storage, external interfaces, value-flow candidates, compiler artifacts, and neutral static recon needed to derive security properties and risk assumptions.

## Phase card

| Step | Action | What to do | Open only when this step is active |
|---:|---|---|---|
| 1 | **Open the P1_TO_P2 successor bootstrap and verify the handoff** | Verify the exact campaign/source identity, accepted Source Intelligence Bundle, sealed Phase-1 risk-grade manifest and fresh `reviewer-2` receipt before specification work. | [SUCCESSOR_HANDOFF_RECEPTION_CHECKLIST.md](../../shared/handoff/SUCCESSOR_HANDOFF_RECEPTION_CHECKLIST.md) · [SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json](../../shared/handoff/SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json) · [SUCCESSOR_HANDOFF_RECEIPT_TEMPLATE.json](../../shared/handoff/SUCCESSOR_HANDOFF_RECEIPT_TEMPLATE.json) · [SUCCESSOR_HANDOFF_PROTOCOL.md](../../shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md) |
| 2 | **Enter the fresh isolated specification lens** | Bind the exact Phase 2 source/revision and preserve fresh-reviewer lens isolation. Accept the inherited risk grade as the starting control; promote it if new evidence increases risk and never silently reduce it. | [SOLO_LENS_ISOLATION_PROTOCOL.md](../../shared/lenses/SOLO_LENS_ISOLATION_PROTOCOL.md) · [scope-specification-lens.md](../../shared/lenses/scope-specification-lens.md) |
| 3 | **Convert intent into auditable requirements** | Define actors, assets, units, transitions, negative requirements, trust assumptions and prohibited outcomes. | [specification-assurance.md](../../shared/domain-modules/specification-assurance.md) |
| 4 | **Derive mathematical properties where applicable** | For formulas/rates/ratios/precision, derive dimensions, bounds, conservation relations and edge behavior. | [mathematical-verification.md](../../shared/domain-modules/mathematical-verification.md) |
| 5 | **Record canonical security properties** | Assign stable PROP-* IDs, violation impact, assumptions, boundaries, source basis and planned Phase 4/6/7/8 validation route. | [PHASE2_SECURITY_PROPERTY_REGISTRY.md](resources/PHASE2_SECURITY_PROPERTY_REGISTRY.md) |
| 6 | **Reconcile campaign-global security state** | Update the canonical Security Traceability Graph for this phase, enumerate and reconcile every obligation due now, add stable OBL-* records for new later-phase work, and freeze current graph/ledger digests for the Phase Report. An OPEN/IN_PROGRESS obligation due in this phase blocks sealing. Classify every material observed change under the Evidence Invalidation Matrix before reusing affected evidence. | [SECURITY_TRACEABILITY_GRAPH.json](../../shared/controller/SECURITY_TRACEABILITY_GRAPH.json) · [CARRIED_FORWARD_OBLIGATION_LEDGER.json](../../shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json) · [EVIDENCE_INVALIDATION_MATRIX.json](../../shared/controller/EVIDENCE_INVALIDATION_MATRIX.json) |
| 7 | **File the phase report and auto-advance** | Seal the required structured artifact/global checkpoints, file the immutable Phase Report, enter AUTO_ADVANCE_READY, and immediately continue into the next same-reviewer phase under the Automatic Phase Advancement Protocol. Do not wait for human approval. | [PHASE_REPORT.md](../../shared/reporting/PHASE_REPORT.md) · [AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md](../../shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md) |
## Audit-module resources in this phase

- [`specification-assurance`](../../shared/domain-modules/specification-assurance.md)
- [`mathematical-verification`](../../shared/domain-modules/mathematical-verification.md)

## Preserved phase rules

> **READ ONLY FOR THE CURRENT SOLO PHASE.** This file is supporting audit methodology, not authority to self-advance.

## V7 runtime use

1. Use this support only while controller state is the matching phase and `ACTIVE`.
2. Apply every embedded method relevant to the target. Explicitly record applicability; when uncertain, include the method rather than silently dropping coverage.
3. Fresh `reviewer-2` executes Phases 2–5 using `gpt-5.6-sol`. It must verify the `P1_TO_P2` handoff before entering the Phase-2 specification lens. Any V6.1 `Agent N`, worker, coordinator, or independent-review actor name inside preserved embedded methodology is an **audit lens label**, not a separate actor.
4. Preserve exact source/evidence identity and typed limitations.
5. Complete the mandatory structured filing, seal required evidence, file `shared/reporting/PHASE_REPORT.md`, enter `AUTO_ADVANCE_READY`, and immediately continue to the next same-reviewer phase. Do not wait for human approval.

## Authorization

Authorization requires the exact current phase/revision/source binding, automatic Phase-1 successor-boundary authorization, and an accepted campaign-local `handoffs/P1_TO_P2/SUCCESSOR_HANDOFF_RECEIPT.json` bound to fresh `reviewer-2`. There is no mailbox, worker lease, numbered-agent bootstrap, or unvalidated advancement path.


## Mandatory end-of-phase structured filing

Before this phase may enter `EVIDENCE_SEALED`, complete `phases/phase-2/resources/PHASE2_SECURITY_PROPERTY_REGISTRY.md` as the canonical **Phase 2 Security Property Registry**, bind it to the exact phase/source identity, and record its durable reference/digest in `shared/reporting/PHASE_REPORT.md`. Do not substitute narrative prose for the structured artifact. Use explicit `NOT_APPLICABLE`/typed limitation states rather than blanks where a field or row does not apply.

The accepted Phase-1 risk grade is the Phase-2 starting control. Phase 2 may promote it when new evidence increases impact, complexity or required review depth, but it may not silently reduce or replace the sealed grade.

The Phase Report must also complete the **Source Intelligence checkpoint**, including the accepted Bundle Index revision/commit/digest, every materially used component revision/commit/digest/status/invalidation state, reuse or regeneration status, and the relevant sections materially reviewed in this phase. The Phase Report must also complete the universal sections **Canonical outputs created**, **New canonical audit facts**, **Carried-forward obligations**, and **Evidence invalidation triggers**. It must classify every material observed change under the Evidence Invalidation Matrix and record `NO_MATERIAL_CHANGE_EVENT` when none occurred. It must additionally record the current campaign-local **Security Traceability Graph** reference/digest and **Carried-Forward Obligation Ledger** reference/digest. Before sealing, reconcile every obligation due in this phase; an `OPEN` or `IN_PROGRESS` due obligation forbids `EVIDENCE_SEALED`. The carried-forward obligations table in the Phase Report is a projection of the canonical ledger, not a separate source of truth.

### Shared embedded-module gate rule

A conclusion may satisfy a gate only when it is bound to the exact source commit and its required evidence is accepted by a separate reviewer or the controller.

### Shared embedded-module common mistakes

- Treating confidence or prose as execution evidence.
- Omitting an unresolved assumption from the output.
- Reusing evidence from a different source, request, profile, or release.
