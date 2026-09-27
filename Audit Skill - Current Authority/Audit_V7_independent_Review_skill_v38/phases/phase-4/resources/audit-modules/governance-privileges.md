<!--M:governance-privileges:eb3126fbd8c1ff2e86f78b538dd380366342701b8c73934adece576adfae61f5-->
### `governance-privileges`
Trigger: Use when owners, DAOs, multisigs, plugins, timelocks, guardians, keepers, or administrators can alter protocol behavior

## Objective

Map every authority and prove that privileged transitions match the intended governance model.

## Review Contract

- Enumerate setters, upgrades, pauses, emergency actions, arbitrary-call paths, role administration, and ownership transfer.
- Trace indirect privilege through plugins, proxies, safes, bridges, and delegate calls.
- Review timelock coverage, cancellation, replay, and execution ordering.
- Treat undocumented or unconstrained authority as a finding.

## Required Output

An authority graph and privilege-transition ledger.
