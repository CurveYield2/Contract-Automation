# fxMint WBTC flash-loan repayment task v2

State: COMPLETE. Current deployment source is contracts/FxMintWbtcRepayer_v2.sol, runner run_v6.mjs, collection workflow fxmint-wbtc-repayment-data-v2.yml, execution workflow fxmint-wbtc-repayment-v6.yml, and README_v2.md. Superseded active implementation files have been removed.

Collection run 37776901714 succeeded through the existing repository RPC secret and identified owner WBTC NFT position #887. Simulation run 37779976024 on commit 942f304d00801d4c6ed7929d0616adbcff6309de succeeded. Its artifact 11551616405 verifies all three swaps, 200 USDC flash principal and exact fee repayment, real debt decrease, NFT ownership return, zero initial and final helper token balances, and authorization/output-floor/expiry/rollback checks.

Protocol constraint resolved through the official combined repayToLong repayment-withdrawal operation; a second manager operation in the same transaction is locked. No protocol privileges or token storage were changed. Owner ETH gas balance was increased only on the ephemeral local fork. All compilation and dependency installation ran in GitHub; no local compilation or dependency downloads occurred.

Simulated debt decreased from 226.659531181478811700 to 27.097742727346097743 fxUSD; 0.00244570 WBTC sold for 201.002952207476941088 fxUSD; conversion produced 201.001947 USDC, with 200 USDC returned to Balancer and 1.001947 USDC returned to the owner.

Live mode is implemented but was not run. It requires manual dispatch on main, exact confirmation LIVE 200 USDC, and FXMINT_DEPLOYER_PRIVATE_KEY for the stated owner in fxmint-production. Environment required reviewers must be configured before production use. No mainnet broadcast occurred.

Merged implementation PRs: #578 and #580. Retained merged branch fxmint-wbtc-repayment-v1 has no active workflow and is safe to delete; no branch-delete connector is available. Other-session PR #579 and its branch were left untouched.
