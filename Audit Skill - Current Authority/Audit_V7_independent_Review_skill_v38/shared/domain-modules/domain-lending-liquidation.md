<!--M:domain-lending-liquidation:1da760f064b07b98542c2f1f0833bf3ca9662b2e73d6b6727a362dca03494087-->
### `domain-lending-liquidation`
Trigger: Use when collateral, borrowing, interest, health, liquidation, bad debt, or repayment accounting is in scope

## Objective

Verify solvency, interest accounting, liquidation incentives, and bad-debt behavior.

## Review Contract

- Model collateral valuation, LTV, health, interest accrual, repayment, liquidation, and reserve accounting.
- Review dust, partial liquidation, self-liquidation, close factors, and rounding.
- Analyze price jumps, stale prices, liquidity loss, and repeated lifecycle effects.
- Reconcile total debt and assets after every transition.

## Required Output

A lending-liquidation ledger and solvency reconciliation.
