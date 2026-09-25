# Adversarial KB Existing Asset Inventory v1

Baseline: `CurveYield2/Contract-Automation@468b749076fb5b9c166c14a187fdd29a6f967acd`.

This inventory exists to prevent the historical-exploit KB from rebuilding execution infrastructure that V7 already has. Classifications are deliberately strict: `REUSE` means consume the existing canonical surface, `ADAPT` means reuse only after target/campaign rebinding, `ARCHIVE` means retain as historical evidence/example rather than global machinery, and `MISSING` is an explicit gap to implement later.

| Asset | Classification | Decision |
|---|---|---|
| Phase-6 Medusa/Foundry harness skeleton kit v2 | REUSE | Canonical harness source; do not recreate. |
| Existing campaign audit harnesses | ADAPT | Examples only; campaign bindings must not leak into global KB. |
| Phase-6 harness authoring/overlay helpers | REUSE | Use existing source-bound materialization. |
| cyvlSDT source model | ARCHIVE | Target-specific evidence/model, not a general primitive. |
| Phase-7 lifecycle recipes | REUSE | Reuse existing lifecycle grammar and validators. |
| Dedicated historical exploit fixture corpus | MISSING | K07-K14 must create the first evidence-backed vertical slice. |
| Generic VaultSystem controlled fixture | ADAPT | Useful controlled fixture where topology fits. |
| Phase-6 and Phase-7 fork preflights | REUSE | No KB bypass or parallel preflight. |
| Archive RPC/code readiness helpers | REUSE | Directly useful for historical replay qualification. |
| Execution/result/disposition normalization | REUSE | Extend existing evidence surface. |
| Mutable RPC + staged snapshot helpers | REUSE | Preserve trusted RPC secret isolation/pinned state. |
| Medusa E2E smoke | REUSE | Backend qualification building block. |
| Existing Anvil runner | REUSE | Authoritative mutable full-simulation backend. |
| Canonical V7 execution + qualification workflows | REUSE | Exploit cases are data, not workflows. |
| Runner manifest | REUSE | Capability discovery/integration surface. |
| Existing negative/failure regression tests | REUSE | Feed K21 failure-doctor signatures. |
| Historical BoostHub/lifecycle campaign workflows/requests | ADAPT | Normalize useful scenarios into recipes; do not make campaign scripts global truth. |
| PR #126 v26 machine evidence/reproduction stack | ADAPT | Pending merge; integrate if/when canonical. |
| PR #122 universal preflight stack | ADAPT | Pending merge; integrate if/when canonical. |

## K01 conclusions

1. A parallel harness library is forbidden: the v2 skeleton kit is already canonical.
2. A parallel Anvil/Medusa/Foundry execution plane is unnecessary and would violate repository policy.
3. The main genuine content gap is a reusable evidence-backed historical exploit corpus with proof-tiered incident/pattern/recipe/executable records.
4. Historical campaign workflows are inputs for recipe extraction, not historical exploit proof by themselves.
5. Active PRs #126 and #122 materially overlap future KB integration; they remain `ADAPT` until merged rather than being copied into this branch.
