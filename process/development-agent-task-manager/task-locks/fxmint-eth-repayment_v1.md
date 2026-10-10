# fxMint ETH long repayment workflow v1

State: IMPLEMENTED_AWAITING_PINNED_FORK_VERIFICATION.

Owner: 0x9f2B20A772246960810045905B7daccf960eE288.
Pool: official WstETHLongPool 0x6Ecfa38FeE8a5277B91eFdA204c235814F0122E8.
Governing request: create another repayment workflow for this owner's ETH long position, make fxUSD repayment amount configurable, explain token swap method and check routing cost efficiency.

Finite scope: one ETH workflow/package derived from the current WBTC repayment implementation; discover real NFT/debt/collateral; configurable net fxUSD target, Balancer USDC principal and routes; official fxMint repayToLong to repay and withdraw in one manager operation; compare available Uniswap fee tiers, official Lido/Curve paths, Curve Tricrypto and prior fxUSD round-trip reference. Simulate candidates from the same state snapshot and rank collateral consumed minus token refunds plus gas valued in USDC. Prove two amounts work on the same helper. No audit-system/browser changes. No assistant live financial execution.

Terminal condition: successful real-position simulation, same-helper amount check, full flash principal/fee repayment, NFT returned and zero token leftovers; route comparison/evidence and final usage docs. Default simulation amount 100 fxUSD (user did not specify a single amount), configurable via workflow input. Default fee cap 1 gwei and priority 0.0001 gwei, both configurable. Live mode remains manual workflow_dispatch protected by fxmint-production and existing DEPLOYER_FX, with exact amount confirmation and mandatory signer-address match.

Current canonical files: .github/workflows/fxmint-eth-repayment-v1.yml; packages/github-native-sim/fxmint-eth-repayment/{data_v1.mjs,run_v1.mjs,contracts/FxMintEthRepayer_v1.sol}. No same-purpose prior ETH implementation found. Existing WBTC workflow is untouched.

Next action: run exactly one simulation push, inspect terminal jobs/logs/artifacts, repair only evidenced defects and do not repeat unchanged failure. Record current NFT and chosen route after RPC confirmation. All dependency installation and Solidity compilation belong in GitHub Actions; local syntax parsing only.
