# fxMint WBTC repayment v2

Two Actions entrypoints:
- `.github/workflows/fxmint-wbtc-repayment-data-v2.yml`: read-only pinned Ethereum evidence, owner NFT enumeration, protocol fees and official FX SDK routes.
- `.github/workflows/fxmint-wbtc-repayment-v6.yml`: simulate-only by default; manual live-broadcast mode after fork acceptance.

Owner: `0x9f2B20A772246960810045905B7daccf960eE288`. Collection run [37776901714](https://github.com/CurveYield2/Contract-Automation/actions/runs/37776901714) succeeded and found indebted WBTC position #887 at Ethereum block 26147674.

Flow: flash borrow exactly 200 USDC from Balancer V2; swap all 200 USDC to fxUSD with at most 0.1% quote slippage and an absolute 199.4 fxUSD output floor; spend those proceeds through the official fxMint router to reduce debt, accounting for the protocol repayment fee; withdraw collateral in that same official repayToLong operation, then sell the smallest quoted WBTC amount sufficient to return at least 200.5 fxUSD at 0.25% slippage; convert those proceeds back to USDC with a repayment floor of principal plus actual Balancer fee; repay Balancer and return NFT ownership and remaining tokens to the owner.

Verified simulation: [run 37779976024](https://github.com/CurveYield2/Contract-Automation/actions/runs/37779976024), commit `942f304d00801d4c6ed7929d0616adbcff6309de`, passed all acceptance checks. Artifact `fxmint-wbtc-simulation-v6` (ID 11551616405) contains DATA_v2.json, FORK_v6.json, PLAN_v6.json and SIMULATION_v6.json. Fork transaction `0x6f03d87dcd1eaa7e919179eb67aabf25e5420e40ca395a8693f9d2cd5d913a82` mined successfully in local fork block 26147803 with gas used 1,361,685; it is not a mainnet transaction.

| Verified result | Amount |
| --- | --- |
| Balancer principal borrowed and returned | 200 USDC |
| Actual Balancer flash fee | 0 USDC |
| First swap output | 199.960912031040979385 fxUSD |
| First minimum after 0.1% slippage | 199.760951119009938405 fxUSD |
| Position debt before | 226.659531181478811700 fxUSD |
| Position debt after | 27.097742727346097743 fxUSD |
| Actual debt decrease, after protocol fees | 199.561788454132713957 fxUSD |
| WBTC sold | 0.00244570 WBTC |
| WBTC sale output | 201.002952207476941088 fxUSD |
| WBTC sale minimum after 0.25% slippage | 200.500458880059449354 fxUSD |
| Final fxUSD to USDC swap output | 201.001947 USDC |
| USDC returned to owner after flash repayment | 1.001947 USDC |

The protocol's PoolConfiguration transient lock permits one manager position operation per transaction. The helper therefore uses the official combined debt-repayment and collateral-withdrawal call. Two separate position calls fail with ErrorPoolManagerLocked(). This preserves the requested swaps, amounts and flash repayment without changing protocol privileges or storage.

RPC: existing repository secrets `SD_ETH_RPC_URL` then `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` if the former is absent. No RPC URL is serialized. The collector applies read-only Ethereum identity checks, not Anvil mutation requirements. Simulation forks that same RPC on a loopback-only GitHub-hosted Anvil. Only owner gas ETH may be increased; no repayment tokens or protocol state are fabricated.

Source reuse: official AladdinDAO/fx-sdk addresses and routes in src/configs/contracts.ts, pools.ts and routers.ts; existing official PositionOperateFacet.repayToLong for protocol operations; authenticated Balancer callback/repayment pattern from AladdinDAO/fx-protocol-contracts; OpenZeppelin SafeERC20 5.4.0; repository ethers 6.15.0. Solidity 0.8.28, Cancun, optimizer 200, viaIR. All dependencies and compilation occur only in GitHub.

Artifacts contain pinned DATA_v2.json, PLAN_v6.json, FORK_v6.json, SIMULATION_v6.json (or ERROR_v6.json), mined receipt identity, all swap/repay events and before/after debt/collateral/vault balances. Acceptance includes owner-only execution, authenticated callback, absolute output floors, expired-plan rejection, full revert rollback, successful receipt, real debt reduction, exact flash repayment, NFT return and zero retained helper token balances.

Live use: choose live-broadcast manually on main and enter exactly `LIVE 200 USDC`. Job uses environment `fxmint-production`; configure required reviewers there and supply `FXMINT_DEPLOYER_PRIVATE_KEY` as an environment secret for the stated owner. The environment must be configured before live use. This implementation session does not broadcast. An optional existing helper address must match the fork-tested compiled runtime and owner; otherwise live mode deploys it. The workflow first completes simulation without signing secrets, then the live job repeats a fresh simulation and current quotes. Live mode sends a helper deployment if needed, one position-specific NFT approval, and the atomic flash-loan transaction. On an execution error it attempts to restore the previous approval. Gas and protocol fees are real costs; fork success cannot guarantee execution against future mainnet state.

Current implementation: contracts/FxMintWbtcRepayer_v2.sol and run_v6.mjs. Fork deployment and approval use bounded raw JSON-RPC receipt polling; live operations use the owner's signed transactions. Workflow concurrency queues runs without cancelling an in-progress live execution.

One current source per responsibility. Mutable results are Actions artifacts; only the canonical request path is watched for optional reruns. No audit or browser workflow is modified.
