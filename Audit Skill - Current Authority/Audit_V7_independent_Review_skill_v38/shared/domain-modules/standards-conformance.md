<!--M:standards-conformance:0c3c392b94ca4f143974ca96e8b97d1816af4fe96f6213d59b8aba3ce28deeb3-->
### `standards-conformance`
Trigger: Use when a contract claims compatibility with token, vault, interface, proxy, signature, or integration standards

## Objective

Compare claimed behavior with mandatory and optional standard requirements.

## Review Contract

- List claimed standards and exact interfaces.
- Review return values, events, revert behavior, metadata, approvals, hooks, and edge cases.
- Test compatibility assumptions against actual dependencies.
- Record intentional deviations and their integration impact.

## Required Output

A standards-conformance ledger with evidence and deviations.
