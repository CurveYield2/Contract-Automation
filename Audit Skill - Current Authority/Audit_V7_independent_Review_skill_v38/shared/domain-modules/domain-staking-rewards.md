<!--M:domain-staking-rewards:e7e0d184c17d888a77076697542bdc9a81c3617c6fa1b6f156ab884f0b02bb8d-->
### `domain-staking-rewards`
Trigger: Use when staking, reward checkpoints, multiple reward tokens, boosts, penalties, claims, or emissions are in scope

## Objective

Verify reward conservation, checkpoint ordering, direct-transfer behavior, and exit accounting.

## Review Contract

- Trace stake, unstake, reward notification, checkpoint, claim, fee, penalty, and emergency paths.
- Review uncheckpointed transfers, zero supply, reward duration, token limits, and repeated claims.
- Reconcile distributed, claimable, claimed, and retained amounts.
- Review boost authority and cross-contract synchronization.

## Required Output

A staking-reward ledger and reward conservation proof.
