# fxMint WBTC flash-loan repayment task v1

Owner: this implementation session.

End-state: two usable workflows in Contract-Automation; data collection successfully runs through the repository Ethereum RPC secret; simulation of the owner's actual WBTC position borrows 200 USDC from Balancer, swaps to fxUSD with max 0.1% quote slippage and absolute 199.4 floor, repays debt, withdraws only sufficient WBTC for at least 200.5 fxUSD with max 0.25% quote slippage, converts proceeds to USDC and repays principal plus fee. Position ownership is restored and debt decreases. No mainnet broadcast requested for this session.

Implementation plan:
1. Reuse ethers 6.15.0, repository event-driven Actions, Anvil/Foundry on GitHub, and the official AladdinDAO SDK addresses/routes/router integration. Pin collection reads to block/hash; gather code identities, decimals, balances, NFT IDs, debts/collateral, fees, permissions and quotes.
2. Implement a restricted Balancer recipient around the existing approved fxMint router. Temporarily take the approved position NFT during execution; use the router for legitimate owner operations; restore it atomically. Enforce all amount floors and return USDC to Balancer. No account/token storage edits or pre-funded repayment tokens in simulation.
3. Run real-fork end-to-end acceptance, failure/revert and authorization checks in GitHub. Require mined status 1, evidence of all swaps and repayment, position restoration and debt/collateral deltas. Repair only evidenced failures. Add manual live mode with owner signer checks and fresh preflight; do not execute it.

Finite scope: these two workflows and their packages/github-native-sim/fxmint-wbtc-repayment implementation only. No existing audit/browser work is modified. One canonical active version per purpose; outputs remain Actions artifacts.

State: data collection implementation prepared; collection run pending. Exact resume: inspect the collection run, then implement the repayment against its actual position and quotes. Live signing configuration must be established before live use and will not be needed for simulation.

Diagnosis: collection run 37776249104 incorrectly required mutable RPC for read-only data. Replace that check with pinned chain/block/code checks and direct read-only RPC collection. Original collector PR #577 is merged. The unused uncommitted collector tree was discarded; it is not an active implementation.
