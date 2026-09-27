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

## Required Output

An accepted technical-result review bound to request digest, exact source, artifact digest, and runner release.
