<!--M:controller-operated-execution:df5860d50d8b1b4c360a5f51ca3dd20ecddf51329f77270a2635eb95a3534237-->
### `controller-operated-execution`
Trigger: Use when exact-source compilation or an admitted pinned archive-fork simulation is required during a campaign. At this release the admitted Phase-7 archive fork is Ethereum only; Base and other chains require a future controller-admitted archive RPC profile.

## Objective

Route technical processing through the accepted GitHub bridge without requester-controlled execution authority.

## Review Contract

- Use only the controller-admitted V2 execution profiles. Phase 6/7 execution uses `github-native-simulate-v2`; `github-native-compile-v2` is permitted only where the admitted execution contract and phase routing explicitly require compilation-only work. `*-v1` profiles are historical/non-executable and MUST NOT be used for new audit execution.
- Generate the request deterministically from structured campaign data.
- Create exactly one request.json file in its request-ID directory on the release branch.
- Discover the run through commit status, then validate jobs, artifacts, hashes, normalized result, and tool versions.
- **Deployment-gas recording is part of this existing simulation/deployment lifecycle.** As the lifecycle compiles and deploys every independently deployable production contract, capture the **compiler deployment-gas estimate** from the same accepted compiler output used for that contract. Use the same exact compiler version, same optimizer configuration, same EVM target/settings, and the same source identity as the deployment simulation.
- Record one row per independently deployable production contract and chain/configuration in `shared/reporting/Contract_Deployment_Gas_Report.md`. The mandatory columns are: `Contract | Chain | Compiler | Optimization | Runtime bytes | Deployment gas estimate`.
- If the accepted compiler does not expose a numeric deployment-gas estimate for a contract, do not omit the contract. Record `UNAVAILABLE` plus a typed reason in that row and preserve the supporting compiler artifact/reference.
- Reconcile the gas-report rows against the frozen deployable-contract inventory before sealing Phase 7. A missing deployable production contract is incomplete Phase-7 evidence.
- This is a recording obligation attached to the simulation already being performed: **do not create a second deployment workflow** merely to obtain gas numbers, and do not substitute the compiler estimate for the actual deployability/simulation check.

## Required Output

An accepted technical-result review bound to request digest, exact source, artifact digest, and runner release, plus the current populated `shared/reporting/Contract_Deployment_Gas_Report.md` covering every independently deployable production contract.
