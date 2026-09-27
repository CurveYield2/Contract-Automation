<!--M:evm-contract-review:7aa323a68871db20c87bab6ee1351203797d7e9436f7400a96b0e07857ee815c-->
### `evm-contract-review`
Trigger: Use when manually reviewing Solidity contracts, libraries, interfaces, inheritance, storage, calls, and integration behavior

## Objective

Perform source-level and flow-level implementation review against the frozen specification.

## Review Contract

- Use the accepted Source Intelligence/source anchors and prior manual coverage as the structural baseline, then re-open only the source paths needed to validate candidate semantics, reachability, contradictions, state mutation, asset movement, callbacks, delegate paths, and privilege behavior. Do not rebuild the Phase-1 structural inventory.
- Review access control, reentrancy, ordering, initialization, upgrade storage, rounding, denial of service, and unsafe assumptions.
- Record reviewed ranges and unresolved questions in the implementation ledger.
- Distinguish candidate issues, validated findings, and dismissed noise.

## Required Output

A line-and-flow implementation review ledger with exact source references.
