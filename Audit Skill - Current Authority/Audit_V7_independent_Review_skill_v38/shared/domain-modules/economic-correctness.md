<!--M:economic-correctness:9c74ea39ee1c7489ebe1b0852449d25b8b443e1aedd74960507e32f2179b1610-->
### `economic-correctness`
Trigger: Use when value accounting, shares, rewards, fees, debt, collateral, solvency, incentives, or market behavior affects security

## Objective

Prove economic and accounting consistency across complete user and protocol lifecycles.

## Review Contract

- Reconcile deposits, withdrawals, fees, rewards, debt, reserves, supply, and treasury flows.
- Test rounding direction, donation effects, first and last user cases, loss allocation, and adversarial timing.
- Separate conservation equations from pricing assumptions.
- Escalate any unreconciled value path as a validated finding and severity-grade it under `shared/policy/SEVERITY_CALIBRATION.md`; bounded economically immaterial loss, including a single harvest interval of yield with principal safe, is Low at most even when another user can receive the value. Medium requires evidence of meaningful economic or operational materiality. Only unresolved High/Critical findings create security `NO_GO`.

## Required Output

An economic reconciliation ledger, asset-flow ledger, and validated economic findings.
