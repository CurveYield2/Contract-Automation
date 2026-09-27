<!--M:domain-vaults-strategies:d56031b3ab755eef5d4061b7f8213993cd574598de411ba7c662144f95c104c7-->
### `domain-vaults-strategies`
Trigger: Use when reviewing share vaults, strategies, harvesters, adapters, compounding, withdrawal fees, or strategy migration

## Objective

Verify share accounting, lifecycle integrity, strategy authority, and loss handling.

## Review Contract

- Review first and last depositor, donations, harvest timing, locked profit, fees, losses, and emergency exits.
- Trace strategy changes, approvals, asset recovery, and migration.
- Check share-price monotonicity assumptions and rounding direction.
- Reconcile vault assets with strategy balances across repeated lifecycles.

## Required Output

A vault-strategy ledger plus accounting invariants and findings.
