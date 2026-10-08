# fxMint WBTC repayment v1

Two Actions entrypoints:
- `.github/workflows/fxmint-wbtc-repayment-data-v2.yml`: read-only pinned Ethereum evidence, owner NFT enumeration, protocol fees and official FX SDK routes.
- `.github/workflows/fxmint-wbtc-repayment-v1.yml`: simulate-only by default; manual live-broadcast mode after fork acceptance.

Owner: `0x9f2B20A772246960810045905B7daccf960eE288`. Collection run [37776901714](https://github.com/CurveYield2/Contract-Automation/actions/runs/37776901714) succeeded and found indebted WBTC position #887 at Ethereum block 26147674.

Flow: flash borrow exactly 200 USDC from Balancer V2; swap all 200 USDC to fxUSD with at most 0.1% quote slippage and an absolute 199.4 fxUSD output floor; spend those proceeds through the official fxMint router to reduce debt, accounting for the protocol repayment fee; then withdraw the smallest quoted WBTC amount sufficient to return at least 200.5 fxUSD at 0.25% slippage; convert those proceeds back to USDC with a repayment floor of principal plus actual Balancer fee; repay Balancer and return NFT ownership and remaining tokens to the owner.

RPC: existing repository secrets `SD_ETH_RPC_URL` then `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` if the former is absent. No RPC URL is serialized. The collector applies read-only Ethereum identity checks, not Anvil mutation requirements. Simulation forks that same RPC on a loopback-only GitHub-hosted Anvil. Only owner gas ETH may be increased; no repayment tokens or protocol state are fabricated.

Source reuse: official AladdinDAO/fx-sdk addresses and routes in src/configs/contracts.ts, pools.ts and routers.ts; existing official PositionOperateFacet.repayToLong for protocol operations; authenticated Balancer callback/repayment pattern from AladdinDAO/fx-protocol-contracts; OpenZeppelin SafeERC20 5.4.0; repository ethers 6.15.0. Solidity 0.8.28, Cancun, optimizer 200, viaIR. All dependencies and compilation occur only in GitHub.

Artifacts contain pinned DATA_v2.json, PLAN_v1.json, FORK_v1.json, SIMULATION_v1.json (or ERROR_v1.json), mined receipt identity, all swap/repay events and before/after debt/collateral/vault balances. Acceptance includes owner-only execution, authenticated callback, absolute output floors, expired-plan rejection, full revert rollback, successful receipt, real debt reduction, exact flash repayment, NFT return and zero retained helper token balances.

Live use: choose live-broadcast manually on main and enter exactly `LIVE 200 USDC`. Job uses environment `fxmint-production`; configure required reviewers there and supply `FXMINT_DEPLOYER_PRIVATE_KEY` as an environment secret for the stated owner. The environment must be configured before live use. This implementation session does not broadcast. An optional existing helper address must match the fork-tested compiled runtime and owner; otherwise live mode deploys it. The workflow first completes simulation without signing secrets, then the live job repeats a fresh simulation and current quotes. Live mode sends a helper deployment if needed, one position-specific NFT approval, and the atomic flash-loan transaction. On an execution error it attempts to restore the previous approval. Gas and protocol fees are real costs; fork success cannot guarantee execution against future mainnet state.

One current source per responsibility. Mutable results are Actions artifacts; only the canonical request path is watched for optional reruns. No audit or browser workflow is modified.
