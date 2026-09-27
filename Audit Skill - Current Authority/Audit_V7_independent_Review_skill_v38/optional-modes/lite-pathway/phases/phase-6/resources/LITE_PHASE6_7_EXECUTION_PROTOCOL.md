# Lite Phase 6–7 Execution Protocol

This protocol defines the complete retained execution scope. It does not authorize any excluded Full-path campaign.

## 1. Identity and build admission

Record source commit/digest, dependency lock digest, compiler/toolchain versions, build command, configuration inputs and artifact digest. A prior build may be reused only when every identity remains exact. Otherwise repair, rebuild and replace the stale evidence.

## 2. Complete deploy/configuration simulation

Start from a clean deterministic environment and execute the release's actual order of operations:

1. establish chain/fork identity and funded actors;
2. deploy every required implementation, proxy, registry, library, mock or external integration substitute;
3. execute every constructor and initializer exactly once;
4. set all addresses, roles, permissions, caps, fees, limits, routes and dependency references;
5. perform ownership/admin/governance transitions and revoke temporary deployer authority;
6. establish approvals, allowlists, oracle/data inputs and automation actors required for operation;
7. run post-wiring assertions covering code/address identity, roles, storage/configuration values and a minimal usable transaction path.

Missing material configuration is not silently defaulted. Recover it or preserve the exact limitation. When a mutable/archive RPC is required, follow [`LITE_MUTABLE_RPC_POLICY.md`](LITE_MUTABLE_RPC_POLICY.md).

## 2A. Deterministic environment reuse and batching

When multiple candidate tests share the **exact same** source, toolchain, fork/block, deployment/configuration identity and prerequisite state, establish the complete deployment once and reuse a deterministic snapshot/revert cycle or equivalent isolated reset for the batch. Group compatible executions to reduce repeated deployment/build cost. Never batch across identity changes or incompatible starting states, and never merge candidate-specific oracles, traces, evidence identities, or dispositions.

## 3. Candidate-specific deterministic simulation

For each material candidate, execute the shortest exact sequence; compatible candidates may share the admitted environment/snapshot under Section 2A, but each retains independent setup, oracle and evidence that can decisively demonstrate or refute its success condition. Include a secure control when useful. Preserve environment, actor, starting state, calls, parameters, emitted events, storage/balance changes, revert data and trace/result references.

## 4. Basic targeted fuzzing

For each candidate with variable-sensitive behavior:

- constrain generation to the candidate's relevant actors, functions, states and parameters;
- cover zero, one, minimum/maximum valid, immediately out-of-range, rounding boundary and known trigger-adjacent values when applicable;
- use a stated oracle derived from a `PROP-*` or `HYP-*` success condition;
- minimize any failing input when supported;
- stop when the bounded candidate question is decisively resolved or the allotted bounded run remains inconclusive.

Do not broaden this into stateful random exploration, chaos, Medusa, mutation, differential/reference, corpus/deep, exhaustive known-attack or coverage-guided campaigns.

## 5. Evidence and disposition

Use `SUPPORTED`, `DISPROVED`, `INCONCLUSIVE`, or `BLOCKED`. `INCONCLUSIVE` and unresolved `BLOCKED` targets become Phase-8 validation obligations. Record exact evidence and limitations; execution volume alone never determines disposition.
