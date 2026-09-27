<!--M:controller-operated-execution:df5860d50d8b1b4c360a5f51ca3dd20ecddf51329f77270a2635eb95a3534237-->
### `controller-operated-execution`
Trigger: Use when exact-source compilation or an admitted pinned archive-fork simulation is required for retained Lite deploy/configuration or candidate-specific execution.

## Objective

Route technical processing through the accepted GitHub bridge without requester-controlled execution authority.

## Review Contract

- Use only controller-admitted execution profiles. Merged Lite Phase 6–7 may use exact compile and simulation operations only for build admission, complete deploy/configuration simulation, deterministic candidate proof, or basic targeted fuzzing. Do not request excluded Full campaigns.
- Generate the request deterministically from structured campaign data.
- Create exactly one request.json file in its request-ID directory on the release branch.
- Discover the run through commit status, then validate jobs, artifacts, hashes, normalized result, and tool versions.

## Required Output

An accepted technical-result review bound to request digest, exact source, artifact digest, and runner release.
