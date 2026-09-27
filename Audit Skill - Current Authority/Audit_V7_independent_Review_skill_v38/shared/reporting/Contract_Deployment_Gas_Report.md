# Contract Deployment Gas Report v1

This report is populated from the compiler output already produced during the accepted Phase-7 deployment/simulation lifecycle. It is a separate client deliverable and does not replace the deployment simulation itself.

## Source / compiler binding

- Audited source identity: `<exact commit / package digest>`
- Accepted build/simulation artifact(s): `<artifact IDs / digests>`
- Compiler profile(s): `<compiler versions and exact configuration>`
- Gas estimate source: `compiler deployment-gas estimate from the same accepted compile/deploy lifecycle`

## Deployment gas table

| Contract | Chain | Compiler | Optimization | Runtime bytes | Deployment gas estimate | Evidence |
|---|---|---|---|---:|---:|---|
| `<contract>` | `<chain>` | `<compiler/version>` | `<optimizer settings>` | `<bytes>` | `<estimate or UNAVAILABLE: typed reason>` | `<artifact/reference>` |

## Completeness reconciliation

- Frozen independently deployable production-contract count: `<N>`
- Rows represented in this report: `<N>`
- Missing contracts: `NONE` or `<typed list/reason>`
- Phase-7 completeness result: `PASS` / `INCOMPLETE`

## Notes

- Estimates must come from the exact compiler/configuration used by the accepted audit build/simulation evidence.
- Do not silently substitute transaction gas from a different build, compiler, optimizer profile, or source revision.
- If a compiler cannot produce a numeric estimate, keep the contract row and record a typed reason instead of dropping it.
