## GitHub Actions event-trigger gate

Whenever technical execution depends on GitHub Actions, read [`GITHUB_ACTIONS_VIA_GITHUB_APP.md`](GITHUB_ACTIONS_VIA_GITHUB_APP.md) before declaring workflow execution unavailable.

- Inspect the active workflow's `on:` block.
- Prefer the existing agent-operable event trigger already defined by the workflow.
- Do not treat missing direct `workflow_dispatch` capability as a blocker when a PR, push/path, issue-label, or authorized comment trigger exists.
- For a workflow that truly exposes only `workflow_dispatch`, exhaust the guide's authorized event-trigger/add-trigger procedure before requesting human manual execution.
- Preserve exact triggering event, workflow run, job, log, and artifact identities as execution evidence.

# Execution Preflight and Runner Repair Protocol v1

## Authority

This protocol is mandatory for V7 technical execution. The Audit Controller owns admission; Contract-Automation owns trusted execution. Target production source MUST NOT be changed to satisfy infrastructure preflight.

## Admitted execution contract

Every campaign that reaches technical execution MUST bind an immutable admitted execution contract containing the exact `contractAutomationRelease`, `runnerRelease`, request schema, accepted profiles, qualification evidence identity, and admission timestamp. Agents copy these values from controller state; they do not carry or infer a runner commit from the skill packet.

## Phase 6 execution preflight — hard gate before `ACTIVE`

Phase 6 MUST remain in `PHASE6_EXECUTION_PREFLIGHT` until all of the following are recorded:

1. exact campaign/source/handoff identity validated;
2. active admitted `contractAutomationRelease` and `runnerRelease` validated;
3. accepted request schema/profile resolved (`deep-assurance-github-request-v2` / `github-native-simulate-v2`);
4. exact requested compiler languages/versions/settings are accepted by the qualified runner;
5. supplied Medusa harness/configuration usability and **methodological adequacy** are classified and, when absent/unusable/inadequate, an auditor-owned Medusa harness/configuration plan is recorded;
6. supplied Foundry/native-fuzz harness usability and methodological adequacy are classified and, when absent/unusable/inadequate, an auditor-owned Foundry fuzz/invariant harness/script plan is recorded;
7. a draft `PHASE6_FUZZ_CAMPAIGN_LEDGER` exists with Processes 1–7 marked required, Processes 8–11 queued for objective trigger evaluation, and Phase-2–5 properties/hypotheses/boundaries mapped into the campaign plan;
8. broad Medusa discovery targets, initial actor/sender set, seed/corpus plan, and initial coverage dimensions are recorded before target narrowing;
9. required runner tool availability is classified separately from target-harness applicability;
10. runner-manifest identity matches the admitted execution contract.

**Existing mutable Anvil RPC gate:** whenever Medusa or native Foundry is applicable, Phase-6 preflight MUST also prove the trusted `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` profile is present/reachable, reconciles to Ethereum, and yields a frozen block number/hash for both engines. The URL is runtime-secret material and MUST NOT be persisted. Alternate/requester RPCs are forbidden. Failure routes to `RUNNER_REPAIR_REBIND`; it is not `NOT_APPLICABLE`.

Repository-provided fuzz harnesses are **not required inputs**. If the frozen target has no usable Medusa or native Foundry fuzz/invariant harness, the auditor MUST create the missing audit-only harness/scripts/configuration under `phases/phase-6/resources/PHASE6_FUZZ_HARNESS_REQUIREMENTS.md` and execute the campaign methodology in `phases/phase-6/resources/PHASE6_FUZZ_CAMPAIGN_METHODOLOGY.md`. `TARGET_HARNESS_NOT_PRESENT` is forbidden as a `NOT_APPLICABLE` reason. Do not modify frozen production source to satisfy harness construction.

If harness construction or required engine execution is blocked, use bounded execution repair first. After required recovery, an unresolved required stage is recorded as `FAILED` with exact blocker/recovery evidence. `NOT_APPLICABLE` is reserved for a genuine controller-recorded target/tool incompatibility after an audit-owned adapter/harness route has been considered.

Only after the preflight record is sealed may the controller transition Phase 6 to `ACTIVE`. The preflight does not authorize native Foundry execution before all required Medusa campaign nodes reach terminal evidence.

## Phase 7 fork preflight — hard gate before lifecycle execution

Phase 7 MUST remain in `PHASE7_FORK_PREFLIGHT` until trusted Contract-Automation evidence proves:

1. Anvil launcher/package is available and starts successfully;
2. Anvil accepts the exact requested EVM hardfork without downgrade;
3. the requested chain has an archive RPC admitted by the controller. At this release, only Ethereum is admitted, through `SIM_ARCHIVE_PRIMARY_ETHEREUM_01`. Any non-Ethereum Phase-7 request remains in `PHASE7_FORK_PREFLIGHT` with `ARCHIVE_RPC_UNAVAILABLE`; do not substitute a normal/non-archive RPC and do not classify mere absence of an archive provider as a runner defect;
4. remote RPC chain/network identity is reconciled to the requested chain;
5. the pinned historical block and state are available;
6. every literal external target required by the lifecycle has non-empty code at the pinned block, or is explicitly classified as expected EOA/non-contract;
7. account impersonation and balance control work through the Anvil compatibility adapter;
8. every requested workflow step uses an allowlisted action;
9. the lifecycle recipe is recognized or every custom step has an explicit supported-action mapping.

Only after the preflight record is sealed may lifecycle execution begin.

## `RUNNER_REPAIR_REBIND` state

A trusted-execution defect after campaign admission enters `RUNNER_REPAIR_REBIND` instead of improvising around immutable identity.

Required behavior:

- preserve the failed request/run/job/artifact/result attempt;
- freeze and re-verify the target source digest; no target production source changes are permitted;
- permit infrastructure-only changes in Contract-Automation;
- require the candidate runner to pass the repository-level permanent qualification gate;
- record old and new `contractAutomationRelease`, `runnerRelease`, runner implementation commit, qualification run/job, and manifest identity;
- produce a rebind receipt that states why the old runner was insufficient and proves source identity is unchanged;
- update the campaign admitted execution contract only through the controller;
- retry the **exact same audit request semantics** under the new admitted execution contract; request identity may change only where the execution-contract identity is part of the canonical digest;
- preserve all superseded attempts as evidence.

Failure to qualify a repaired runner keeps the campaign in `RUNNER_REPAIR_REBIND`; it does not authorize fallback execution.

## Permanent Contract-Automation qualification

Infrastructure qualification is repository-level, not campaign-specific. Before a runner release may be admitted by any campaign, its qualification evidence MUST cover at least: V2 request validation, exact compiler-profile handling, Anvil launch, Anvil-only full simulation policy, requested hardfork support including Cancun, archive identity normalization, historical-state access, target-code probes, impersonation/balance control, workflow-action validation, artifact upload/collection, and normalized result/evidence generation.

Campaign phases consume this qualification evidence by immutable identity rather than repairing these facilities afresh. Repository qualification of archive behavior currently covers Ethereum only; adding another chain requires a separately admitted archive RPC profile and renewed repository-level qualification before that chain may pass Phase 7 preflight.
