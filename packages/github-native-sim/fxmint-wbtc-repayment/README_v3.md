# fxMint WBTC repayment v3

Owner: `0xFF90b414D84F7Ec4FAEADBD8Da86Ad515F930654`, verified owner of WBTC position #887.

Current entrypoints: `.github/workflows/fxmint-wbtc-repayment-data-v3.yml` and `.github/workflows/fxmint-wbtc-repayment-v8.yml`. Current source: `contracts/FxMintWbtcRepayer_v3.sol` and `run_v8.mjs`. All dependencies and compilation run only in GitHub.

The helper flash borrows 100.4 USDC from Balancer, swaps it to fxUSD at 0.1% quote slippage, spends exactly the fee-adjusted amount for 100 fxUSD debt reduction (100.2 fxUSD at the observed 0.2% repayment fee), and uses the official combined repayToLong debt-repayment and WBTC withdrawal operation. WBTC is selected to reach a minimum 100.9 fxUSD after 0.25% quote slippage. Those proceeds convert to USDC at 0.25% quote slippage with a principal-plus-fee repayment floor. NFT ownership and remaining tokens return to the owner. The combined operation is required by the protocol's one-operation transient lock.

Collection [37858977924](https://github.com/CurveYield2/Contract-Automation/actions/runs/37858977924) passed. Simulation [37859119586](https://github.com/CurveYield2/Contract-Automation/actions/runs/37859119586) passed at commit `7f4d82e5686bb8dc30cbeb777b6cd1db58a91ca0`.

| Verified result | Amount |
| --- | --- |
| Debt before | 194.470130433123808237 fxUSD |
| Debt after | 94.470130433123808237 fxUSD |
| Debt reduction | 100 fxUSD |
| WBTC sold | 0.00123914 WBTC |
| WBTC sale output | 101.153544547075258466 fxUSD |
| USDC conversion output | 101.148998 USDC |
| Balancer principal returned | 100.4 USDC |
| Balancer fee | 0 USDC |

| Transaction at 0.12 gwei | Gas used | ETH cost |
| --- | ---: | ---: |
| Helper deployment | 2,024,687 | 0.00024296244 |
| NFT approval | 55,948 | 0.00000671376 |
| Atomic repayment | 1,354,850 | 0.000162582 |
| Total | 3,435,485 | 0.0004122582 |

The observed upstream base fee was 0.158904269 gwei, above the requested total gas price. This successful fork uses an explicit fee scenario: only the local fork's base fee is set to zero, and each mined transaction has a verified effective gas price of 120,000,000 wei (0.12 gwei). It does not establish current mainnet inclusion at that price. No token balances, position ownership, debt, collateral or protocol storage are fabricated; only owner gas funding and the explicitly recorded fee scenario change on the local fork.

Artifacts include DATA_v3.json, FORK_v8.json (upstream base fee and scenario override), PLAN_v8.json, SIMULATION_v8.json, and GAS_COST_v8.json with per-transaction receipt identities, gas, effective gas prices, and wei costs. Authorization, callback, floors, expiry, rollback, mined success, exact debt reduction, full flash repayment, NFT return and zero helper retained balances passed.

RPC uses existing secrets `SD_ETH_RPC_URL` then `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` if absent, without serializing URLs. Compiler: Solidity 0.8.28, Cancun, optimizer 200, viaIR; ethers 6.15.0 and OpenZeppelin 5.4.0. Routes and approved router reuse official AladdinDAO sources.

Manual live mode remains available on main with confirmation `LIVE 100 FXUSD`, environment `fxmint-production`, and owner signing secret `FXMINT_DEPLOYER_PRIVATE_KEY`. Configure environment required reviewers before production use. It repeats fresh fork acceptance, validates signer and helper runtime, and checks live base fee before any broadcast. If live base fee exceeds 0.12 gwei, it stops without broadcasting. No live mode was run in this task.
