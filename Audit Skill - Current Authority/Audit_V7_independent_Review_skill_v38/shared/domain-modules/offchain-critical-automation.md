<!--M:offchain-critical-automation:dd59cfff635095475811b6c789ff98e005f397a2b7f8826002cdc53fbe5d6764-->
### `offchain-critical-automation`
Trigger: Use when keepers, bots, relayers, indexers, price submitters, or scheduled operations are required for safety or liveness

## Objective

Identify automation assumptions and onchain failure behavior.

## Review Contract

- Map caller permissions, cadence, retries, idempotency, stale state, and economic incentives.
- Review what happens when automation is delayed, duplicated, malicious, or unavailable.
- Separate operational monitoring from onchain enforcement.
- Require explicit failure and recovery procedures for critical tasks.

## Required Output

An offchain-automation ledger and liveness findings.
