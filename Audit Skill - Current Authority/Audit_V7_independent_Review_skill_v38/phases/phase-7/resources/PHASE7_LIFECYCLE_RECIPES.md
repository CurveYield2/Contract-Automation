# Phase 7 Standard Lifecycle Recipes v1

Phase 7 uses `github-native-simulate-v2` and the allowlisted workflow DSL. Prefer a standard recipe below over inventing a one-off lifecycle. A recipe is a deterministic composition of supported actions; it does not grant arbitrary command execution.

## Recipe catalog

### `external-readiness-v1`
Purpose: verify pinned external dependency identity/state before value-moving tests.
Actions: `staticCall`, `assertCall`, optional `snapshot`.
Required assertions: expected code/read surfaces, ownership/admin/pause/oracle/config values when interfaces permit.

### `deploy-configure-smoke-v1`
Purpose: deploy every independently deployable production contract and exercise intended one-time configuration ordering.
Actions: `deploy`, `call`, `staticCall`, `assertCall`, `expectRevert`.
Required assertions: deployment succeeds with exact accepted artifacts; initialization/configuration reaches expected terminal state; stale ABI calls are reproduced as failures rather than patched.

### `deposit-withdraw-cycle-v1`
Purpose: validate custody/accounting across a complete user lifecycle.
Actions: `setBalance`, `call`, `staticCall`, `assertCall`, `assertBalance`, `increaseTime`, `mine`.
Required assertions: deposit attribution, share/accounting invariants, withdrawal value, fee bounds, and no stranded/unowned value across restart where applicable.

### `reward-accrual-claim-v1`
Purpose: validate rewards over time and zero/nonzero supply transitions.
Actions: `setBalance`, `call`, `increaseTime`, `mine`, `staticCall`, `assertCall`.
Required assertions: index/checkpoint progression, claimability, zero-supply handling, terminal recovery path, and bounded rounding.

### `privilege-transition-v1`
Purpose: validate owner/DAO/operator/keeper/delegate transitions and stale privilege effects.
Actions: `call`, `expectRevert`, `staticCall`, `assertCall`, `snapshot`, `revertSnapshot`.
Required assertions: authorized transition succeeds, unauthorized transition reverts, dependent cached/derived state refreshes where required.

### `external-swap-minout-v1`
Purpose: validate converter/router/pool integration with atomic min-out protection.
Actions: `setBalance`, `call`, `staticCall`, `expectRevert`, `snapshot`, `revertSnapshot`.
Required assertions: route uses intended external target, final minOut is enforced atomically, stale/invalid route fails safely, units/decimals remain consistent.

### `zero-supply-restart-v1`
Purpose: validate final-exit and first-redeposit behavior.
Actions: `call`, `increaseTime`, `mine`, `staticCall`, `assertCall`, optional `snapshot`.
Required assertions: prior-cycle ordinary rewards/debt/value cannot be silently transferred to the new first depositor unless explicitly specified.

### `repeated-lifecycle-v1`
Purpose: catch state that becomes unsafe only after multiple cycles.
Actions: any allowlisted actions required by one of the standard lifecycle recipes, repeated deterministically.
Required assertions: invariants hold across at least two complete cycles and after snapshot/revert where used.

## Recipe selection

The Phase-7 property ledger maps each carried security property/candidate to one or more recipes. If no standard recipe can express a required property, record `RECIPE_GAP` before execution. Do not invent an unsupported action. A recipe gap is resolved by adding a new allowlisted runner capability through repository-level qualification, or by recording a typed limitation if the property is not executable within the trusted boundary.
