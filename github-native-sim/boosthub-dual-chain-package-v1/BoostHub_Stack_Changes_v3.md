# BoostHub stack v3 — automatic staking reward synchronization

This revision updates staking to discover its BoostHub pool rewards automatically and removes the legacy cyGOV deployment defaults and source references. BoostHub v12, both chain-specific helpers and IBoostHub are unchanged from stack v2.

| Component | Delivered version | Change in this revision |
|---|---:|---|
| BoostHub | 12 | Unchanged; allows `vlBoost = address(0)`; skips boost calls and the boost event when absent; still validates and executes every requested gauge checkpoint. |
| IBoostHub | 5 | Unchanged revised pool/position/system interfaces. |
| Ethereum StakeDaoMerkleClaimExecutor | 8 | Unchanged indexed MultiMerkleStash claims. |
| Fraxtal StakeDaoFraxtalSdFxsUrdClaimExecutor | 5 | Unchanged; updates verified Fraxtal v4 for `claimToken(pid, token)`, the 12-field `poolInfo` result, and `claimStakeDaoRewards(pid)`; binds a new Hub once instead of hardcoding the existing Hub. |
| BoostHubStaking | 21 | Imports Hub rewards at deployment and before/after harvest; permissionless `update_reward_tokens()`; nine accounting slots; preserves the per-token 45-day ramp and 65/35 split. |
| BoostHubDeploymentFactory | 1 | Caller-scoped CREATE3 deployment utility using pinned Solmate code. |

The Fraxtal helper retains chain ID 252, sdFXS PID 0, the verified Stake DAO URD address, cumulative-claim proofs, recipient protection, and actual balance-delta verification from v4. It supports sdFXS only; other registered gauge rewards continue through ordinary Hub harvest. It does not assume that vlBoost, MultiMerkleStash, or the old `execute(bytes[])` entry point exists on Fraxtal.

The Hub's claim executor remains mandatory. Configuring zero vlBoost does not suppress failed gauge checkpoints. An empty checkpoint list makes no boost call on Fraxtal. A nonzero valid Ethereum registry retains its previous behavior.

## Reward synchronization

New gauge rewards are claimed during the same staking harvest that first discovers them. Refresh appends unique tokens, preserves disabled flags and existing accounting, and promotes an existing external/principal token if BoostHub starts providing it. The public refresh only reads Hub pool metadata and never collects gauge rewards or moves principal. Withdrawals and user reward claims do not depend on refreshing the registry.

Nine accounting slots accommodate all eight Hub rewards alongside a distinct principal token. Generic external rewards can use free slots. When a new Hub reward exceeds capacity, refresh/harvest reverts atomically; disabling a token does not release a slot. The constructor keeps its prior eight-element reward-array ABI, now optional because the complete Hub list is discovered automatically.

cyGOV is no longer wired into the default configuration. No token-specific address, exemption or method exists in staking. The generic external funding methods remain, without a governance-token default. Historical chain snapshots still faithfully contain old deployments' state; they are evidence rather than active reward configuration.

## Existing requested economics remain

Yield-boosting token retention, yield-token taxes, retained-token staking/withdrawals and converters remain removed. The Hub platform fee remains independently configurable. Every registered staking reward uses the existing 45-day ramp; 65% of the foregone ramp portion goes to active staker weight and 35% to the external fee receiver in that reward token. This is not a 35% fee on every gross reward. With all principal mature, the ramp admin fee is zero.

## Dependencies and deployment

The package now includes the verified originals of `IStakeDaoGauge.sol`, `IvlBoost.sol`, and `BoostHubErrors.sol`. Etherscan blocked source retrieval. The files were recovered from the verified source at the same address on Fraxscan and bound to Ethereum by a byte-for-byte match of the live Hub runtime on both chains. The source hashes and snapshot blocks are recorded in `dependency_provenance_v2.json`. This runtime identity statement concerns the old live Hub; the revised Hub is a new deployment.

The package includes the OpenZeppelin 5.4.0 and pinned Solmate import closure, licenses, exact Solidity standard-JSON input, compiled artifacts, a bundled Node runner, and a Windows PowerShell deployment/configuration script. Select a single target chain explicitly. No contract was deployed or transaction sent to a public chain by this work.

Read `Deployment_Instructions_v2.md` for setup, signing, configuration, resumable deployment, final role acceptance and Fraxtal proof submission. Configuration is a reference for a fresh deployment; existing stakes, balances, votes, queued changes and claim proofs do not migrate automatically. A new helper cannot be plugged into the old live Hub because its executor ABI is different.

## Verification and retained limitations

`verification_evidence_v3.json` records the final test counts and compiler/runtime results. The verification reruns the prior standalone and cross-contract regression suites against the recovered production declarations and adds automatic reward-sync regressions alongside the existing Fraxtal helper/Hub/staking integration. Cases cover cumulative deltas, platform fees, retries, stale proofs, recipient protection, binding, chain restrictions, no-vlBoost gauge checkpoints, staking reward receipt and principal exit. Deployment acceptance tests use fresh contracts on local Anvil forks, including the live external dependencies and an idempotent rerun. Windows checks execute the extracted bundled package under Windows PowerShell 5.1.

Passing tests cover the stated fixtures and sampled external state. This is not a declaration of complete security assurance or proof of every live operating condition.

Previously identified behavior remains outside this change:

- A final Hub withdrawal does not collect unharvested gauge rewards; an empty pool cannot subsequently harvest them.
- Staking principal/reward payouts ignore false ERC20 transfer returns. Pending admin-fee transfers assert success.
- Immediately funded rewards received while the pool is empty may wait for another funding call.
- Active/inactive balance views reflect the last ramp checkpoint.
- Zero staking withdrawals are rejected by the Hub.

The existing observation tests document these behaviors; they do not establish that those defects have been fixed. Standard rounding can leave reward dust. Use supported tokens and operational harvest/checkpoint procedures, and review these limitations before funding the stack.
