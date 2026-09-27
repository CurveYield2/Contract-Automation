# Phase 8 — Finding Validation, Deduplication & Severity

> **CURRENT-PHASE READ BOUNDARY:** Read this card first. Do **not** open another phase folder. Open only the resource linked by the active step below; conditional resources are opened only when their trigger applies.

> **PHASE CONTRACT HARD GATE:** Before executing Step 1, open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json). It is the machine-readable contract for this phase: required inputs, ordered steps, outputs, global checkpoints, seal criteria, recovery routes, reviewer authority, and allowed next states. If this card and the contract appear inconsistent, stop phase progression and repair the packet/control inconsistency; do not choose the weaker requirement.

> **UNIVERSAL RULE IDS:** `U-EXEC-001`, `U-GITHUB-001`, `U-STATE-001`, `U-EVIDENCE-001`, `U-REPAIR-001`, `U-HUMAN-001`, `U-DISCLOSURE-001`, `U-SOURCEINTEL-001`, `U-UPDATES-001`, and `U-HUMANCOMMS-001` remain binding. Full normative text exists only in the [homepage](../../SKILL.md#universal-hard-rules); this phase card may add narrower requirements but must not redefine or weaken those rules.

> **SOURCE INTELLIGENCE REUSE GATE (`U-SOURCEINTEL-001`):** Before any active step that needs structural, runtime/deployment, or assurance-readiness facts, load the latest controller-accepted `SOURCE_INTELLIGENCE_BUNDLE_INDEX.json`; verify its committed index identity and every materially used component’s accepted revision, commit SHA, SHA-256, status, invalidation state, and exact source/build binding. A mutable path is navigation only. Reuse and verify accepted facts; **do not recreate Phase-1 inventories for orientation**. Raw source review remains mandatory for semantic reasoning, contradiction checks, reachability, reproduction, or remediation validation. On a mismatch, reject unaccepted bytes and apply the [Source Intelligence protocol](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) and Evidence Invalidation Matrix.

> **THIS PHASE REVIEWS:** source anchors, functions/calls/value-flow candidates, privilege candidates, external interfaces, and neutral static candidates relevant to each candidate finding.

## Phase card

| Step | Action | What to do | Open only when this step is active |
|---:|---|---|---|
| 1 | **Enter findings-validation authority** | Use only controller-accepted candidate/source/evidence identities and the adversarial/no-go lens. | [adversarial-no-go-lens.md](../../shared/lenses/adversarial-no-go-lens.md) |
| 2 | **Create a validation record for every candidate** | No candidate may disappear. Use the exact sequence Identity → Scope → Security property → Evidence → Reachability → Reproduction → Contradictions → Duplicate check → Impact → Severity → Disposition. | [PHASE8_FINDING_VALIDATION_PACKET.md](resources/PHASE8_FINDING_VALIDATION_PACKET.md) · [FINDING_TEMPLATE.md](../../shared/reporting/FINDING_TEMPLATE.md) |
| 3 | **Calibrate security risk and severity** | Separate security severity from process/tool failure and quantify maximum credible impact. | [security-risk-grading.md](../../shared/domain-modules/security-risk-grading.md) · [SEVERITY_CALIBRATION.md](../../shared/policy/SEVERITY_CALIBRATION.md) |
| 4 | **Challenge evidence independence claims** | Classify same-agent, procedural retrace, shared-harness and diverse evidence correctly. | [ai-review-independence.md](../../shared/domain-modules/ai-review-independence.md) |
| 5 | **Challenge the threat path** | Re-evaluate prerequisites, reachability and attack-tree consistency. | [threat-model-attack-trees.md](../../shared/domain-modules/threat-model-attack-trees.md) |
| 6 | **Challenge implementation evidence** | Reconcile source path, executable reproduction and contradictions. | [evm-contract-review.md](resources/audit-modules/evm-contract-review.md) |
| 7 | **Challenge economic evidence** | Recompute accounting/economic impact and assumptions where applicable. | [economic-correctness.md](../../shared/domain-modules/economic-correctness.md) |
| 8 | **Evaluate remediation relationships** | Identify whether candidate status depends on supplied fixes or prior remediation evidence. | [remediation-review.md](../../shared/domain-modules/remediation-review.md) |
| 9 | **Promote only validated findings** | Only authoritative validated findings enter the canonical ledger; process FAIL remains separate. | [PHASE_STATUS_AND_VERDICT_POLICY.md](../../shared/policy/PHASE_STATUS_AND_VERDICT_POLICY.md) |
| 10 | **Reconcile campaign-global security state** | Update the canonical Security Traceability Graph for this phase, enumerate and reconcile every obligation due now, add stable OBL-* records for new later-phase work, and freeze current graph/ledger digests for the Phase Report. An OPEN/IN_PROGRESS obligation due in this phase blocks sealing. Classify every material observed change under the Evidence Invalidation Matrix before reusing affected evidence. | [SECURITY_TRACEABILITY_GRAPH.json](../../shared/controller/SECURITY_TRACEABILITY_GRAPH.json) · [CARRIED_FORWARD_OBLIGATION_LEDGER.json](../../shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json) · [EVIDENCE_INVALIDATION_MATRIX.json](../../shared/controller/EVIDENCE_INVALIDATION_MATRIX.json) |
| 11 | **File the Phase-8 report, including remediation guidance, and stop** | Reference every candidate disposition packet, validated finding state, concrete recommended repairs, and unresolved limitations; enter `AUTO_ADVANCE_READY`. | [PHASE_REPORT.md](../../shared/reporting/PHASE_REPORT.md) · [FINDING_TEMPLATE.md](../../shared/reporting/FINDING_TEMPLATE.md) · [AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md](../../shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md) |
| 12 | **File the Phase-8 report and trigger automatic successor handoff** | Reference every candidate disposition, remediation guidance and global-state digest, file the Phase Report, enter AUTO_ADVANCE_READY, and immediately create the P8_TO_P9 successor package. No human approval is required. | [PHASE_REPORT.md](../../shared/reporting/PHASE_REPORT.md) · [FINDING_TEMPLATE.md](../../shared/reporting/FINDING_TEMPLATE.md) · [AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md](../../shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md) |
| 13 | **Create the P8_TO_P9 successor package automatically** | Immediately after Phase-8 seal/report, create the P8_TO_P9 successor package and WAKE_UP_MESSAGE, enter WAITING_FOR_SUCCESSOR_AGENT, and stop. reviewer-4 must not execute Phase 9. | [SOLO_WORKFLOW_STATE_MACHINE.json](../../shared/controller/SOLO_WORKFLOW_STATE_MACHINE.json) |
## Audit-module resources in this phase

- [`security-risk-grading`](../../shared/domain-modules/security-risk-grading.md)
- [`ai-review-independence`](../../shared/domain-modules/ai-review-independence.md)
- [`threat-model-attack-trees`](../../shared/domain-modules/threat-model-attack-trees.md)
- [`evm-contract-review`](resources/audit-modules/evm-contract-review.md)
- [`economic-correctness`](../../shared/domain-modules/economic-correctness.md)
- [`remediation-review`](../../shared/domain-modules/remediation-review.md)

## Preserved phase rules

> **READ ONLY FOR THE CURRENT SOLO PHASE.** This file is supporting audit methodology, not authority to self-advance.

## V7 runtime use

1. Use this support only while controller state is the matching phase and `ACTIVE`.
2. Apply every embedded method relevant to the target. Explicitly record applicability; when uncertain, include the method rather than silently dropping coverage.
3. `reviewer-4` executes Phases 7–8 and all role concepts required inside this phase. Any V6.1 `Agent N`, worker, coordinator, or independent-review actor name inside preserved embedded methodology is an **audit lens label**, not an additional actor.
4. Preserve exact source/evidence identity and typed limitations.
5. Complete the mandatory structured filing, seal Phase-8 evidence, file the Phase Report, then immediately create/seal the `P8_TO_P9` successor handoff + wake-up message and enter `WAITING_FOR_SUCCESSOR_AGENT`. Fresh reviewer-5 receives Phase 9; no human approval is required.

## Authorization

Authorization comes from the solo controller's exact current phase/revision/source binding plus automatic controller advancement from the sealed previous phase. There is no mailbox, worker lease, numbered-agent bootstrap, or unvalidated advancement path.


## Mandatory successor wake-up delivery

This phase ends at the `P8_TO_P9` fresh-reviewer boundary. After the required Phase Report and successful automatic seal authorization, create the generic successor handoff and bootstrap, seal the underlying handoff content, generate campaign-local `handoffs/P8_TO_P9/WAKE_UP_MESSAGE.md` from [`WAKE_UP_MESSAGE_TEMPLATE.md`](../../shared/handoff/WAKE_UP_MESSAGE_TEMPLATE.md), validate that it contains immutable 40-character-commit URLs and no placeholders, and then give the human its **exact contents in a separate standalone fenced `text` copy block** headed `WAKE UP MESSAGE FOR REPLACEMENT AGENT`. The human must not need to add or explain anything. The outgoing reviewer may not enter the successor phase.

## Mandatory end-of-phase structured filing

Before this phase may enter `EVIDENCE_SEALED`, complete `phases/phase-8/resources/PHASE8_FINDING_VALIDATION_PACKET.md` as the canonical **Phase 8 Finding Validation Packet**, bind it to the exact phase/source identity, and record its durable reference/digest in `shared/reporting/PHASE_REPORT.md`. Do not substitute narrative prose for the structured artifact. Use explicit `NOT_APPLICABLE`/typed limitation states rather than blanks where a field or row does not apply.

The validation packet is mandatory for **every candidate**, including dismissed and duplicate candidates, and must explicitly file each step of `Identity → Scope → Security property → Evidence → Reachability → Reproduction → Contradictions → Duplicate check → Impact → Severity → Disposition`.

The Phase Report must also complete the **Source Intelligence checkpoint**, including the accepted Bundle Index revision/commit/digest, every materially used component revision/commit/digest/status/invalidation state, reuse or regeneration status, and the relevant sections materially reviewed in this phase. The Phase Report must also complete the universal sections **Canonical outputs created**, **New canonical audit facts**, **Carried-forward obligations**, and **Evidence invalidation triggers**. It must classify every material observed change under the Evidence Invalidation Matrix and record `NO_MATERIAL_CHANGE_EVENT` when none occurred. It must additionally record the current campaign-local **Security Traceability Graph** reference/digest and **Carried-Forward Obligation Ledger** reference/digest. Before sealing, reconcile every obligation due in this phase; an `OPEN` or `IN_PROGRESS` due obligation forbids `EVIDENCE_SEALED`. The carried-forward obligations table in the Phase Report is a projection of the canonical ledger, not a separate source of truth.

### Shared embedded-module gate rule

A conclusion may satisfy a gate only when it is bound to the exact source commit and its required evidence is accepted by a separate reviewer or the controller.

### Shared embedded-module common mistakes

- Treating confidence or prose as execution evidence.
- Omitting an unresolved assumption from the output.
- Reusing evidence from a different source, request, profile, or release.
