<!--M:external-dependencies:d3ac5242c5a016b820b9a5668e5e629281a39d5dc73366f7d04cbb1f51bf156f-->
### `external-dependencies`
Trigger: Use when the protocol relies on tokens, routers, pools, oracles, bridges, vaults, registries, governance systems, or offchain services

## Objective

Model dependency assumptions, failure modes, upgrade authority, and integration boundaries.

## Review Contract

- Record exact dependency identity, chain, address, interface, authority, and trust assumptions.
- Review nonstandard token behavior, callback behavior, stale data, paused systems, and upgrade drift.
- Trace how dependency failure propagates into custody, solvency, and liveness.
- Require source or verified interface evidence for critical assumptions.

## Required Output

An external-dependency ledger and integration findings.
