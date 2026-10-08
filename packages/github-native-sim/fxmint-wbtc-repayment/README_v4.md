# fxMint WBTC repayment v4

Current owner: `0xFF90b414D84F7Ec4FAEADBD8Da86Ad515F930654`. Position #887.

Current workflows: `.github/workflows/fxmint-wbtc-repayment-data-v3.yml` and `.github/workflows/fxmint-wbtc-repayment-v9.yml`. Sources: `contracts/FxMintWbtcRepayer_v3.sol` and `run_v9.mjs`.

## Completed mainnet execution

Authorized workflow [37860241544](https://github.com/CurveYield2/Contract-Automation/actions/runs/37860241544) passed its independent simulation and live job at commit `a2227c9dfe483bc917bd69052c8e6226f21025b3`. The live job repeated fresh fork acceptance, verified the DEPLOYER_FX signer matches the actual NFT owner, and broadcast EIP-1559 transactions with maxFeePerGas 220000000 wei (0.22 gwei) and maxPriorityFeePerGas 100000 wei (0.0001 gwei). No base fee override was used for this live preflight or mainnet execution.

[Repayment transaction](https://etherscan.io/tx/0xf3df00e9b5f824a6270b9a78b034b1b1a8a16f59a378df97eba52986cfc02aa4) succeeded in Ethereum block 26151005. Debt decreased exactly 100 fxUSD from 194.470130433123808237 to 94.470130433123808237. Balancer's 100.4 USDC principal was fully repaid with actual fee zero. WBTC sold: 0.00123914. NFT ownership returned to the stated owner and the helper retained no USDC, fxUSD or WBTC.

Deployed helper: `0x69B658189d63C39126F7BD017D883A872487713e`. Broadcast artifact: `fxmint-wbtc-broadcast-v9` ID 11585373426; simulation artifact ID 11585338023. Artifacts include pinned state, plan, full operation events, receipt identities, gas and exact measured costs.

| Mainnet transaction | Gas used | Effective gas price (gwei) | ETH cost |
| --- | ---: | ---: | ---: |
| Helper deployment | 2,024,687 | 0.156494906 | 0.000316853201744422 |
| NFT approval | 55,948 | 0.168129367 | 0.000009406501824916 |
| Atomic repayment | 1,354,850 | 0.159816381 | 0.000216527223797850 |
| Total | 3,435,485 | varies by block | 0.000542786927367188 |

Deployment transaction: `0x7d1a7b7fa6fc7eaf0475c9d3498d574ebe68aacd0aa69018e03d35aee9663a89`. Approval transaction: `0x6af652141bbe7442fba936c4e327f1a93820b9793fa6486e99e5662566f8b637`.

## Flow and execution safeguards

The helper borrows 100.4 USDC from Balancer V2 and swaps it to fxUSD with 0.1% quote slippage. It pays the fee-adjusted amount for exactly 100 fxUSD debt reduction (100.2 fxUSD at the observed 0.2% protocol repayment fee). The official repayToLong operation applies debt repayment and WBTC withdrawal together; the protocol transient lock requires one manager operation per transaction. WBTC is selected for at least 100.9 fxUSD after 0.25% quote slippage; proceeds convert back to USDC at 0.25% slippage with a principal-plus-fee repayment floor. Remaining tokens and the NFT return to the owner.

Simulation tests owner-only execution, authenticated callback, output floors, expiry, atomic rollback, mined success, exact debt reduction, full flash repayment, owner NFT return and zero retained helper balances. Only owner gas ETH is increased on the fork; no token balances or protocol/NFT state are fabricated.

Manual mode remains simulate-only by default. Manual live mode on main requires confirmation `LIVE 100 FXUSD`, environment `fxmint-production`, and the existing `DEPLOYER_FX` signing secret. Preserve environment protections. EIP-1559 fee caps are applied to deployment, approval and repayment. Current mainnet base fee plus priority must fit under the cap before broadcasting. Existing helpers must match the compiled runtime and owner.

The completed single-use request was archived and removed. Automatic code/config pushes run simulation only; trusted live requests require the bounded request validator. Do not rerun the completed intent: the runner binds live execution to the pre-authorization debt state, which has now changed, and the remaining debt is below the 100 fxUSD target.

RPC uses existing secrets `SD_ETH_RPC_URL` or `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` without printing URLs. Compilation and dependencies occur only in GitHub. Solidity 0.8.28, Cancun, optimizer 200, viaIR; ethers 6.15.0 and OpenZeppelin 5.4.0; official AladdinDAO routes and approved router integration.
