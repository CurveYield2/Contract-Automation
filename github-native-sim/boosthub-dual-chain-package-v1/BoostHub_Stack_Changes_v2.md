# BoostHub stack v2 — Fraxtal compatibility and recovered dependencies

This revision adds a separate Fraxtal URD helper compatible with the updated BoostHub. The Ethereum MultiMerkleStash helper is unchanged. BoostHub can now run without a vlBoost registry on Fraxtal.

| Component | Delivered version | Change in this revision |
|---|---:|---|
| BoostHub | 12 | Allows `vlBoost = address(0)`; skips boost calls and the boost event when absent; still validates and executes every requested gauge checkpoint. |
| IBoostHub | 5 | Unchanged revised pool/position/system interfaces. |
| Ethereum StakeDaoMerkleClaimExecutor | 8 | Unchanged indexed MultiMerkleStash claims. |
| Fraxtal StakeDaoFraxtalSdFxsUrdClaimExecutor | 5 | Updates verified Fraxtal v4 for `claimToken(pid, token)`, the 12-field `poolInfo` result, and `claimStakeDaoRewards(pid)`; binds a new Hub once instead of hardcoding the existing Hub. |
| BoostHubStaking | 20 | Unchanged token-by-token 45-day ramp and 65/35 foregone-reward split. |
| BoostHubDeploymentFactory | 1 | Caller-scoped CREATE3 deployment utility using pinned Solmate code. |

The Fraxtal helper retains chain ID 252, sdFXS PID 0, the verified Stake DAO URD address, cumulative-claim proofs, recipient protection, and actual balance-delta verification from v4. It supports sdFXS only; other registered gauge rewards continue through ordinary Hub harvest. It does not assume that vlBoost, MultiMerkleStash, or the old `execute(bytes[])` entry point exists on Fraxtal.

The Hub's claim executor remains mandatory. Configuring zero vlBoost does not suppress failed gauge checkpoints. An empty checkpoint list makes no boost call on Fraxtal. A nonzero valid Ethereum registry retains its previous behavior.

## Existing requested economics remain

Yield-boosting token retention, yield-token taxes, retained-token staking/withdrawals and converters remain removed. The Hub platform fee remains independently configurable. Every registered staking reward uses the existing 45-day ramp; 65% of the foregone ramp portion goes to active staker weight and 35% to the external fee receiver in that reward token. This is not a 35% fee on every gross reward. With all principal mature, the ramp admin fee is zero.

## Dependencies and deployment

The package now includes the verified originals of `IStakeDaoGauge.sol`, `IvlBoost.sol`, and `BoostHubErrors.sol`. Etherscan blocked source retrieval. The files were recovered from the verified source at the same address on Fraxscan and bound to Ethereum by a byte-for-byte match of the live Hub runtime on both chains. The source hashes and snapshot blocks are recorded in `dependency_provenance_v1.json`. This runtime identity statement concerns the old live Hub; the revised Hub is a new deployment.

The package includes the OpenZeppelin 5.4.0 and pinned Solmate import closure, licenses, exact Solidity standard-JSON input, compiled artifacts, a bundled Node runner, and a Windows PowerShell deployment/configuration script. Select a single target chain explicitly. No contract was deployed or transaction sent to a public chain by this work.

Read `Deployment_Instructions_v1.md` for setup, signing, configuration, resumable deployment, final role acceptance and Fraxtal proof submission. Configuration is a reference for a fresh deployment; existing stakes, balances, votes, queued changes and claim proofs do not migrate automatically. A new helper cannot be plugged into the old live Hub because its executor ABI is different.

## Verification and retained limitations

`verification_evidence_v2.json` records the final test counts and compiler/runtime results. The verification reruns the prior standalone and cross-contract regression suites against the recovered production declarations and adds Fraxtal helper/Hub/staking integration. Cases cover cumulative deltas, platform fees, retries, stale proofs, recipient protection, binding, chain restrictions, no-vlBoost gauge checkpoints, staking reward receipt and principal exit. Deployment acceptance tests use fresh contracts on local Anvil forks, including the live external dependencies and an idempotent rerun. Windows checks execute the extracted bundled package under Windows PowerShell 5.1.

Passing tests cover the stated fixtures and sampled external state. This is not a declaration of complete security assurance or proof of every live operating condition.

Previously identified behavior remains outside this change:

- A final Hub withdrawal does not collect unharvested gauge rewards; an empty pool cannot subsequently harvest them.
- Staking principal/reward payouts ignore false ERC20 transfer returns. Pending admin-fee transfers assert success.
- Immediately funded rewards received while the pool is empty may wait for another funding call.
- Active/inactive balance views reflect the last ramp checkpoint.
- Zero staking withdrawals are rejected by the Hub.

The existing observation tests document these behaviors; they do not establish that those defects have been fixed. Standard rounding can leave reward dust. Use supported tokens and operational harvest/checkpoint procedures, and review these limitations before funding the stack.
