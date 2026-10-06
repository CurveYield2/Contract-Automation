# Development Agent Task-Lock State v1

## END-STATE INVARIANT

CurveYield2/Smart-Contracts contains a complete, reviewable cyvbETH IPOR vault contract plus deployment and testing stack derived by minimal modification from the current proven cyvbWBTC implementation. cyvbETH must preserve cyvbWBTC behavior, fee/accounting/LTV/keeper/admin/deployment semantics, and testing expectations except where vbETH necessarily replaces vbWBTC and where the keeper may allocate any chosen portion of vault-held vbETH to the Katana Morpho variable market `0x2c4f26c76b4de51d3c9260c15a796cd2a35efab17786d0aa78ca2e638b0f8ba8` (vbETH / yvvbUSDC) as a lending-supply position instead of deploying 100% of vbETH into f(x)/fxMINT. The resulting stack must support keeper-controlled movement/allocation between idle vbETH, the existing cyvbWBTC-equivalent f(x)/fxMINT path adapted to vbETH, and the specified Morpho lending market; compile and focused tests must pass; deployment configuration must be explicit and reproducible; and the available Katana fork/deployment lifecycle validation must pass without weakening existing cyvbWBTC safety or accounting behavior.

## CURRENT MAIN

- Contract-Automation main after creation of this canonical lock: `d3c37d4901a94fb0e8fa54adf5cb2018e138c341`.
- Smart-Contracts live main verified after lock creation: `ae583cf5a616200534b06cbd2a20ba04814be07f`.

## AUTHORITY

- Human specification in the active task is controlling: cyvbETH is a cyvbWBTC clone with vbETH substituted for vbWBTC, plus keeper-controlled optional lending of vbETH into Morpho Katana market `0x2c4f26c76b4de51d3c9260c15a796cd2a35efab17786d0aa78ca2e638b0f8ba8`.
- Human specification: everything else remains exactly the same as cyvbWBTC.
- Human requirement: create this task/focus lock in Contract-Automation before any Smart-Contracts implementation work.
- `FOCUS/TASK LOCKS/TASK_LOCK_PROTOCOL_v1.md`.
- Live `CurveYield2/Smart-Contracts` current main and its current cyvbWBTC implementation, deployment stack, tests, and repository-local instructions once inspected.
- Existing proven public/protocol code must be reused where possible; make the smallest modifications required rather than replacing working implementations.

## SATISFIED

- Task scope and end-state are locked before Smart-Contracts implementation work.
- The required Morpho market identifier is recorded exactly: `0x2c4f26c76b4de51d3c9260c15a796cd2a35efab17786d0aa78ca2e638b0f8ba8`.
- The keeper-allocation rule is locked: cyvbETH is not required to place 100% of vbETH into f(x)/fxMINT; the keeper controls how much vbETH is supplied to the specified Morpho market.
- The smallest-delta implementation rule is locked: start from the current cyvbWBTC stack and change only what vbETH and the optional Morpho allocation require.

## REMAINING DELTA

1. Inspect Smart-Contracts current main, repository instructions, and the complete live cyvbWBTC contract/deployment/test stack; identify the exact minimum clone surface.
2. Resolve and verify the live Katana vbETH token address plus the vbETH-specific f(x)/fxMINT market/configuration needed to reproduce cyvbWBTC behavior for vbETH.
3. Resolve and verify the specified Morpho market's exact on-chain parameters and the existing official Morpho interfaces/code path that should be reused.
4. Create the versioned cyvbETH contract/deployment/testing files by copying the proven cyvbWBTC equivalents and applying minimal vbETH-specific substitutions.
5. Add the smallest keeper-controlled Morpho allocation interface required to supply/withdraw/reallocate vbETH while preserving vault accounting, access control, fees, and liquidity behavior.
6. Ensure total-assets/accounting includes idle vbETH, f(x)/fxMINT exposure, and the Morpho supplied position without double counting.
7. Add/update focused tests for parity with cyvbWBTC plus keeper Morpho allocation, withdrawal/reallocation, accounting, authorization, and mixed-allocation behavior.
8. Add/update deployment configuration/scripts for cyvbETH and the verified Katana addresses.
9. Run repository-supported compile/static validation and focused tests in GitHub; repair only failures that block this invariant.
10. Run the available Katana fork/deployment/lifecycle simulation for the completed cyvbETH stack, including mixed f(x)/Morpho allocation, and capture verifiable execution evidence.
11. Verify the final repository delta against this invariant and leave no unresolved implementation requirement.

## PARKED OBSERVATIONS

- Unrelated Smart-Contracts refactors, formatting cleanups, dependency upgrades, audit-system work, browser automation, and Contract-Automation redesign.
- Changes to cyvbWBTC unless a minimal shared fix is strictly required for cyvbETH correctness and live evidence proves the existing behavior is defective.
- New generic protocol adapters or abstractions when an existing IPOR/Morpho implementation can be copied or minimally adapted.
- Production transactions or production keeper actions; this task is contract/deployment/testing-stack implementation and validation.

## ACTIVE BLOCKER

None.

## NEXT ACTION

Inspect the exact current Smart-Contracts main state and repository-local instructions, then map the current cyvbWBTC contract, deployment, tests, and Katana simulation inputs file-by-file. Use that live implementation as the immutable behavioral baseline and compute the smallest cyvbETH delta before editing implementation code.
