<!--M:supply-chain-build:784f438bdf5b37aeae747cf0e3223eb279d6af203eb25bfc7e42782a93170d42-->
### `supply-chain-build`
Trigger: Use when compiler settings, imports, vendored code, generated source, lockfiles, or release artifacts affect the audited build

## Objective

Validate exact-source compilation inputs and compiler evidence without executing project-supplied scripts.

## Review Contract

- Freeze repository, commit, project path, compiler version, optimizer, EVM version, and generated-source digests.
- Review imports and vendored code manually.
- Use the compile profile for exact-source compiler validation.
- Reconcile diagnostics, compiler output, source manifest, and tool versions.

## Required Output

An exact-build review tied to the accepted compile artifact.
