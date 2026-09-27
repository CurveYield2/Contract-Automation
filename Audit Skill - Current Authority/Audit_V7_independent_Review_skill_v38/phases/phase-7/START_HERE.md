# Phase 7 — Pinned-Fork Lifecycle Simulation

> **CURRENT-PHASE READ BOUNDARY:** Read this card first. Do **not** open another phase folder. Open only the resource linked by the active step below; conditional resources are opened only when their trigger applies.

> **PHASE CONTRACT HARD GATE:** Before executing Step 1, open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json). It is the machine-readable contract for this phase: required inputs, ordered steps, outputs, global checkpoints, seal criteria, recovery routes, reviewer authority, and allowed next states. If this card and the contract appear inconsistent, stop phase progression and repair the packet/control inconsistency; do not choose the weaker requirement.

> **UNIVERSAL RULE IDS:** `U-EXEC-001`, `U-GITHUB-001`, `U-STATE-001`, `U-EVIDENCE-001`, `U-REPAIR-001`, `U-HUMAN-001`, `U-DISCLOSURE-001`, `U-SOURCEINTEL-001`, `U-UPDATES-001`, and `U-HUMANCOMMS-001` remain binding. Full normative text exists only in the [homepage](../../SKILL.md#universal-hard-rules); this phase card may add narrower requirements but must not redefine or weaken those rules.

> **SOURCE INTELLIGENCE REUSE GATE (`U-SOURCEINTEL-001`):** Before any active step that needs structural, runtime/deployment, or assurance-readiness facts, load the latest controller-accepted `SOURCE_INTELLIGENCE_BUNDLE_INDEX.json`; verify its committed index identity and every materially used component’s accepted revision, commit SHA, SHA-256, status, invalidation state, and exact source/build binding. A mutable path is navigation only. Reuse and verify accepted facts; **do not recreate Phase-1 inventories for orientation**. Raw source review remains mandatory for semantic reasoning, contradiction checks, reachability, reproduction, or remediation validation. On a mismatch, reject unaccepted bytes and apply the [Source Intelligence protocol](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) and Evidence Invalidation Matrix.

> **THIS PHASE REVIEWS:** the accepted core plus the pinned runtime/deployment overlay. Phase 7 verifies live identities/configuration and accepts lifecycle/gas evidence in a new overlay revision; preliminary Phase-1 gas and current mutable-path bytes are never acceptance evidence by themselves.

## Deployment readiness versus security verdict

Deployment validation determines whether the release package can be deployed correctly. It does not replace security severity grading and does not independently determine `securityVerdict`. Deployment, configuration, or release automation defects without a validated High/Critical security impact must be recorded as deployment readiness issues rather than security NO_GO conditions.

## Phase card

| Step | Action | What to do | Open only when this step is active |
|---:|---|---|---|
| 1 | **Open the P6_TO_P7 successor bootstrap and verify the handoff** | Use the GitHub connector app inside the exact campaign workspace. Exhaust the handoff recovery ladder before any blocker message. | [SUCCESSOR_HANDOFF_RECEPTION_CHECKLIST.md](../../shared/handoff/SUCCESSOR_HANDOFF_RECEPTION_CHECKLIST.md) · [SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json](../../shared/handoff/SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json) · [SUCCESSOR_HANDOFF_RECEIPT_TEMPLATE.json](../../shared/handoff/SUCCESSOR_HANDOFF_RECEIPT_TEMPLATE.json) · [SUCCESSOR_HANDOFF_PROTOCOL.md](../../shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md) |
| 2 | **Enter Phase-7 fork preflight** | Use the GitHub connector app only for all controller/Contract-Automation repository access. Prove supported Ethereum archive-fork identity, Anvil launch/hardfork, target code, impersonation and workflow readiness. | [EXECUTION_PREFLIGHT_AND_REPAIR_PROTOCOL.md](../../shared/execution/EXECUTION_PREFLIGHT_AND_REPAIR_PROTOCOL.md) · [GITHUB_ACTIONS_VIA_GITHUB_APP.md](../../shared/execution/GITHUB_ACTIONS_VIA_GITHUB_APP.md) |
| 3 | **Revalidate domain applicability for lifecycle execution** | Consume the exact current Domain Applicability Registry. Reevaluate any decision affected by new Phase-4/5/6 evidence. For every TRIGGERED/UNCERTAIN_INCLUDE domain with an expressible lifecycle property/hypothesis, map it to a simulation recipe, explicit non-expressible disposition, or typed blocker/limitation. | [DOMAIN_APPLICABILITY_MATRIX.json](../../shared/controller/DOMAIN_APPLICABILITY_MATRIX.json) · [DOMAIN_APPLICABILITY_REGISTRY.json](../../shared/controller/DOMAIN_APPLICABILITY_REGISTRY.json) |
| 4 | **Select required lifecycle recipes** | Map target integrations, domain obligations and security properties to standardized lifecycle recipes; record RECIPE_GAP for a required expressible scenario that lacks one. | [PHASE7_LIFECYCLE_RECIPES.md](resources/PHASE7_LIFECYCLE_RECIPES.md) |
| 5 | **Execute controller-operated fork scenarios** | Preserve exact chain/block/profile, configuration, actors, initial state, action sequence and evidence identity. | [controller-operated-execution.md](resources/audit-modules/controller-operated-execution.md) |
| 6 | **Exercise EVM lifecycle behavior** | Test state transitions, repeated cycles, boundaries and integration behavior against implementation properties and activated domain obligations. | [evm-contract-review.md](../../shared/domain-modules/evm-contract-review.md) |
| 7 | **Exercise DOMAIN-OFFCHAIN when activated** | If DOMAIN-OFFCHAIN is TRIGGERED/UNCERTAIN_INCLUDE and lifecycle-expressible, test keeper/bot/off-chain critical workflows and failure/recovery behavior; otherwise preserve the required typed disposition. | [offchain-critical-automation.md](../../shared/domain-modules/offchain-critical-automation.md) · [OFFCHAIN_AUTOMATION_LEDGER.md](../../shared/domain-ledgers/OFFCHAIN_AUTOMATION_LEDGER.md) |
| 8 | **Exercise DOMAIN-CROSSCHAIN when activated** | If DOMAIN-CROSSCHAIN is TRIGGERED/UNCERTAIN_INCLUDE and supported/expressible, execute deterministic scenarios; otherwise preserve the required typed limitation/RECIPE_GAP. | [cross-chain.md](../../shared/domain-modules/cross-chain.md) · [CROSS_CHAIN_LEDGER.md](../../shared/domain-ledgers/CROSS_CHAIN_LEDGER.md) |
| 9 | **Verify deployment ceremony and accept gas evidence** | Compare preliminary core estimates to the exact accepted Phase-7 build/lifecycle identity. Record deployment-gas estimates for every independently deployable production contract, reject stale identities under `EIM-016`, and update the runtime overlay gas-acceptance section. | [deployment-ceremony.md](resources/audit-modules/deployment-ceremony.md) · [Gas report](../../shared/reporting/Contract_Deployment_Gas_Report.md) · [Runtime overlay](../../shared/source-intelligence/RUNTIME_DEPLOYMENT_OVERLAY_TEMPLATE.json) |
| 10 | **Verify live deployment/configuration when triggered** | Validate the accepted overlay revision against current deployed code/configuration/release identity and evidence; otherwise record typed NOT_APPLICABLE. Any change follows `EIM-014`, not silent path replacement. | [ASSURANCE_PRECISION_CONTROLS.md](../../shared/policy/ASSURANCE_PRECISION_CONTROLS.md) · [Runtime overlay](../../shared/source-intelligence/RUNTIME_DEPLOYMENT_OVERLAY_TEMPLATE.json) |
| 11 | **Accept the runtime-overlay revision and complete the lifecycle ledger** | Create the required `SIM-*` records, validate/commit the runtime overlay, then update/commit the bundle index with accepted revision/commit/digest/status/invalidation state. Preserve the prior accepted snapshot. | [PHASE7_SIMULATION_LIFECYCLE_LEDGER.md](resources/PHASE7_SIMULATION_LIFECYCLE_LEDGER.md) · [Source Intelligence protocol](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) |
| 12 | **Reconcile campaign-global security state** | Update graph/domain/obligation state; verify every Phase-7 domain obligation is terminal or properly carried with typed evidence; freeze current digests. Classify every material observed change under the Evidence Invalidation Matrix before reusing affected evidence. | [SECURITY_TRACEABILITY_GRAPH.json](../../shared/controller/SECURITY_TRACEABILITY_GRAPH.json) · [DOMAIN_APPLICABILITY_REGISTRY.json](../../shared/controller/DOMAIN_APPLICABILITY_REGISTRY.json) · [CARRIED_FORWARD_OBLIGATION_LEDGER.json](../../shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json) · [EVIDENCE_INVALIDATION_MATRIX.json](../../shared/controller/EVIDENCE_INVALIDATION_MATRIX.json) |
| 13 | **File the phase report and auto-advance** | Seal the required structured artifact/global checkpoints, file the immutable Phase Report, enter AUTO_ADVANCE_READY, and immediately continue into the next same-reviewer phase under the Automatic Phase Advancement Protocol. Do not wait for human approval. | [PHASE_REPORT.md](../../shared/reporting/PHASE_REPORT.md) · [AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md](../../shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md) |
## Audit-module resources in this phase

- [`controller-operated-execution`](resources/audit-modules/controller-operated-execution.md)
- [`evm-contract-review`](../../shared/domain-modules/evm-contract-review.md)
- [`offchain-critical-automation`](../../shared/domain-modules/offchain-critical-automation.md)
- [`cross-chain`](../../shared/domain-modules/cross-chain.md)
- [`deployment-ceremony`](resources/audit-modules/deployment-ceremony.md)

## Preserved phase rules

> **READ ONLY FOR THE CURRENT SOLO PHASE.** This file is supporting audit methodology, not authority to self-advance.

## V7 runtime use

1. Use this support only while controller state is the matching phase and `ACTIVE`.
2. Apply every embedded method relevant to the target. Explicitly record applicability; when uncertain, include the method rather than silently dropping coverage.
3. A fresh `reviewer-4` executes Phases 7–8 and all role concepts required inside those phases. Any V6.1 `Agent N`, worker, coordinator, or independent-review actor name inside preserved embedded methodology is an **audit lens label**, not an additional actor.
4. Preserve exact source/evidence identity and typed limitations.
5. Complete the mandatory structured filing, seal required evidence, file `shared/reporting/PHASE_REPORT.md`, enter `AUTO_ADVANCE_READY`, and immediately continue to the next same-reviewer phase. Do not wait for human approval.

## Authorization

Authorization requires the exact current phase/revision/source binding, a valid Phase-6 automatic advancement, and an accepted campaign-local `handoffs/P6_TO_P7/SUCCESSOR_HANDOFF_RECEIPT.json` bound to fresh `reviewer-4`. There is no mailbox, worker lease, numbered-agent bootstrap, or unvalidated advancement path.

## Mandatory Phase 7 fork preflight

Before lifecycle execution, complete and seal the Phase-7 fork preflight in `shared/execution/EXECUTION_PREFLIGHT_AND_REPAIR_PROTOCOL.md`. Phase 7 remains `PHASE7_FORK_PREFLIGHT` until Anvil launch/hardfork support, admitted archive RPC identity/state, target code, impersonation/balance control, and workflow-action support are proven. The current admitted archive capability is Ethereum only (`SIM_ARCHIVE_PRIMARY_ETHEREUM_01`). Non-Ethereum requests are blocked with `ARCHIVE_RPC_UNAVAILABLE` until the controller admits and qualifies an archive RPC for that chain.

Use `phases/phase-7/resources/PHASE7_LIFECYCLE_RECIPES.md` as the standard recipe catalog. Prefer a recognized recipe; unsupported behavior is a typed `RECIPE_GAP`, not permission to invent arbitrary execution.


## Maximum simulation coverage requirements

Before selecting lifecycle recipes, enumerate the externally reachable functions, privileged operations, accounting state transitions, and integration assumptions that require validation. Simulation scope must be derived from this enumeration. Missing a reachable behavior is a coverage gap, not evidence that testing is unnecessary.

Successful happy-path execution alone does not satisfy lifecycle assurance. Each scenario must evaluate applicable failure modes, boundary states, adversarial conditions, and accounting invariants in addition to expected successful execution.

## Deterministic domain-to-simulation gate

Phase 7 MUST consume the current Domain Applicability Registry when selecting lifecycle scenarios. Every `TRIGGERED`/`UNCERTAIN_INCLUDE` domain with a material expressible lifecycle property/hypothesis must map to a `SIM-*` record, an explicit permitted non-expressible disposition, `RECIPE_GAP`, or typed blocker/limitation. New evidence that changes applicability requires registry reevaluation before sealing.

## Mandatory end-of-phase structured filing

Before this phase may enter `EVIDENCE_SEALED`, complete `phases/phase-7/resources/PHASE7_SIMULATION_LIFECYCLE_LEDGER.md` as the canonical **Phase 7 Simulation Lifecycle Ledger**, bind it to the exact phase/source identity, and record its durable reference/digest in `shared/reporting/PHASE_REPORT.md`. Do not substitute narrative prose for the structured artifact. Use explicit `NOT_APPLICABLE`/typed limitation states rather than blanks where a field or row does not apply.

The lifecycle ledger must contain one stable `SIM-*` record for every executed/required lifecycle, deterministic reproduction, repeated-state, integration, or triggered scenario and must explicitly record `RECIPE_GAP`/`NOT_APPLICABLE` states. Reconcile it with `shared/reporting/Contract_Deployment_Gas_Report.md` before sealing.

The Phase Report must also complete the **Source Intelligence checkpoint**, including the accepted Bundle Index revision/commit/digest, every materially used component revision/commit/digest/status/invalidation state, reuse or regeneration status, and the relevant sections materially reviewed in this phase. The Phase Report must also complete the universal sections **Canonical outputs created**, **New canonical audit facts**, **Carried-forward obligations**, and **Evidence invalidation triggers**. It must classify every material observed change under the Evidence Invalidation Matrix and record `NO_MATERIAL_CHANGE_EVENT` when none occurred. It must additionally record the current campaign-local **Security Traceability Graph** reference/digest and **Carried-Forward Obligation Ledger** reference/digest. Before sealing, reconcile every obligation due in this phase; an `OPEN` or `IN_PROGRESS` due obligation forbids `EVIDENCE_SEALED`. The carried-forward obligations table in the Phase Report is a projection of the canonical ledger, not a separate source of truth.

### Shared embedded-module gate rule

A conclusion may satisfy a gate only when it is bound to the exact source commit and its required evidence is accepted by a separate reviewer or the controller.

### Shared embedded-module common mistakes

- Treating confidence or prose as execution evidence.
- Omitting an unresolved assumption from the output.
- Reusing evidence from a different source, request, profile, or release.
