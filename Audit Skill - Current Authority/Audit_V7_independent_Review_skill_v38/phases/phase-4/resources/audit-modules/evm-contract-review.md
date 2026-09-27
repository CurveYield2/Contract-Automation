<!--M:evm-contract-review:7aa323a68871db20c87bab6ee1351203797d7e9436f7400a96b0e07857ee815c-->
### `evm-contract-review`
Trigger: Use when manually reviewing Solidity contracts, libraries, interfaces, inheritance, storage, calls, and integration behavior

## Objective

Perform source-level and flow-level implementation review against the frozen specification.

## Review Contract

- Use Source Intelligence as the structural coverage map, then semantically trace every external entry point, state mutation, asset movement, callback, delegate path, and privileged action in raw source. Record discrepancies; do not create a competing structural inventory.
- Review access control, reentrancy, ordering, initialization, upgrade storage, rounding, denial of service, and unsafe assumptions.
- Record reviewed ranges and unresolved questions in the implementation ledger.
- Distinguish candidate issues, validated findings, and dismissed noise.

## Required Output

A line-and-flow implementation review ledger with exact source references.
