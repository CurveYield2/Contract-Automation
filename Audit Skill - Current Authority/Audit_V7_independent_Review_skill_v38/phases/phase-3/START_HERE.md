# Phase 3 — Architecture, Privilege & Threat Model

> **CURRENT-PHASE READ BOUNDARY:** Read this card first. Do **not** open another phase folder. Open only the resource linked by the active step below; conditional resources are opened only when their trigger applies.

> **PHASE CONTRACT HARD GATE:** Before executing Step 1, open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json). It is the machine-readable contract for this phase: required inputs, ordered steps, outputs, global checkpoints, seal criteria, recovery routes, reviewer authority, and allowed next states. If this card and the contract appear inconsistent, stop phase progression and repair the packet/control inconsistency; do not choose the weaker requirement.

> **UNIVERSAL RULE IDS:** `U-EXEC-001`, `U-GITHUB-001`, `U-STATE-001`, `U-EVIDENCE-001`, `U-REPAIR-001`, `U-HUMAN-001`, `U-DISCLOSURE-001`, `U-SOURCEINTEL-001`, `U-UPDATES-001`, and `U-HUMANCOMMS-001` remain binding. Full normative text exists only in the [homepage](../../SKILL.md#universal-hard-rules); this phase card may add narrower requirements but must not redefine or weaken those rules.

> **SOURCE INTELLIGENCE REUSE GATE (`U-SOURCEINTEL-001`):** Before any active step that needs structural, runtime/deployment, or assurance-readiness facts, load the latest controller-accepted `SOURCE_INTELLIGENCE_BUNDLE_INDEX.json`; verify its committed index identity and every materially used component’s accepted revision, commit SHA, SHA-256, status, invalidation state, and exact source/build binding. A mutable path is navigation only. Reuse and verify accepted facts; **do not recreate Phase-1 inventories for orientation**. Raw source review remains mandatory for semantic reasoning, contradiction checks, reachability, reproduction, or remediation validation. On a mismatch, reject unaccepted bytes and apply the [Source Intelligence protocol](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) and Evidence Invalidation Matrix.

> **THIS PHASE REVIEWS:** the accepted Phase-1 inheritance/call graphs, privilege candidates, security surfaces, and upgrade/dependency/cross-chain/offchain topology as the structural baseline. Phase 3 creates semantic authority/trust/attack models in its own registry and does not reconstruct or overwrite the Phase-1 topology.

## Phase card

| Step | Action | What to do | Open only when this step is active |
|---:|---|---|---|
| 1 | **Enter the isolated architecture/threat lens** | Bind exact source/revision and do not read later analytical conclusions. | [SOLO_LENS_ISOLATION_PROTOCOL.md](../../shared/lenses/SOLO_LENS_ISOLATION_PROTOCOL.md) · [architecture-threat-lens.md](../../shared/lenses/architecture-threat-lens.md) |
| 2 | **Build attack trees and trust boundaries** | Start from the accepted Source Intelligence inheritance/call/external-interface/value-flow structural baseline, then map semantic threats, failure modes, prerequisites, attack paths and protected properties. Do not rebuild the raw structural graph. | [threat-model-attack-trees.md](resources/audit-modules/threat-model-attack-trees.md) |
| 3 | **Interpret governance and privilege surfaces** | Use Source Intelligence privilege/access candidates and function/source anchors as the baseline, then determine actual authority semantics, administrative paths, timelocks, emergency controls and authority transitions. Do not recreate the raw entrypoint/modifier inventory. | [governance-privileges.md](../../shared/domain-modules/governance-privileges.md) |
| 4 | **Classify every specialist domain deterministically** | Evaluate all domain trigger rules against exact source plus sealed Phase-1/2 evidence. Record exactly one current decision per domain. Any uncertainty becomes UNCERTAIN_INCLUDE and is treated as triggered. | [DOMAIN_APPLICABILITY_MATRIX.json](../../shared/controller/DOMAIN_APPLICABILITY_MATRIX.json) · [DOMAIN_APPLICABILITY_REGISTRY.json](../../shared/controller/DOMAIN_APPLICABILITY_REGISTRY.json) |
| 5 | **Map upgradeability surfaces when registry activates DOMAIN-UPGRADE** | If DOMAIN-UPGRADE is TRIGGERED or UNCERTAIN_INCLUDE, review proxy/admin/initializer/storage/upgrade paths; skip only with evidence-bound NOT_TRIGGERED. | [upgradeability.md](../../shared/domain-modules/upgradeability.md) · [UPGRADE_SAFETY_LEDGER.md](../../shared/domain-ledgers/UPGRADE_SAFETY_LEDGER.md) |
| 6 | **Map external dependencies when registry activates DOMAIN-DEPENDENCY** | If DOMAIN-DEPENDENCY is TRIGGERED or UNCERTAIN_INCLUDE, review dependency trust, failure, callback and stale-state surfaces; skip only with evidence-bound NOT_TRIGGERED. | [external-dependencies.md](../../shared/domain-modules/external-dependencies.md) · [EXTERNAL_DEPENDENCY_LEDGER.md](../../shared/domain-ledgers/EXTERNAL_DEPENDENCY_LEDGER.md) |
| 7 | **Map cross-chain surfaces when registry activates DOMAIN-CROSSCHAIN** | If DOMAIN-CROSSCHAIN is TRIGGERED or UNCERTAIN_INCLUDE, model message authority, replay/finality/ordering and failure assumptions; skip only with evidence-bound NOT_TRIGGERED. | [cross-chain.md](../../shared/domain-modules/cross-chain.md) · [CROSS_CHAIN_LEDGER.md](../../shared/domain-ledgers/CROSS_CHAIN_LEDGER.md) |
| 8 | **Record canonical attack hypotheses** | Assign HYP-* IDs with actor, prerequisites, attack sequence, target property, success condition and planned validation route; connect domain-activated hypotheses in the traceability graph. | [PHASE3_ATTACK_HYPOTHESIS_REGISTRY.md](resources/PHASE3_ATTACK_HYPOTHESIS_REGISTRY.md) |
| 9 | **Reconcile campaign-global security state** | Update the Security Traceability Graph, Domain Applicability Registry and obligation ledger; create obligations for every later required phase of each TRIGGERED/UNCERTAIN_INCLUDE domain. Freeze all current digests. Classify every material observed change under the Evidence Invalidation Matrix before reusing affected evidence. | [SECURITY_TRACEABILITY_GRAPH.json](../../shared/controller/SECURITY_TRACEABILITY_GRAPH.json) · [DOMAIN_APPLICABILITY_REGISTRY.json](../../shared/controller/DOMAIN_APPLICABILITY_REGISTRY.json) · [CARRIED_FORWARD_OBLIGATION_LEDGER.json](../../shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json) · [EVIDENCE_INVALIDATION_MATRIX.json](../../shared/controller/EVIDENCE_INVALIDATION_MATRIX.json) |
| 10 | **File the phase report and auto-advance** | Seal the required structured artifact/global checkpoints, file the immutable Phase Report, enter AUTO_ADVANCE_READY, and immediately continue into the next same-reviewer phase under the Automatic Phase Advancement Protocol. Do not wait for human approval. | [PHASE_REPORT.md](../../shared/reporting/PHASE_REPORT.md) · [AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md](../../shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md) |
## Audit-module resources in this phase

- [`threat-model-attack-trees`](resources/audit-modules/threat-model-attack-trees.md)
- [`governance-privileges`](../../shared/domain-modules/governance-privileges.md)
- [`upgradeability`](../../shared/domain-modules/upgradeability.md)
- [`external-dependencies`](../../shared/domain-modules/external-dependencies.md)
- [`cross-chain`](../../shared/domain-modules/cross-chain.md)

## Preserved phase rules

> **READ ONLY FOR THE CURRENT SOLO PHASE.** This file is supporting audit methodology, not authority to self-advance.

## V7 runtime use

1. Use this support only while controller state is the matching phase and `ACTIVE`.
2. Apply every embedded method relevant to the target. Explicitly record applicability; when uncertain, include the method rather than silently dropping coverage.
3. The same Phase-2–5 reviewer (`reviewer-2`) executes all role concepts. Any V6.1 `Agent N`, worker, coordinator, or independent-review actor name inside preserved embedded methodology is an **audit lens label**, not a separate actor.
4. Preserve exact source/evidence identity and typed limitations.
5. Complete the mandatory structured filing, seal required evidence, file `shared/reporting/PHASE_REPORT.md`, enter `AUTO_ADVANCE_READY`, and immediately continue to the next same-reviewer phase. Do not wait for human approval.

## Authorization

Authorization comes from the solo controller's exact current phase/revision/source binding plus automatic controller advancement from the sealed previous phase. There is no mailbox, worker lease, numbered-agent bootstrap, or unvalidated advancement path.


## Deterministic specialist-domain applicability gate

Phase 3 MUST evaluate all ten domains in `shared/controller/DOMAIN_APPLICABILITY_MATRIX.json` and create/update the campaign-local `DOMAIN_APPLICABILITY_REGISTRY`. `UNCERTAIN_INCLUDE` is treated as triggered. `NOT_TRIGGERED` requires affirmative negative evidence; silence, cost, convenience, or lack of supplied tests is invalid. Every activated domain that requires later work must create a stable `OBL-*` obligation and `DOMAIN-*` traceability node before Phase 3 seals.

## Mandatory end-of-phase structured filing

Before this phase may enter `EVIDENCE_SEALED`, complete `phases/phase-3/resources/PHASE3_ATTACK_HYPOTHESIS_REGISTRY.md` as the canonical **Phase 3 Attack Hypothesis Registry**, bind it to the exact phase/source identity, and record its durable reference/digest in `shared/reporting/PHASE_REPORT.md`. Do not substitute narrative prose for the structured artifact. Use explicit `NOT_APPLICABLE`/typed limitation states rather than blanks where a field or row does not apply.

The Phase Report must also complete the **Source Intelligence checkpoint**, including the accepted Bundle Index revision/commit/digest, every materially used component revision/commit/digest/status/invalidation state, reuse or regeneration status, and the relevant sections materially reviewed in this phase. The Phase Report must also complete the universal sections **Canonical outputs created**, **New canonical audit facts**, **Carried-forward obligations**, and **Evidence invalidation triggers**. It must classify every material observed change under the Evidence Invalidation Matrix and record `NO_MATERIAL_CHANGE_EVENT` when none occurred. It must additionally record the current campaign-local **Security Traceability Graph** reference/digest and **Carried-Forward Obligation Ledger** reference/digest. Before sealing, reconcile every obligation due in this phase; an `OPEN` or `IN_PROGRESS` due obligation forbids `EVIDENCE_SEALED`. The carried-forward obligations table in the Phase Report is a projection of the canonical ledger, not a separate source of truth.

### Shared embedded-module gate rule

A conclusion may satisfy a gate only when it is bound to the exact source commit and its required evidence is accepted by a separate reviewer or the controller.

### Shared embedded-module common mistakes

- Treating confidence or prose as execution evidence.
- Omitting an unresolved assumption from the output.
- Reusing evidence from a different source, request, profile, or release.
