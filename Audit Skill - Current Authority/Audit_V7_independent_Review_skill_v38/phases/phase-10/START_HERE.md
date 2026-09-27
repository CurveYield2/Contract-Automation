# Phase 10 — Evidence Convergence, Release Verification & Final Report

> **CURRENT-PHASE READ BOUNDARY:** Read this card first. Do **not** open another phase folder. Open only the resource linked by the active step below; conditional resources are opened only when their trigger applies.

> **PHASE CONTRACT HARD GATE:** Before executing Step 1, open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json). It is the machine-readable contract for this phase: required inputs, ordered steps, outputs, global checkpoints, seal criteria, recovery routes, reviewer authority, and allowed next states. If this card and the contract appear inconsistent, stop phase progression and repair the packet/control inconsistency; do not choose the weaker requirement.

> **UNIVERSAL RULE IDS:** `U-EXEC-001`, `U-GITHUB-001`, `U-STATE-001`, `U-EVIDENCE-001`, `U-REPAIR-001`, `U-HUMAN-001`, `U-DISCLOSURE-001`, `U-SOURCEINTEL-001`, `U-UPDATES-001`, and `U-HUMANCOMMS-001` remain binding. Full normative text exists only in the [homepage](../../SKILL.md#universal-hard-rules); this phase card may add narrower requirements but must not redefine or weaken those rules.

> **SOURCE INTELLIGENCE REUSE GATE (`U-SOURCEINTEL-001`):** Before any active step that needs structural, runtime/deployment, or assurance-readiness facts, load the latest controller-accepted `SOURCE_INTELLIGENCE_BUNDLE_INDEX.json`; verify its committed index identity and every materially used component’s accepted revision, commit SHA, SHA-256, status, invalidation state, and exact source/build binding. A mutable path is navigation only. Reuse and verify accepted facts; **do not recreate Phase-1 inventories for orientation**. Raw source review remains mandatory for semantic reasoning, contradiction checks, reachability, reproduction, or remediation validation. On a mismatch, reject unaccepted bytes and apply the [Source Intelligence protocol](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) and Evidence Invalidation Matrix.

> **THIS PHASE REVIEWS:** the latest accepted bundle-index revision and every component revision/digest relied on by the final assurance case. Verify final source/build binding, overlay invalidation state, preserved snapshot continuity, and all component limitations; do not rely on current mutable-path bytes alone.

## Phase card

| Step | Action | What to do | Open only when this step is active |
|---:|---|---|---|
| 1 | **Converge only accepted evidence** | Verify exact final source/release identity, the accepted Source Intelligence Bundle Index revision/commit/digest and all relied-on component identities, Phase 0–9 reports, findings/remediation, coverage, limitations and process health. Reject mutable-path-only evidence or unresolved overlay invalidation. | [REPORTING_AND_OUTCOMES.md](resources/REPORTING_AND_OUTCOMES.md) · [Source Intelligence protocol](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) · [final-report-coordination-lens.md](../../shared/lenses/final-report-coordination-lens.md) |
| 2 | **Build the client-facing methodology reconciliation** | Truthfully summarize every substantive audit process executed or typed NOT_APPLICABLE, including versions, purpose, status, meaningful metrics and limitations. | [report-assurance-case.md](resources/audit-modules/report-assurance-case.md) · [FINAL_REPORT.md](resources/FINAL_REPORT.md) · [FINAL_REPORT_SUPPLEMENT.md](resources/FINAL_REPORT_SUPPLEMENT.md) |
| 3 | **Build the full material-claim assurance case** | Map every material claim to property, threat/failure mode, argument, immutable evidence, evidence-diversity classification, responsible lens, exact source/release identity, status and limitations. | [ASSURANCE_CASE.md](resources/ASSURANCE_CASE.md) · [ASSURANCE_CASE_AND_EVIDENCE_INDEPENDENCE.md](resources/ASSURANCE_CASE_AND_EVIDENCE_INDEPENDENCE.md) |
| 4 | **Verify deployment/release ceremony** | Reconcile exact release/deployment/configuration identity and the completed deployment gas report. | [deployment-ceremony.md](resources/audit-modules/deployment-ceremony.md) · [Contract_Deployment_Gas_Report.md](../../shared/reporting/Contract_Deployment_Gas_Report.md) |
| 5 | **Perform live-deployment attestation only when triggered** | Bind deployed state/code/configuration evidence when required; otherwise preserve explicit NOT_APPLICABLE. | [ASSURANCE_PRECISION_CONTROLS.md](../../shared/policy/ASSURANCE_PRECISION_CONTROLS.md) |
| 6 | **Challenge evidence-independence claims** | Ensure correlated/procedural evidence is labeled accurately. | [ai-review-independence.md](resources/audit-modules/ai-review-independence.md) |
| 7 | **Produce final report artifacts** | Produce the evidence-bound Markdown final report, supplement if required, assurance-case ledger and separate deployment-gas report. | [FINAL_REPORT.md](resources/FINAL_REPORT.md) · [FINAL_REPORT_SUPPLEMENT.md](resources/FINAL_REPORT_SUPPLEMENT.md) · [ASSURANCE_CASE.md](resources/ASSURANCE_CASE.md) |
| 8 | **Create the immutable pre-closure snapshot** | Before the Phase-10 report, create the closure manifest with Phase-10 report/automatic-authorization fields PENDING_BY_SEQUENCE and seal its digest. | [PHASE10_AUDIT_CLOSURE_MANIFEST.json](resources/PHASE10_AUDIT_CLOSURE_MANIFEST.json) |
| 9 | **Reconcile campaign-global security state** | Update the canonical Security Traceability Graph for this phase, enumerate and reconcile every obligation due now, add stable OBL-* records for new later-phase work, and freeze current graph/ledger digests for the Phase Report. An OPEN/IN_PROGRESS obligation due in this phase blocks sealing. Classify every material observed change under the Evidence Invalidation Matrix before reusing affected evidence. | [SECURITY_TRACEABILITY_GRAPH.json](../../shared/controller/SECURITY_TRACEABILITY_GRAPH.json) · [CARRIED_FORWARD_OBLIGATION_LEDGER.json](../../shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json) · [EVIDENCE_INVALIDATION_MATRIX.json](../../shared/controller/EVIDENCE_INVALIDATION_MATRIX.json) |
| 10 | **File the Phase-10 report and authorize terminal closure automatically** | Reference the pre-closure snapshot digest, file the Phase Report, and enter AUTO_ADVANCE_READY. Do not wait for human approval. | [PHASE_REPORT.md](../../shared/reporting/PHASE_REPORT.md) · [AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md](../../shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md) |
| 11 | **Create terminal closure manifest and complete automatically** | Create a new immutable terminal closure manifest referencing the pre-closure snapshot and final Phase-10 report digest; record AUTO_AFTER_SEAL authorization instead of a human-response digest. Never mutate the pre-closure artifact. After validation, set campaign status COMPLETE. | [PHASE10_AUDIT_CLOSURE_MANIFEST.json](resources/PHASE10_AUDIT_CLOSURE_MANIFEST.json) |
## Audit-module resources in this phase

- [`report-assurance-case`](resources/audit-modules/report-assurance-case.md)
- [`deployment-ceremony`](resources/audit-modules/deployment-ceremony.md)
- [`ai-review-independence`](resources/audit-modules/ai-review-independence.md)

## Preserved phase rules

> **READ ONLY FOR THE CURRENT SOLO PHASE.** This file is supporting audit methodology, not authority to self-advance.

## V7 runtime use

1. Use this support only while controller state is the matching phase and `ACTIVE`.
2. Apply every embedded method relevant to the target. Explicitly record applicability; when uncertain, include the method rather than silently dropping coverage.
3. `reviewer-5` executes Phases 9–10 and all role concepts required inside this phase. Any V6.1 `Agent N`, worker, coordinator, or independent-review actor name inside preserved embedded methodology is an **audit lens label**, not an additional actor.
4. Preserve exact source/evidence identity and typed limitations.
5. Complete the mandatory structured filing, seal Phase-10 evidence, file the Phase Report, enter `AUTO_ADVANCE_READY`, create the terminal closure manifest automatically, and set campaign status `COMPLETE` after validation. No human approval is required.

## Authorization

Authorization comes from the solo controller's exact current phase/revision/source binding plus automatic controller advancement from the sealed previous phase. There is no mailbox, worker lease, numbered-agent bootstrap, or unvalidated advancement path.


## Mandatory end-of-phase structured filing

Before this phase may enter `EVIDENCE_SEALED`, create a **pre-closure snapshot** from `phases/phase-10/resources/PHASE10_AUDIT_CLOSURE_MANIFEST.json`, bind it to the exact phase/source identity, use `PENDING_BY_SEQUENCE` for the not-yet-created Phase-10 report/automatic-authorization fields, and record its durable reference/digest in `shared/reporting/PHASE_REPORT.md`. After the Phase-10 report is filed and completeness passes, create a **new immutable terminal closure manifest** from the same template that references the pre-closure snapshot digest and final Phase-10 report digest plus `AUTO_AFTER_SEAL` authorization; do not mutate the sealed pre-closure snapshot. Do not substitute narrative prose for the structured artifact. Use explicit `NOT_APPLICABLE`/typed limitation states rather than blanks where a field or row does not apply.

The Phase Report must also complete the **Source Intelligence checkpoint**, including the accepted Bundle Index revision/commit/digest, every materially used component revision/commit/digest/status/invalidation state, reuse or regeneration status, and the relevant sections materially reviewed in this phase. The Phase Report must also complete the universal sections **Canonical outputs created**, **New canonical audit facts**, **Carried-forward obligations**, and **Evidence invalidation triggers**. It must classify every material observed change under the Evidence Invalidation Matrix and record `NO_MATERIAL_CHANGE_EVENT` when none occurred. It must additionally record the current campaign-local **Security Traceability Graph** reference/digest and **Carried-Forward Obligation Ledger** reference/digest. Before sealing, reconcile every obligation due in this phase; an `OPEN` or `IN_PROGRESS` due obligation forbids `EVIDENCE_SEALED`. The carried-forward obligations table in the Phase Report is a projection of the canonical ledger, not a separate source of truth.

### Shared embedded-module gate rule

A conclusion may satisfy a gate only when it is bound to the exact source commit and its required evidence is accepted by a separate reviewer or the controller.

### Shared embedded-module common mistakes

- Treating confidence or prose as execution evidence.
- Omitting an unresolved assumption from the output.
- Reusing evidence from a different source, request, profile, or release.



For Phase 6 client-facing methodology, disclose the approved mutable-RPC profile name and frozen block/hash but never the secret URL. State whether Medusa fork mode and same-fork Foundry execution were proven.
