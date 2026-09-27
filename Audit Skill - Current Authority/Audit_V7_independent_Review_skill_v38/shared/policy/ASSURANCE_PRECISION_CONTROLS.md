# Assurance Precision Controls v1

These controls increase assurance precision with no new phase, lane, worker, controller command, execution profile, or client-report section. They are staged inside the existing ten-gate and seven-lane topology and reuse accepted evidence that already exists whenever it proves the exact claim.

## 1. Security-surface reconciliation

Control status: `SECURITY_SURFACE_RECONCILIATION_REQUIRED`.

In Phase 1, after exact build evidence exists, derive the security-relevant surface inventory from the exact compiled ABI plus exact-source inspection and store it in the immutable Source Intelligence core. Include:

- every external/public non-view/non-pure entry point;
- `receive` and `fallback` handlers;
- externally reachable callbacks and hooks;
- initializers, reinitializers, upgrade/admin entry points, arbitrary-call/delegatecall paths, and role/authority mutation;
- asset-moving, mint/burn, approve, claim, withdraw, borrow, liquidate, bridge, conversion, and fee/configuration paths; and
- any public/view surface whose output is security-sensitive because it governs authorization, pricing/oracles, accounting, redeemability, solvency, or another contract's state transition.

Phase 4 consumes that accepted inventory and records review coverage/semantic conclusions in the Phase-4 implementation ledger without reconstructing or mutating the Phase-1 inventory. A row is `COVERED` only when at least one accepted ledger entry names the exact source/range or unambiguous signature and records substantive checks. Any `UNREVIEWED` row requires bounded Phase-4 rework and blocks Phase 8 terminalization. Compiler-generated or genuinely non-security-relevant ABI noise is dispositioned before Phase 1 seals rather than marked as reviewed.

This is a completeness gate, not a percentage metric. Do not report synthetic coverage percentages and do not add a second generic manual review.

## 2. Risk-weighted independent review

Control status: `RISK_WEIGHTED_INDEPENDENT_REVIEW`.

Before Phase 8 independent validation, the controller derives a neutral risk-priority set from structural evidence only: accepted Source Intelligence surfaces/topology, asset-flow evidence, authority graph, threat model/attack trees, economic invariant matrix, and exact source structure. Candidate findings, dismissals, severity decisions, and earlier conclusions are not included in the source-first packet.

The priority set must include every path capable of direct principal/custody loss, insolvency, unbounded mint or authority capture, permanent asset lock, upgrade/ownership takeover, oracle-critical control, or equivalent high-consequence failure. It also includes representative highest-consequence paths from each distinct risk domain present. Keep lower-consequence representatives bounded; do not truncate high-consequence paths to satisfy an arbitrary count.

Fresh `reviewer-4` performs a two-stage independent review in Phase 8:

1. **Source-first retrace:** receive only neutral path identity, exact source scope, and structural evidence references; independently trace preconditions, state changes, external calls, value movement, authorization, failure modes, and invariants; seal conclusions before seeing first-pass conclusions.
2. **Reconciliation:** only after the source-first record is immutable, compare against the four clean-room submissions and identify missed, contradicted, weakly evidenced, or correlated conclusions.

This preserves maximum-coverage validation while adding risk-weighted depth inside the existing Phase-8 reviewer boundary.

## 3. Targeted deterministic finding simulation

Control status: `TARGETED_FINDING_SIMULATION_REQUIRED` when a trigger applies.

Do not simulate every finding. A targeted simulation is required before final severity when one or more of these conditions materially determine whether the finding exists or how severe it is:

- state-sequence, ordering, timing, checkpoint, or lifecycle dependence;
- accounting/value transition, rounding, fee, slippage, or quantitative economic effect;
- cross-user value transfer, capture, inheritance, or dilution;
- material disagreement between lanes/reviewer about exploitability, impact, or severity; or
- another behavioral claim that static source evidence cannot conclusively establish.

Reuse an already accepted Phase 7 lifecycle simulation if it proves the exact finding claim against the exact source and assertions. Otherwise issue one minimal deterministic `github-native-simulate-v2` request under the existing Phase 8 `findings-validation` gate. Encode the finding ID, hypothesis, minimal setup/steps, pinned block/environment, and assertions in the existing request `configuration` object; do not change the external request schema.

The accepted result is `CONFIRMED`, `REFUTED`, or `INCONCLUSIVE`. When the trigger is active and severity depends on the behavior, `INCONCLUSIVE` does not authorize severity freeze; use the normal repair/alternate-path ladder and, if the required claim cannot be deterministically resolved, record the process obligation as `FAIL` rather than inventing certainty.

Purely static, undisputed findings whose root cause and impact are completely established from source do not require an extra simulation.

For Phase 9, if remediation changes behavior covered by any trigger above, require the exact targeted scenario as regression evidence before marking the finding resolved. Reuse the Phase 8 scenario definition where possible.

## 4. Conditional live-deployment release attestation

Control status: `LIVE_DEPLOYMENT_ATTESTATION_REQUIRED` only for `deploymentMode: LIVE_DEPLOYED` or `deploymentMode: MIXED`.

Phase 1 freezes `deploymentMode`, chain IDs, and every discoverable in-scope deployed address in the runtime/deployment overlay, but marks runtime and gas acceptance pending. `deploymentAttestationRequired` is deterministic: `false` only for `PRE_DEPLOYMENT`; `true` for `LIVE_DEPLOYED` or `MIXED`. For `PRE_DEPLOYMENT` campaigns, audited contracts are expected to be deployed during fork simulations. Only lifecycle-required external dependencies must already have code/state at the pinned fork block.

After exact build evidence exists, attest each in-scope live contract against the audited release using authoritative chain/RPC/explorer evidence:

- chain ID and deployed address;
- observed runtime code and cryptographic code identity;
- proxy/beacon/implementation identity where applicable, including security-critical admin/implementation slots;
- comparison against the exact compiled deployed-runtime artifact, with immutable/link-reference normalization documented when exact raw-byte equality is not valid;
- critical configuration identified by the accepted authority graph/threat model, limited to security-relevant ownership/admin/role, strategy/oracle/converter/keeper/treasury/fee/timelock or equivalent controls actually present; and
- evidence block number/hash or equivalent immutable chain reference.

Do not sweep arbitrary storage or add a generic configuration checklist. Attest only security-critical configuration identified by the audit model.

If observed runtime/implementation identity does not correspond to the audited source, do not claim the deployed system was audited. Freeze the discrepancy, revise the source to the actual deployed implementation when possible, and rerun source-bound work through the existing `campaign.revise_source` path. If required live identity cannot be established after the normal recovery ladder, the live-deployment attestation is `UNATTESTABLE` and blocks finalization as a process failure. Security-relevant configuration mismatches are analyzed as findings rather than silently normalized away.

Phase 7 validates the technical build/lifecycle/live-state evidence and accepts a new runtime-overlay revision. Phase 10 independently verifies the final accepted bundle component identities when `deploymentAttestationRequired: true`. No live attestation is created for ordinary pre-deployment campaigns.

## 5. Gate placement and finalization binding

These controls do not alter the controller topology:

- Phase 1 produces the immutable structural security-surface inventory, static topology and preliminary compiler gas; it initializes both overlays without later-phase acceptance.
- Phase 4 produces the accepted implementation-review coverage ledger against that inventory.
- Phase 6A accepts assurance-readiness adequacy in a revisioned overlay; Phase 6B/6C consume it.
- Phase 7 accepts runtime/configuration/deployment-gas evidence in the runtime overlay.
- Phase 8 requires zero `UNREVIEWED` security surfaces and all triggered finding simulations required to freeze finding existence/severity, and performs the risk-weighted two-stage review.
- Phase 9 requires triggered remediation simulations when behavior-sensitive fixes are claimed resolved.
- Phase 10 verifies the final accepted bundle index/components and binds exact IDs for reconciliation, risk-weighted review, targeted simulations and conditional live attestation.

A missing required precision-control artifact is a process obligation, not a security finding. Repair it; if irrecoverable, record `FAIL` and do not finalize.
