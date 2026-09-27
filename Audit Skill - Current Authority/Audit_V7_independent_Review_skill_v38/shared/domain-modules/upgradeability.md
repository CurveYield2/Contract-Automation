<!--M:upgradeability:4402f1565d7151a0be51abfdefa7f3ea3ea5ce10181381971be60eb640f22278-->
### `upgradeability`
Trigger: Use when proxies, implementations, initializers, storage layouts, beacons, registries, or migration procedures are in scope

## Objective

Validate upgrade authority, storage compatibility, initialization, and migration safety.

## Review Contract

- Identify proxy pattern and every implementation-selection path.
- Review initializer guards, reinitializers, constructor assumptions, and implementation locking.
- Compare storage layout and semantic behavior for the exact release candidate.
- Verify rollback, migration, and governance sequencing.

## Required Output

An upgrade-safety ledger bound to the exact release manifest.
