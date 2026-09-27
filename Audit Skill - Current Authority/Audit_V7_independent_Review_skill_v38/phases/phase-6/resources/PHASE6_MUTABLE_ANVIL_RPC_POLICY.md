# Phase 6 Existing Mutable Anvil RPC Policy v1

## Purpose

This reference is normative for every Audit V7 Phase-6 process that consumes fork state or requires mutable JSON-RPC semantics.

The CurveYield execution environment already provides the approved mutable Ethereum Anvil RPC through the trusted Contract-Automation secret profile `SIM_ARCHIVE_PRIMARY_ETHEREUM_01`. **Agents MUST reuse that exact existing path.** They MUST NOT request, accept, discover, invent, or substitute another mutable RPC merely because a tool supports arbitrary RPC configuration.

## Hard execution rule

For Phase 6:

1. The trusted Contract-Automation runner resolves `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` from its execution environment.
2. Phase-6 preflight probes the endpoint, verifies Ethereum chain identity, and freezes the observed block number and block hash for the campaign execution context.
3. Medusa MUST run in fork mode against that existing mutable Anvil RPC and the preflight-frozen block. The admitted runner is expected to enforce `medusa fuzz --rpc-url <runtime-secret> --rpc-block <frozen-block>` or an equivalently source-bound invocation.
4. Native Foundry fuzz/invariant execution MUST use the same existing mutable Anvil RPC and the same preflight-frozen block. The admitted runner is expected to enforce `forge test ... --fork-url <runtime-secret> --fork-block-number <frozen-block>` or an equivalent trusted binding.
5. Medusa and Foundry may use their own internal fuzz execution engines after obtaining fork state, but they MUST NOT select another fork source or requester-controlled RPC.
6. The secret URL MUST remain runtime-only. It MUST NOT appear in the audit request, harness/config templates, campaign ledger, corpus, raw evidence, or final report.
7. Evidence records only the RPC profile name, chain/chainId, frozen block number/hash, tool/runner identity, and pass/fail disposition.

## Scope of the rule

The same existing mutable-Anvil requirement applies whenever an audit step needs mutable RPC semantics, including where applicable:

- Medusa on-chain/fork fuzzing;
- Foundry fork fuzzing/invariant work;
- exploit/reproduction flows;
- deployment/lifecycle simulation;
- account impersonation;
- balance or storage mutation;
- time/block movement;
- snapshot/revert operations;
- deterministic integration simulations that depend on mutable chain state.

Phase 7 remains governed by its own lifecycle/preflight instructions, but it uses the same approved Contract-Automation mutable-Anvil execution boundary when that profile is the admitted chain path.

## Prohibited behavior

The auditor/agent FAILS this policy if it:

- disables Medusa fork mode for an applicable Phase-6 campaign;
- runs Medusa or Foundry against a public/read-only/requester-supplied RPC when the existing mutable profile applies;
- creates a parallel local or remote Anvil fork path instead of reusing the existing Contract-Automation mechanism;
- embeds an RPC URL into Solidity harnesses, committed JSON/TOML, requests, manifests, ledgers, logs, or reports;
- allows Medusa and Foundry to start from different fork identities without a documented, separately approved rerun reason;
- treats missing/unreachable `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` as `NOT_APPLICABLE` rather than an infrastructure blocker;
- substitutes another provider after the approved mutable RPC fails.

## Auditor success

The auditor succeeds when the evidence proves:

- the existing `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` profile was used automatically by the trusted runner;
- Ethereum chain identity was checked;
- the Phase-6 fork block number/hash was frozen before campaign execution;
- every applicable Medusa campaign ran in fork mode on that identity;
- native Foundry used the same identity after terminal Medusa evidence;
- no alternate/requester RPC path was used;
- no secret URL leaked into durable evidence;
- a missing/wrong/unreachable mutable RPC caused typed infrastructure failure and repair routing rather than silent fallback.

## Contract-Automation skeletons

When authoring missing Phase-6 harnesses/configuration, agents MUST first read `phases/phase-6/resources/PHASE6_SKELETON_CODE_INDEX.md` and then use `CurveYield2/Contract-Automation/packages/github-native-sim/harness-skeletons-v2/`. The v1 skeleton kit is historical/deprecated for new work because it predates the mandatory shared mutable-RPC binding.
