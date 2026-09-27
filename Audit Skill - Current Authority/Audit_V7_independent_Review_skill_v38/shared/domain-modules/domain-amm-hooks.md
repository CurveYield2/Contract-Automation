<!--M:domain-amm-hooks:fe30324be54af748596d0b7612ef22a60b196fa10e57231f33bde134750df095-->
### `domain-amm-hooks`
Trigger: Use when pools, hooks, dynamic fees, routers, settlement, callbacks, or liquidity accounting are in scope

## Objective

Review pool invariants, hook authority, settlement ordering, and fee accounting.

## Review Contract

- Map swap, join, exit, settlement, callback, and administrative flows.
- Review hook reentrancy, sender assumptions, dynamic-fee bounds, and balance deltas.
- Analyze fee extraction, permanent liquidity, and token-behavior edge cases.
- Use pinned-fork scenarios for exact integration boundaries when supported.

## Required Output

An AMM-hook ledger, invariant matrix, and validated findings.
