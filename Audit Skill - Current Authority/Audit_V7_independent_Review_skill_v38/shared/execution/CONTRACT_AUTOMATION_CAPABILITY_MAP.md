# Contract Automation Capability Map v2

Operational baseline is supplied by the Audit Controller's admitted execution contract. The skill packet does not pin a mutable implementation commit. Historical deleted-organization identities remain provenance-only and MUST NOT authorize new execution.

| Profile | Purpose | Analysis usage | Evidence |
|---|---|---|---|
| `github-native-compile-v1` | **HISTORICAL / NON-EXECUTABLE** legacy compilation profile | none | historical evidence only |
| `github-native-simulate-v1` | **HISTORICAL / NON-EXECUTABLE** legacy simulation profile | none | historical evidence only |
| `github-native-compile-v2` | Exact Solidity/Vyper/mixed build using language-neutral artifacts | Phase 1: Slither + SBOM/coverage inputs | exact source inventory, compiler/artifact identity, Slither evidence, SBOM, normalized result |
| `github-native-simulate-v2` | Exact v2 build plus pinned runtime | Phase 6: Medusa then native fuzz; Phase 7 lifecycle; conditional Phase 8/9 retests | build, Medusa, native-fuzz replay, coverage, SBOM, lifecycle/targeted simulation, component failures/limitations |

Exact admitted tool versions in this baseline include Slither `0.11.6`, Medusa `1.5.1`, Vyper `0.4.3`, and the exact Solidity compiler descriptor required by each request. The runner preserves analysis observations/counterexamples as **non-authoritative** evidence. Component failures and failed workflow steps are surfaced as evidence/limitations and do not independently decide PASS/NO_GO.

`SLITHER_PHASE1_NEUTRAL_RECON`: run Slither during Phase 1 after exact source/build admission and issue `NEUTRAL_SOURCE_RECON_PACKET_v1`.

`MEDUSA_THEN_NATIVE_FUZZ_MANDATORY`: in Phase 6, Medusa must reach a terminal evidence record before native fuzz starts. Neither stage may be silently omitted; typed inapplicable/failure evidence is required when execution cannot occur.

Phase-7 archive-fork capability is currently Ethereum-only and uses the controller-admitted `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` profile. Base or another chain may not borrow a normal RPC as an archive substitute; it remains `ARCHIVE_RPC_UNAVAILABLE` until a chain-specific archive profile is admitted and qualified.

Repository-supplied arbitrary commands remain outside the trusted execution boundary.
