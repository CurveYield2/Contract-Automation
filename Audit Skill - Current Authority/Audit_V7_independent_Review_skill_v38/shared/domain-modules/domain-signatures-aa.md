<!--M:domain-signatures-aa:b4276e7ed72862947f5181dd9afe211d579639abe38d15688a311a1001f27abd-->
### `domain-signatures-aa`
Trigger: Use when permits, signatures, typed data, session keys, relayers, account abstraction, or delegated authorization is in scope

## Objective

Validate signer intent, domain separation, nonce handling, replay resistance, and authorization lifetime.

## Review Contract

- Map signer, caller, beneficiary, chain, verifying contract, nonce, deadline, and payload binding.
- Review malleability, replay across domains, partial payload binding, and cancellation.
- Trace delegated and session-key authority.
- Check bundler, paymaster, and relayer trust assumptions where relevant.

## Required Output

A signature and delegated-authorization ledger.
