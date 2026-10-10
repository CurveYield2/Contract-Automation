# fxMint ETH long repayment

Active workflow: [fxMint ETH Repayment v3](https://github.com/CurveYield2/Contract-Automation/actions/workflows/fxmint-eth-repayment-v3.yml).

Owner: `0x9f2B20A772246960810045905B7daccf960eE288`.
Pool: `0x6Ecfa38FeE8a5277B91eFdA204c235814F0122E8` (WstETHLongPool).
Discovery found NFT #1920 with approximately 21.045126289 fxUSD debt and NFT #1925 with zero debt/collateral. Every run rediscovers ownership, debt, rates, fees, liquidity and contract hashes; these historical balances are not execution inputs.

## Inputs

| Input | Meaning |
|---|---|
| mode | `simulate-only` (default), `collect-only`, or manually dispatched `live-broadcast` |
| repayment_fxusd | Net fxUSD debt reduction, default 10; positive decimal with up to 18 decimals |
| position_id | Empty discovers the unique eligible owned NFT; enter an ID if multiple are eligible |
| helper_address | Empty creates a fork helper for simulation; manual live can deploy an ETH helper once. Enter the deployed ETH helper address on subsequent runs to reuse it with a different amount |
| max_fee_gwei | EIP-1559 total fee cap, default 1 gwei |
| priority_fee_gwei | EIP-1559 priority cap, default 0.0001 gwei |
| confirmation | Manual live only: `LIVE <normalized repayment amount> FXUSD`, for example `LIVE 10 FXUSD` |

The target cannot exceed available position debt or collateral, and must pass the complete transaction. A 100 fxUSD target was rejected because this NFT held only approximately 21.045 fxUSD debt. Both the amount and fees must reflect the current state.

User preference: use whichever ETH collateral form produces the best estimated final outcome, **including gas**. The workflow selects by total cost rather than forcing a native ETH withdrawal.

## Method and routes

The transaction borrows the calculated USDC principal from Balancer V2, converts USDC to fxUSD with the official MultiPathConverter, repays the requested net fxUSD debt including the current protocol repayment fee, and withdraws collateral through `FxMintRouter.repayToLong` in one manager operation. It sells only the calculated collateral amount for USDC, repays the flash principal plus its current fee, returns the NFT, and refunds remaining tokens. Nothing requires the historical WBTC helper.

The first conversion enforces 0.1% quote slippage and enough fxUSD for net repayment plus protocol fee. The collateral sale enforces 0.25% quote slippage and at least the complete flash loan obligation. All steps are atomic; an unmet floor reverts the transaction.

### Native ETH withdrawal

Wallet withdrawals can deliver native ETH. The official SDK selects `repayToLongAndZapOut` when the requested output differs from the collateral token. For ETH it converts wstETH -> stETH -> WETH, then the router unwraps WETH and sends ETH. The underlying pool's `collateralToken()` is wstETH, and plain `repayToLong` delivered wstETH in the fork.

This workflow compares the collateral sale before the optional wallet-output conversion. It includes Lido unwrap -> Curve stETH/ETH -> WETH/USDC routes alongside a direct wstETH/USDC sale. It can therefore avoid unwrapping to ETH and immediately wrapping back to WETH when that extra conversion is more expensive. ETH is never treated as an ERC20. Position raw collateral is rate-scaled stETH-equivalent; the collector reads the manager scalar/rate and converts it to wstETH units for withdrawal limits and cost accounting.

Primary implementation references:
- [Official SDK repayAndWithdraw](https://github.com/AladdinDAO/fx-sdk/blob/main/src/core/position.ts)
- [Official SDK token routes](https://github.com/AladdinDAO/fx-sdk/blob/main/src/configs/routers.ts)
- [PositionOperateFacet](https://github.com/AladdinDAO/fx-protocol-contracts/blob/main/contracts/periphery/facets/PositionOperateFacet.sol)
- [LibRouter ETH transfer](https://github.com/AladdinDAO/fx-protocol-contracts/blob/main/contracts/periphery/libraries/LibRouter.sol)
- [Manager normalization](https://github.com/AladdinDAO/fx-protocol-contracts/blob/main/contracts/core/PoolManager.sol)

### Cost comparison

At a pinned Ethereum block, the collector discovers available UniV3 fee tiers 100/500/3000/10000 and the official Lido/Curve routes, the second Curve stETH/ETH pool, Curve Tricrypto and the Balancer V2 wstETH/WETH pool. It also compares the former collateral -> fxUSD -> USDC round trip as a reference.

For each feasible route it solves the required collateral amount, executes the entire flash repayment from the same fork snapshot, verifies the transaction, and reverts before the next candidate. The score is market value of collateral consumed minus USDC/fxUSD refunds plus measured repayment gas valued in USDC, using common market marks and a common upstream base fee plus priority. Deployment and NFT approval are common setup costs, reported separately. This is the lowest estimated total cost among the tested paths, not a guarantee across every aggregator or future block. Routing is recalculated on every run.

## Verified result

[Simulation run 38016120617](https://github.com/CurveYield2/Contract-Automation/actions/runs/38016120617), code commit `9f6aceb6517b4a8935dce8dfc1306dab3dfe690e`, passed at pinned Ethereum block **26158964** (`0xe0d138068483fb70e58ef37d85d1c95bfe555e11eeaddefd146c21411c4a1735`). The live job was skipped. Artifact: `fxmint-eth-simulation-v3`.

Selected route:
1. Balancer V2 flash loan **10.030947 USDC** (observed flash fee zero).
2. Curve USDC/fxUSD pool `0x5018be882dcce5e3f2f3b0913ae2096b9b3fb61f` through the official MultiPathConverter.
3. Pay **10.02 fxUSD** including 0.2% protocol repayment fee to reduce NFT #1920 debt by **10 fxUSD** (plus one wei of rounding).
4. Withdraw and sell **0.003237471345617651 wstETH** directly through UniV3 wstETH/USDC pool `0x4622df6fb2d9bee0dcdacf545acdb6a2b2f4f863`, **500 = 0.05% fee tier**.
5. Receive **10.056089 USDC**, return principal to Balancer, return the NFT and refund **0.025142 USDC + 0.010030287888468813 fxUSD**.

Debt changed from **21.045126289000959443** to **11.045126289000959442 fxUSD**. The **5 fxUSD** alternate check passed using the same fork helper. This helper was deployed only on the fork.

The comparison evaluated 28 collateral sale candidates: **22 completed**; five Balancer paths were infeasible at planning under available balance bounds and direct UniV3 3000 failed full transaction acceptance. Failed routes are excluded and retained in the artifact, not described as executable.

| Collateral sale | Complete repayment gas | Estimated total cost, USDC |
|---|---:|---:|
| Direct UniV3 wstETH/USDC 500, selected | 1,337,716 | 10.286116 |
| UniV3 wstETH/WETH 100 -> WETH/USDC 100 | 1,472,939 | 10.313635 |
| Lido unwrap -> Curve SDK stETH/ETH -> WETH/USDC 100 | 1,491,148 | 10.317268 |
| UniV3 wstETH/WETH 100 -> WETH/USDC 500 | 1,485,621 | 10.321166 |
| Lido unwrap -> Curve factory stETH/ETH -> WETH/USDC 100 | 1,529,181 | 10.324793 |
| Reference through fxUSD then back to USDC | 1,658,668 | 10.357566 |

Selected route saved **153,432 gas** versus the displayed ETH/WETH conversion path and **320,952 gas (19.35%)** versus the fxUSD round trip. These estimated costs include collateral, refunds and gas at the common ranking fee **0.0796553 gwei**, with **2493.3874 USDC/ETH** and **3105.9543 USDC/wstETH** market marks.

Observed fork repayment gas cost: **0.000086687165266920 ETH** at **0.064802370 gwei**. Deployment (1,913,637 gas), approval (55,948 gas) and repayment totaled **0.000251237034313170 ETH** in this fork. At the default 1 gwei cap, those same gas counts imply maximum **0.003307301 ETH** including deployment/approval, or **0.001337716 ETH** for repayment alone. Live costs and gas consumption can change.

## Verification and operation

Only owner gas ETH may be topped up on the fork. No token balances, NFT ownership or protocol storage are fabricated. Acceptance checks exact requested debt reduction within a small rounding tolerance, flash principal/fee returned, NFT ownership restored, collateral reduction, token refunds and zero helper leftovers. Owner-only execution, authenticated callback, zero/excess repayment, deadline and impossible minimum checks are exercised with rollback. A second amount is tested on the same helper before the final selected-route transaction.

The workflow uses `SD_ETH_RPC_URL`, falling back to `SIM_ARCHIVE_PRIMARY_ETHEREUM_01`, without printing RPC credentials. Installation and Solidity compilation occur only in GitHub Actions. Artifacts contain pinned data, quotes, candidate outcomes, cost comparison, configurable-amount evidence and simulation report; retention is 30 days.

Pushes trigger simulation only. Live mode requires manual workflow_dispatch, successful fresh fork acceptance and the `fxmint-production` environment. The signing secret `DEPLOYER_FX` must resolve to the owner above; a key for the earlier transferred WBTC position will fail the address guard. Existing helper input must match this ETH helper's compiled runtime/owner/pool. Reuse that ETH helper to change repayment amounts without redeployment. No mainnet ETH helper address exists in these simulation reports.
