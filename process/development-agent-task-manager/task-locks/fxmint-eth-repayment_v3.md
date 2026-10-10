# fxMint ETH long repayment workflow v3

State: CORRECTED_COLLATERAL_UNITS_AWAITING_FRESH_COMPARISON.

Owner: 0x9f2B20A772246960810045905B7daccf960eE288.
Pool: official WstETHLongPool 0x6Ecfa38FeE8a5277B91eFdA204c235814F0122E8.
Governing request: create another repayment workflow for this owner's ETH long position, make fxUSD repayment amount configurable, explain token swap method and check routing cost efficiency.

Finite scope: one ETH workflow/package derived from the current WBTC repayment implementation; discover real NFT/debt/collateral; configurable net fxUSD target, Balancer USDC principal and routes; official fxMint repayToLong to repay and withdraw in one manager operation; compare available Uniswap fee tiers, official Lido/Curve paths, Curve Tricrypto and prior fxUSD round-trip reference. Simulate candidates from the same state snapshot and rank collateral consumed minus token refunds plus gas valued in USDC. Prove two amounts work on the same helper. No audit-system/browser changes. No assistant live financial execution.

Terminal condition: successful real-position simulation, same-helper amount check, full flash principal/fee repayment, NFT returned and zero token leftovers; route comparison/evidence and final usage docs. Default simulation amount 10 fxUSD (user did not specify a single amount), configurable via workflow input. Default fee cap 1 gwei and priority 0.0001 gwei, both configurable. Live mode remains manual workflow_dispatch protected by fxmint-production and existing DEPLOYER_FX, with exact amount confirmation and mandatory signer-address match.

Current canonical files: .github/workflows/fxmint-eth-repayment-v3.yml; packages/github-native-sim/fxmint-eth-repayment/{data_v2.mjs,run_v2.mjs,contracts/FxMintEthRepayer_v1.sol}. No same-purpose prior ETH implementation found. Existing WBTC workflow is untouched.

Next action: run exactly one simulation push, inspect terminal jobs/logs/artifacts, repair only evidenced defects and do not repeat unchanged failure. Record current NFT and chosen route after RPC confirmation. All dependency installation and Solidity compilation belong in GitHub Actions; local syntax parsing only.

RPC collection run 38015374969 at block 26158905 discovered position #1920, collateral 9941409481840710 and debt 21045126289000959443. NFT #1925 has zero debt/collateral. The original default 100 fxUSD intentionally failed the amount/debt precondition before Solidity compilation or any transaction. Relevant changed input: workflow default repayment is now 10 fxUSD (same helper/code), with alternate same-helper acceptance at 5 fxUSD. Candidate discovery found one initial route, 28 collateral sale routes and five ETH/USDC valuation routes. No broadcast occurred.


Run 38015475074 passed 23 complete candidate transactions, authorization/minimum/deadline negative checks, 5 fxUSD on the same helper and final 10 fxUSD repayment. Five Balancer sale candidates were infeasible at planning. Live was skipped. A post-run review found raw position collateral is rate-scaled stETH-equivalent, whereas sale quotes are wstETH token units; v2 collector records the manager scalar/rate, runner converts balances and cost marks consistently and uses available market wstETH/USDC quotes. The next push changes that evidenced issue and repeats comparison once.

User clarification: wallet withdrawal is native ETH. Official SDK repayAndWithdraw uses repayToLongAndZapOut for a requested ETH output, converts wstETH to WETH, and LibRouter.convertAndTransferOut unwraps WETH and sends ETH. The pool's collateralToken and plain repayToLong output remain wstETH, verified in the fork. Candidate scope includes the Lido unwrap -> Curve stETH/ETH -> WETH/USDC paths. Direct wstETH/USDC is permissible as a cost comparison candidate: it skips optional wallet-output conversion while selling collateral for flash loan repayment. No assumption that native ETH is an ERC20 or direct pool output.
