<!--M:domain-oracles:bc7fc3f70953f62fef24e61add8ec24ef2fb4e72929d9b3b2ee2353e8ea3159d-->
### `domain-oracles`
Trigger: Use when prices, rates, TWAPs, pool observations, conversions, or decimal normalization affect protocol decisions

## Objective

Validate oracle source, freshness, manipulation resistance, units, and fallback behavior.

## Review Contract

- Map every price path and decimal conversion.
- Review observation window, liquidity assumptions, stale-data behavior, and sequencer or chain conditions.
- Analyze manipulation cost and downstream loss.
- Test boundaries through structured pinned-fork scenarios when supported.

## Required Output

An oracle assurance ledger with units, freshness, and manipulation analysis.
