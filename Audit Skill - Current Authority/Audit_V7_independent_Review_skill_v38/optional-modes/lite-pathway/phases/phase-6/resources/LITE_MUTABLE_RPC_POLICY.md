# Lite Mutable RPC Policy

Use an existing controller-admitted mutable/archive RPC profile only when the complete deploy/configuration simulation or a candidate-specific proof requires fork state.

- Do not ask the human to select or provide a provider when an admitted campaign profile already exists.
- Freeze chain ID, observed block number/hash and non-secret profile identity before execution.
- Bind every affected simulation/targeted-fuzz result to that same frozen identity.
- Never persist, print or link the secret endpoint URL.
- An unavailable or mismatched required profile triggers execution repair/rebind; it is not evidence that a candidate is safe.
- Do not create parallel fork systems or run excluded broad campaigns merely because fork access exists.
