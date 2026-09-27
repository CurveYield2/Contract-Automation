# Phase 1 — Scope, Provenance, Neutral Reconnaissance & Risk Grade

> **CURRENT-PHASE READ BOUNDARY:** Read this card first. Do **not** open another phase folder. Open only the resource linked by the active step below; conditional resources are opened only when their trigger applies.

> **PHASE CONTRACT HARD GATE:** Before executing Step 1, open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json). It is the machine-readable contract for this phase: required inputs, ordered steps, outputs, global checkpoints, seal criteria, recovery routes, reviewer authority, and allowed next states. If this card and the contract appear inconsistent, stop phase progression and repair the packet/control inconsistency; do not choose the weaker requirement.

> **UNIVERSAL RULE IDS:** `U-EXEC-001`, `U-GITHUB-001`, `U-STATE-001`, `U-EVIDENCE-001`, `U-REPAIR-001`, `U-HUMAN-001`, `U-DISCLOSURE-001`, `U-SOURCEINTEL-001`, `U-UPDATES-001`, and `U-HUMANCOMMS-001` remain binding. Full normative text exists only in the [homepage](../../SKILL.md#universal-hard-rules); this phase card may add narrower requirements but must not redefine or weaken those rules.

## Phase card

| Step | Action | What to do | Open only when this step is active |
|---:|---|---|---|
| 1 | **Confirm authorization and exact source fence** | Operate only on the controller-bound Phase 1 revision/source. Do not consume later-phase conclusions. | [scope-specification-lens.md](../../shared/lenses/scope-specification-lens.md) |
| 2 | **Freeze specification-facing scope** | Identify actors, assets, interfaces, exclusions, documented intent and source boundaries. | [specification-assurance.md](../../shared/domain-modules/specification-assurance.md) |
| 3 | **Admit the exact build** | Establish the exact compiler/build/toolchain identity and accepted compiler artifacts for the frozen source before Source Intelligence generation. | [supply-chain-build.md](../../shared/domain-modules/supply-chain-build.md) · [GITHUB_ACTIONS_VIA_GITHUB_APP.md](../../shared/execution/GITHUB_ACTIONS_VIA_GITHUB_APP.md) |
| 4 | **Fill the canonical Source Intelligence core from the supplied template** | Copy the exact template into campaign evidence. Populate structural source/build facts, the security-surface inventory, static upgrade/dependency/cross-chain/offchain topology, and preliminary compiler gas estimates from the exact admitted build. Do not make later semantic, adequacy, runtime, or gas-acceptance decisions. | [SOURCE_INTELLIGENCE_TEMPLATE.json](../../shared/source-intelligence/SOURCE_INTELLIGENCE_TEMPLATE.json) · [SOURCE_INTELLIGENCE_SCHEMA.json](../../shared/source-intelligence/SOURCE_INTELLIGENCE_SCHEMA.json) · [SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) |
| 5 | **Run neutral Slither/static reconnaissance and attach it to Source Intelligence** | Run neutral Slither/static reconnaissance on the same admitted project and attach exact version/status/raw evidence/candidate index plus SBOM references to Source Intelligence without treating analyzer output as findings. | [supply-chain-build.md](../../shared/domain-modules/supply-chain-build.md) · [SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) |
| 6 | **Initialize overlays and pin the accepted bundle index** | Fill the supplied runtime/deployment and assurance-readiness overlay templates with Phase-1 discovery states only. Validate and commit each revision, then fill/validate/commit the bundle index with accepted revision, commit, digest, status, invalidation state and preserved snapshot. A mutable path is navigation only. | [Runtime overlay](../../shared/source-intelligence/RUNTIME_DEPLOYMENT_OVERLAY_TEMPLATE.json) · [Readiness overlay](../../shared/source-intelligence/ASSURANCE_READINESS_OVERLAY_TEMPLATE.json) · [Bundle index](../../shared/source-intelligence/SOURCE_INTELLIGENCE_BUNDLE_TEMPLATE.json) · [Reuse protocol](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) |
| 7 | **Map external dependencies** | Use the Source Intelligence external-interface/dependency touchpoint and topology inventory as structural baseline, then freeze dependency identities, trust assumptions and evidence needed later. Do not recreate the same structural inventory. | [external-dependencies.md](../../shared/domain-modules/external-dependencies.md) · [EXTERNAL_DEPENDENCY_LEDGER.md](../../shared/domain-ledgers/EXTERNAL_DEPENDENCY_LEDGER.md) |
| 8 | **Check claimed standards** | Determine standards applicability and conformance requirements using the accepted interface/function inventory as baseline evidence. | [standards-conformance.md](../../shared/domain-modules/standards-conformance.md) · [STANDARDS_CONFORMANCE.md](../../shared/policy/STANDARDS_CONFORMANCE.md) |
| 9 | **Complete the frozen audit-surface manifest** | Reconcile every in-scope file/contract, exclusion, compiler/config identity, dependency identity, deployable inventory, neutral reconnaissance status, immutable core, overlay revisions, and bundle-index identity. | [PHASE1_AUDIT_SURFACE_MANIFEST.md](resources/PHASE1_AUDIT_SURFACE_MANIFEST.md) |
| 10 | **Enter the bounded risk-grading lens** | After the Phase-1 structural evidence package is complete, enter the isolated scope/specification lens only for evidence-based risk grading. | [SOLO_LENS_ISOLATION_PROTOCOL.md](../../shared/lenses/SOLO_LENS_ISOLATION_PROTOCOL.md) · [scope-specification-lens.md](../../shared/lenses/scope-specification-lens.md) |
| 11 | **Set and seal the evidence-based security risk grade** | Grade assets, authority, accounting, dependencies, credible loss and promotion triggers from the exact Phase-1 evidence. Complete and seal the risk-grade manifest. | [security-risk-grading.md](../../shared/domain-modules/security-risk-grading.md) · [PHASE1_SECURITY_RISK_GRADE_MANIFEST.md](resources/PHASE1_SECURITY_RISK_GRADE_MANIFEST.md) |
| 12 | **Reconcile campaign-global security state** | Update the canonical Security Traceability Graph for this phase, enumerate and reconcile every obligation due now, add stable OBL-* records for later work, and freeze current graph/ledger digests. Classify material changes under the Evidence Invalidation Matrix. | [SECURITY_TRACEABILITY_GRAPH.json](../../shared/controller/SECURITY_TRACEABILITY_GRAPH.json) · [CARRIED_FORWARD_OBLIGATION_LEDGER.json](../../shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json) · [EVIDENCE_INVALIDATION_MATRIX.json](../../shared/controller/EVIDENCE_INVALIDATION_MATRIX.json) |
| 13 | **File the Phase 1 report and trigger the successor boundary** | Seal the Source Intelligence package, audit-surface manifest, risk-grade manifest, global checkpoints and immutable Phase Report; enter AUTO_ADVANCE_READY and immediately build the P1_TO_P2 successor package. | [SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) · [PHASE_REPORT.md](../../shared/reporting/PHASE_REPORT.md) · [AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md](../../shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md) |
| 14 | **Create the P1_TO_P2 successor package automatically** | Create campaign-local `handoffs/P1_TO_P2/SUCCESSOR_HANDOFF.json`, `START_HERE_SUCCESSOR.md`, and `WAKE_UP_MESSAGE.md`; route fresh `reviewer-2` to Phase 2, enter WAITING_FOR_SUCCESSOR_AGENT, and stop. | [SUCCESSOR_HANDOFF_PROTOCOL.md](../../shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md) · [SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json](../../shared/handoff/SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json) |
## Audit-module resources in this phase

- [`specification-assurance`](../../shared/domain-modules/specification-assurance.md)
- [`supply-chain-build`](../../shared/domain-modules/supply-chain-build.md)
- [`external-dependencies`](../../shared/domain-modules/external-dependencies.md)
- [`standards-conformance`](../../shared/domain-modules/standards-conformance.md)
- [`security-risk-grading`](../../shared/domain-modules/security-risk-grading.md)

## Preserved phase rules

> **READ ONLY FOR THE CURRENT SOLO PHASE.** This file is supporting audit methodology, not authority to self-advance.

## V7 runtime use

1. Use this support only while controller state is the matching phase and `ACTIVE`.
2. Apply every embedded method relevant to the target. Explicitly record applicability; when uncertain, include the method rather than silently dropping coverage.
3. `reviewer-1` executes Phases 0–1 using `gpt-5.6-terra` with `high` reasoning. Any V6.1 `Agent N`, worker, coordinator, or independent-review actor name inside preserved embedded methodology is an **audit lens label**, not a separate actor.
4. Preserve exact source/evidence identity and typed limitations.
5. Complete the mandatory structured filing, seal required evidence, file `shared/reporting/PHASE_REPORT.md`, enter `AUTO_ADVANCE_READY`, create the `P1_TO_P2` successor package, enter `WAITING_FOR_SUCCESSOR_AGENT`, and stop. Do not wait for human approval.

## Authorization

Authorization comes from the solo controller's exact current phase/revision/source binding plus automatic controller advancement from the sealed previous phase. There is no mailbox, worker lease, numbered-agent bootstrap, or unvalidated advancement path.


## Mandatory end-of-phase structured filing

Before this phase may enter `EVIDENCE_SEALED`, complete the Phase 1 Audit Surface Manifest, Phase 1 Security Risk Grade Manifest, and the exact supplied Source Intelligence core, runtime/deployment overlay, assurance-readiness overlay, and bundle-index templates as campaign-local artifacts. Bind every component to the exact phase/source/build identity; validate/commit each accepted revision and record each immutable commit/digest plus the committed bundle-index identity in `shared/reporting/PHASE_REPORT.md`. Phase 1 records discovery/structural readiness and preliminary gas only. It cannot claim Phase-6A adequacy or Phase-7 runtime/deployment-gas acceptance.

After the Phase Report is filed, create and seal the `P1_TO_P2` successor package and enter `WAITING_FOR_SUCCESSOR_AGENT`. `reviewer-1` must not execute Phase 2. Fresh `reviewer-2` must verify the handoff and accept the sealed risk-grade manifest as the Phase-2 starting control before specification work begins.

The Phase Report must also complete the universal sections **Canonical outputs created**, **New canonical audit facts**, **Carried-forward obligations**, and **Evidence invalidation triggers**. It must classify every material observed change under the Evidence Invalidation Matrix and record `NO_MATERIAL_CHANGE_EVENT` when none occurred. It must additionally record the current campaign-local **Security Traceability Graph** reference/digest and **Carried-Forward Obligation Ledger** reference/digest. Before sealing, reconcile every obligation due in this phase; an `OPEN` or `IN_PROGRESS` due obligation forbids `EVIDENCE_SEALED`. The carried-forward obligations table in the Phase Report is a projection of the canonical ledger, not a separate source of truth.

### Shared embedded-module gate rule

A conclusion may satisfy a gate only when it is bound to the exact source commit and its required evidence is accepted by a separate reviewer or the controller.

### Shared embedded-module common mistakes

- Treating confidence or prose as execution evidence.
- Omitting an unresolved assumption from the output.
- Reusing evidence from a different source, request, profile, or release.
