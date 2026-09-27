# Phase 4 — Manual Implementation & Integration Review

> **CURRENT-PHASE READ BOUNDARY:** Read this card first. Do **not** open another phase folder. Open only the resource linked by the active step below; conditional resources are opened only when their trigger applies.

> **PHASE CONTRACT HARD GATE:** Before executing Step 1, open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json). It is the machine-readable contract for this phase: required inputs, ordered steps, outputs, global checkpoints, seal criteria, recovery routes, reviewer authority, and allowed next states. If this card and the contract appear inconsistent, stop phase progression and repair the packet/control inconsistency; do not choose the weaker requirement.

> **UNIVERSAL RULE IDS:** `U-EXEC-001`, `U-GITHUB-001`, `U-STATE-001`, `U-EVIDENCE-001`, `U-REPAIR-001`, `U-HUMAN-001`, `U-DISCLOSURE-001`, `U-SOURCEINTEL-001`, `U-UPDATES-001`, and `U-HUMANCOMMS-001` remain binding. Full normative text exists only in the [homepage](../../SKILL.md#universal-hard-rules); this phase card may add narrower requirements but must not redefine or weaken those rules.

> **SOURCE INTELLIGENCE REUSE GATE (`U-SOURCEINTEL-001`):** Before any active step that needs structural, runtime/deployment, or assurance-readiness facts, load the latest controller-accepted `SOURCE_INTELLIGENCE_BUNDLE_INDEX.json`; verify its committed index identity and every materially used component’s accepted revision, commit SHA, SHA-256, status, invalidation state, and exact source/build binding. A mutable path is navigation only. Reuse and verify accepted facts; **do not recreate Phase-1 inventories for orientation**. Raw source review remains mandatory for semantic reasoning, contradiction checks, reachability, reproduction, or remediation validation. On a mismatch, reject unaccepted bytes and apply the [Source Intelligence protocol](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) and Evidence Invalidation Matrix.

> **THIS PHASE REVIEWS:** the accepted Phase-1 `securitySurfaces` plus contracts/functions, calls, privileges, interfaces, value flows, storage, and anchors as the manual coverage baseline. Record Phase-4 coverage, semantic conclusions and discrepancies in the Phase-4 registry; do not recreate or mutate the Phase-1 inventory.

## Phase card

| Step | Action | What to do | Open only when this step is active |
|---:|---|---|---|
| 1 | **Enter the isolated manual-implementation lens** | Bind exact source/revision and preserve source-first review isolation. | [SOLO_LENS_ISOLATION_PROTOCOL.md](../../shared/lenses/SOLO_LENS_ISOLATION_PROTOCOL.md) · [manual-implementation-lens.md](../../shared/lenses/manual-implementation-lens.md) |
| 2 | **Revalidate deterministic domain applicability** | Verify the Phase-3 registry against the exact current source and new evidence. Promote any ambiguity/new signal to UNCERTAIN_INCLUDE or TRIGGERED before specialist review. | [DOMAIN_APPLICABILITY_MATRIX.json](../../shared/controller/DOMAIN_APPLICABILITY_MATRIX.json) · [DOMAIN_APPLICABILITY_REGISTRY.json](../../shared/controller/DOMAIN_APPLICABILITY_REGISTRY.json) |
| 3 | **Review EVM implementation and sensitive flows** | Use Source Intelligence as the contract/function/call/value-flow coverage baseline, then perform source-first line/flow/integration review across state transitions, external calls, accounting, access and failure behavior. Verify semantic correctness and record discrepancies; do not recreate accepted structural inventories. | [evm-contract-review.md](resources/audit-modules/evm-contract-review.md) |
| 4 | **Review governance and privilege paths** | Use accepted privilege/function/source-anchor candidates as the baseline and inspect the semantic correctness of every privileged entrypoint and authority transition; do not rebuild the raw privilege inventory. | [governance-privileges.md](resources/audit-modules/governance-privileges.md) |
| 5 | **Review DOMAIN-UPGRADE when activated** | Execute the specialist method/ledger for TRIGGERED or UNCERTAIN_INCLUDE; skip only with a current evidence-bound NOT_TRIGGERED decision. | [upgradeability.md](../../shared/domain-modules/upgradeability.md) · [UPGRADE_SAFETY_LEDGER.md](../../shared/domain-ledgers/UPGRADE_SAFETY_LEDGER.md) |
| 6 | **Review DOMAIN-DEPENDENCY when activated** | Execute the specialist method/ledger for TRIGGERED or UNCERTAIN_INCLUDE; skip only with a current evidence-bound NOT_TRIGGERED decision. | [external-dependencies.md](../../shared/domain-modules/external-dependencies.md) · [EXTERNAL_DEPENDENCY_LEDGER.md](../../shared/domain-ledgers/EXTERNAL_DEPENDENCY_LEDGER.md) |
| 7 | **Review DOMAIN-CROSSCHAIN when activated** | Execute the specialist method/ledger for TRIGGERED or UNCERTAIN_INCLUDE; skip only with a current evidence-bound NOT_TRIGGERED decision. | [cross-chain.md](../../shared/domain-modules/cross-chain.md) · [CROSS_CHAIN_LEDGER.md](../../shared/domain-ledgers/CROSS_CHAIN_LEDGER.md) |
| 8 | **Review DOMAIN-VAULT when activated** | Execute the vault/strategy specialist method and ledger for TRIGGERED or UNCERTAIN_INCLUDE. | [domain-vaults-strategies.md](../../shared/domain-modules/domain-vaults-strategies.md) · [VAULT_STRATEGY_LEDGER.md](../../shared/domain-ledgers/VAULT_STRATEGY_LEDGER.md) |
| 9 | **Review DOMAIN-ORACLE when activated** | Execute the oracle specialist method and ledger for TRIGGERED or UNCERTAIN_INCLUDE. | [domain-oracles.md](../../shared/domain-modules/domain-oracles.md) · [ORACLE_ASSURANCE_LEDGER.md](../../shared/domain-ledgers/ORACLE_ASSURANCE_LEDGER.md) |
| 10 | **Review DOMAIN-LENDING when activated** | Execute the lending/liquidation specialist method and ledger for TRIGGERED or UNCERTAIN_INCLUDE. | [domain-lending-liquidation.md](../../shared/domain-modules/domain-lending-liquidation.md) · [LENDING_LIQUIDATION_LEDGER.md](../../shared/domain-ledgers/LENDING_LIQUIDATION_LEDGER.md) |
| 11 | **Review DOMAIN-AMM when activated** | Execute the AMM/hooks specialist method and ledger for TRIGGERED or UNCERTAIN_INCLUDE. | [domain-amm-hooks.md](../../shared/domain-modules/domain-amm-hooks.md) · [AMM_HOOK_LEDGER.md](../../shared/domain-ledgers/AMM_HOOK_LEDGER.md) |
| 12 | **Review DOMAIN-SIGNATURE when activated** | Execute the signatures/AA specialist method and ledger for TRIGGERED or UNCERTAIN_INCLUDE. | [domain-signatures-aa.md](../../shared/domain-modules/domain-signatures-aa.md) · [SIGNATURE_AA_LEDGER.md](../../shared/domain-ledgers/SIGNATURE_AA_LEDGER.md) |
| 13 | **Review DOMAIN-STAKING when activated** | Execute the staking/rewards specialist method and ledger for TRIGGERED or UNCERTAIN_INCLUDE. | [domain-staking-rewards.md](../../shared/domain-modules/domain-staking-rewards.md) · [STAKING_REWARD_LEDGER.md](../../shared/domain-ledgers/STAKING_REWARD_LEDGER.md) |
| 14 | **Review DOMAIN-OFFCHAIN when activated** | Execute the off-chain automation specialist method and ledger for TRIGGERED or UNCERTAIN_INCLUDE. | [offchain-critical-automation.md](../../shared/domain-modules/offchain-critical-automation.md) · [OFFCHAIN_AUTOMATION_LEDGER.md](../../shared/domain-ledgers/OFFCHAIN_AUTOMATION_LEDGER.md) |
| 15 | **Prove specialist-domain completeness** | Reconcile all ten registry decisions. Every TRIGGERED/UNCERTAIN_INCLUDE domain must point to completed specialist evidence or a typed blocking/limitation record; every skip must point to current NOT_TRIGGERED evidence. | [DOMAIN_APPLICABILITY_REGISTRY.json](../../shared/controller/DOMAIN_APPLICABILITY_REGISTRY.json) · [PHASE4_MANUAL_COVERAGE_CANDIDATE_REGISTRY.md](resources/PHASE4_MANUAL_COVERAGE_CANDIDATE_REGISTRY.md) |
| 16 | **Record coverage, candidates and execution targets** | Reconcile manual contract/function/flow coverage, candidate issues, unresolved assumptions and explicit Phase-6/7 targets, including domain-specific targets. | [PHASE4_MANUAL_COVERAGE_CANDIDATE_REGISTRY.md](resources/PHASE4_MANUAL_COVERAGE_CANDIDATE_REGISTRY.md) |
| 17 | **Reconcile campaign-global security state** | Update the Security Traceability Graph and obligation ledger using specialist-domain evidence; freeze graph/domain/obligation digests for the Phase Report. OPEN/IN_PROGRESS obligations due now block sealing. Classify every material observed change under the Evidence Invalidation Matrix before reusing affected evidence. | [SECURITY_TRACEABILITY_GRAPH.json](../../shared/controller/SECURITY_TRACEABILITY_GRAPH.json) · [DOMAIN_APPLICABILITY_REGISTRY.json](../../shared/controller/DOMAIN_APPLICABILITY_REGISTRY.json) · [CARRIED_FORWARD_OBLIGATION_LEDGER.json](../../shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json) · [EVIDENCE_INVALIDATION_MATRIX.json](../../shared/controller/EVIDENCE_INVALIDATION_MATRIX.json) |
| 18 | **File the phase report and auto-advance** | Seal the required structured artifact/global checkpoints, file the immutable Phase Report, enter AUTO_ADVANCE_READY, and immediately continue into the next same-reviewer phase under the Automatic Phase Advancement Protocol. Do not wait for human approval. | [PHASE_REPORT.md](../../shared/reporting/PHASE_REPORT.md) · [AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md](../../shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md) |
## Audit-module resources in this phase

- [`evm-contract-review`](resources/audit-modules/evm-contract-review.md)
- [`governance-privileges`](resources/audit-modules/governance-privileges.md)
- [`upgradeability`](../../shared/domain-modules/upgradeability.md)
- [`external-dependencies`](../../shared/domain-modules/external-dependencies.md)
- [`cross-chain`](../../shared/domain-modules/cross-chain.md)
- [`domain-vaults-strategies`](../../shared/domain-modules/domain-vaults-strategies.md)
- [`domain-oracles`](../../shared/domain-modules/domain-oracles.md)
- [`domain-lending-liquidation`](../../shared/domain-modules/domain-lending-liquidation.md)
- [`domain-amm-hooks`](../../shared/domain-modules/domain-amm-hooks.md)
- [`domain-signatures-aa`](../../shared/domain-modules/domain-signatures-aa.md)
- [`domain-staking-rewards`](../../shared/domain-modules/domain-staking-rewards.md)
- [`offchain-critical-automation`](../../shared/domain-modules/offchain-critical-automation.md)

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


## Deterministic specialist-domain execution gate

Phase 4 MUST execute every specialist domain whose current exact-source-bound registry status is `TRIGGERED` or `UNCERTAIN_INCLUDE`. A specialist module/ledger may be skipped only when the registry contains a current `NOT_TRIGGERED` decision with evidence satisfying the matrix negative-evidence requirement. Before sealing, prove all ten domain decisions are reconciled and bind each activated domain to specialist evidence or a typed blocker/limitation.

## Mandatory end-of-phase structured filing

Before this phase may enter `EVIDENCE_SEALED`, complete `phases/phase-4/resources/PHASE4_MANUAL_COVERAGE_CANDIDATE_REGISTRY.md` as the canonical **Phase 4 Manual Coverage & Candidate Registry**, bind it to the exact phase/source identity, and record its durable reference/digest in `shared/reporting/PHASE_REPORT.md`. Do not substitute narrative prose for the structured artifact. Use explicit `NOT_APPLICABLE`/typed limitation states rather than blanks where a field or row does not apply.

The Phase Report must also complete the **Source Intelligence checkpoint**, including the accepted Bundle Index revision/commit/digest, every materially used component revision/commit/digest/status/invalidation state, reuse or regeneration status, and the relevant sections materially reviewed in this phase. The Phase Report must also complete the universal sections **Canonical outputs created**, **New canonical audit facts**, **Carried-forward obligations**, and **Evidence invalidation triggers**. It must classify every material observed change under the Evidence Invalidation Matrix and record `NO_MATERIAL_CHANGE_EVENT` when none occurred. It must additionally record the current campaign-local **Security Traceability Graph** reference/digest and **Carried-Forward Obligation Ledger** reference/digest. Before sealing, reconcile every obligation due in this phase; an `OPEN` or `IN_PROGRESS` due obligation forbids `EVIDENCE_SEALED`. The carried-forward obligations table in the Phase Report is a projection of the canonical ledger, not a separate source of truth.

### Shared embedded-module gate rule

A conclusion may satisfy a gate only when it is bound to the exact source commit and its required evidence is accepted by a separate reviewer or the controller.

### Shared embedded-module common mistakes

- Treating confidence or prose as execution evidence.
- Omitting an unresolved assumption from the output.
- Reusing evidence from a different source, request, profile, or release.
