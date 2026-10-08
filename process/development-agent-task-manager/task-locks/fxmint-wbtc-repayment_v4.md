# fxMint WBTC repayment task v4

State: COMPLETE — MAINNET BROADCAST VERIFIED.

Latest user instruction: live execution using DEPLOYER_FX, max fee 0.22 gwei, priority 0.0001 gwei. Owner 0xFF90b414D84F7Ec4FAEADBD8Da86Ad515F930654, NFT #887, debt repayment exactly 100 fxUSD.

Workflow 37860241544, commit a2227c9dfe483bc917bd69052c8e6226f21025b3: simulation and live jobs both SUCCESS. Ethereum receipt status 1 at block 26151005, hash 0xf3df00e9b5f824a6270b9a78b034b1b1a8a16f59a378df97eba52986cfc02aa4. Owner NFT restored, complete flash principal plus fee returned, no retained helper tokens. Debt before 194.470130433123808237, debt after 94.470130433123808237 fxUSD. WBTC sold 0.00123914.

Actual EIP-1559 maxFeePerGas 220000000 wei and maxPriorityFeePerGas 100000 wei. Repayment effective price 159816381 wei, gas 1354850, cost 0.000216527223797850 ETH. Total deployment + approval + repayment 0.000542786927367188 ETH. Helper 0x69B658189d63C39126F7BD017D883A872487713e. Broadcast artifact 11585373426; simulation artifact 11585338023.

Current workflow/runner v9, collector v3, helper v3, README_v4.md. Superseded source and docs preserved in archive and removed from active paths. Completed one-shot authorization request removed. No new branch created. All compilation/dependencies occurred only in GitHub.

Terminal exit: this authorized transaction is complete. Do not retry or rebroadcast this intent. Current debt is below target and the live pre-state guard prevents duplicate execution. New repayment changes require a new user instruction. No pending same-purpose workflow remains.
