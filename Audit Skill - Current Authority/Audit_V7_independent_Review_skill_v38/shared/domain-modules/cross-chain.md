<!--M:cross-chain:cd206eabddcc085bb298ab45a2be983fb7b28b2aeab3fe5dddc3268e8739b3d3-->
### `cross-chain`
Trigger: Use when messages, bridges, remote executors, chain-specific state, replay domains, or cross-chain governance are in scope

## Objective

Review message authenticity, ordering, replay protection, destination authority, and failure recovery.

## Review Contract

- Map source and destination chains, endpoints, adapters, trusted senders, nonces, and domain separation.
- Review duplicate, delayed, reordered, failed, and malicious messages.
- Trace remote ownership and emergency paths.
- Separate single-chain simulation evidence from cross-chain conclusions.

## Required Output

A cross-chain ledger and attack paths with explicit untested assumptions.
