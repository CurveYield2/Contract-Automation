# Phase-0 Simulation Testing Fork Handoff v1

Updated 2026-09-30 22:14 UTC. This replaces the original pre-repair handoff in place at the user's request.

## Current active continuation

**Phase 0 is SEALED with validation PASS**, verified in the controller receipt. Sealed at 2026-09-30T22:13:01.715Z. Existing campaign/generation/source preserved; no Medusa or telemetry stage was rerun.

Completed:
- Canonical repairs merged through Contract-Automation PR #461, merge 061d5570f058a4019d990ae50edc3d25e7a20270.
- Exact-head regression 36783161610 and PR qualification 36783161634 PASS.
- Canonical main qualification 36783414101 PASS, required capabilities/recipe and live Phase6/Phase7 PASS.
- Controller rebind PR #108 merged at 7a31fa8652d556ef49b1ca5cdb9da8a60e9228df; main pin verified as 061d5570f058a4019d990ae50edc3d25e7a20270 / 36783414101. Stale-pin red regression 36783712665; exact repaired controller head 80bb0e0dec487bf5302d5df6928be96db8db4360 passed full controller npm test/check and authority synchronization in 36783903999.
- Execution-only verification PR #462 closed without merging, with recorded disposition.
- Resume request v8, commit aeded3250ecabf3727338ff283df72c7aaf368f2, used campaign-relative manifest evidence/phase0/COMPLETED_SIMULATION_STAGES_v1.json.
- Recovery dispatch 36784140403 PASS.
- Existing bootstrap 36784152692 PASS. Resume qualification passed; qualification/intelligence jobs skipped because the admitted exact-source evidence was reused. Completed-stage import, projection, evidence publication, finalizer sealing and orchestrator dispatch all succeeded.
- Import preserved original Medusa 130487 calls and four 1200-call telemetry shards, validated raw artifacts, and retained independent fork/deployment provenance in the campaign.
- Orchestrator 36784264268 PASS; Phase1 work form/assignment and browser registration prepared.

**Only remaining requested action:** observe Browser Agent Wake run 36784293965 until it actually posts the reviewer-1 Phase1 wake, arms its watchdog and activates the assignment. Do not rerun bootstrap or simulations now that Phase0 is sealed. If wake fails, use the existing wake recovery/retry path and preserve the sealed campaign.

Current directory: assignment-v2, WAITING_FOR_SUCCESSOR_AGENT, reviewer-1, phase-1.
Wake run: https://github.com/CurveYield2/Contract-Automation/actions/runs/36784293965
Bootstrap: https://github.com/CurveYield2/Contract-Automation/actions/runs/36784152692
Orchestrator: https://github.com/CurveYield2/Contract-Automation/actions/runs/36784264268

The detailed earlier repair/promotion instructions below are historical continuation context and are superseded by this completed-state record.

## Resume here

The isolated deployment, Medusa, and ABI telemetry stages have succeeded. **Do not rerun Medusa.** The next work is to promote the universal infrastructure repairs and integrate the retained stage evidence into the existing campaign, preserving separate execution provenance.

Phase 0 is now sealed with validation PASS. Promotion, qualification/rebind and finalization are complete. Only actual Phase1 browser wake verification remains.

The user asked for this handoff so a successor can continue. No simulation stage was relaunched. GitHub regression/qualification checks are now running for PR #461.

## User instructions that remain binding

- Work one step at a time. Finish the current necessary step before starting another.
- Preserve completed Medusa work; do not execute the entire Medusa stage again.
- Apply repairs universally to smart-contract packages rather than hardcoding a CurveYield-only path.
- First validate the isolated system, then promote its repairs into the canonical Phase 0 automation.
- Continue the same campaign through Phase 0 completion and the actual browser-agent wake of the Phase 1 AI agent.
- Do not initialize a new campaign or modify the source ZIP.
- Use one worker. Do not spawn agents or perform unrelated processes.
- Keep the user informed with short, factual progress updates.
- Execution belongs on GitHub runners, not local compilation or dependency installations.

## Campaign and authority

Repository: CurveYield2/Audit-Controller
Campaign ID: curveyield-dex-v16-source-r1
Campaign path: campaigns/CurveYield DEX v16 Source r1
Generation: curveyield-dex-v16-source-r1-g1-20260930T044939Z
Source archive SHA256: 201a70f61f14e1919d111a972d090b07cf13e5fc06fee10738785adfb6760f4e
Source archive commit: 20544077975c5741f3e7902661c99a0f4459612f
Archive path: campaigns/CurveYield DEX v16 Source r1/source/CurveYield DEX v16 Source.zip
Extracted tree SHA256: b816ecf761d6bb3f8f5b1ca8beaee9cc5f497bad50923bf9fc241e39a4163ed3
Receipt: campaigns/CurveYield DEX v16 Source r1/receipts/PHASE_00_RECEIPT_v1.json
Directory entry: Audit Campaign Directory/campaigns/curveyield-dex-v16-source.json

Read the current controller authority before promotion/finalization:
Audit Skill - Current Authority/Audit_Litemode_v10.3/SKILL.md
and its Phase 0 start/process documentation.

Required runner rebind protocol:
docs/agent-guides/V7_RUNNER_REBIND_PROTOCOL_v1.md

Qualification, source intelligence, exact compilation, and existing campaign evidence must be inspected and preserved; do not restart them reflexively.

## Code location and exact repair branch

Isolated harness:
packages/github-native-sim/audit-harnesses/phase0-simulation-testing-v1/

Files:
- engine-v1.mjs
- action.yml
- run-v1.mjs
- test-v1.test.mjs
- requests/request-v1.json through request-v13.json
- HANDOFF_v1.md

Discovery wrapper:
.github/workflows/lite-phase0-simulation-testing-v1.yml

**Latest working code is on branch repair/phase0-medusa-only-v1**, verified head:
29bd9ea37b0123bb3b52a52599b199cdb5b1bbbb

Do not assume main contains all successful code. Main contains earlier deployment/Medusa infrastructure fixes, but the checksum fix and stage-only execution changes are on this branch.

Branch engine telemetry-only commit:
bfb9b7b6b869a883a65578f828a19dd6f2b7fbb6
Branch composite telemetry-only commit:
220e8556638c7078e757a27acae4cbf85e9e2a40

The latest branch action is deliberately TELEMETRY_ONLY with:
PHASE0_MEDUSA_ONLY=false
PHASE0_TELEMETRY_ONLY=true
PHASE0_PREVIOUS_MEDUSA_RUN_ID=36725469642

These campaign-specific action settings are isolated debugging controls, not a finished universal resume design. Do not copy them unchanged into canonical automation.

Main before this handoff update was e3a2938b2b4c8e8fcbeae6f7dbf4e5113e8bc0fd. Paths above were verified to exist. Re-read current main before merging so concurrent changes are preserved.

## Completed Medusa stage

Run: https://github.com/CurveYield2/Contract-Automation/actions/runs/36725469642
Job: 109921100743
Request: request-v10.json
Head: 793f1176b70b029050651213b5dcac7e233d2fa4
Conclusion: SUCCESS
Medusa: PASS, exit code 0, 130487 observed calls
Configured limit: 125000; required minimum: 100001
Medusa execution: 33 seconds
Router wrappers: 245
Accounting wrapper share: 0.8
Mutable targets: 27
Compiled targets: 37; missing targets: 0
Native deployment: all 32 contracts deployed and verified; source script exited 0
Corpus files indexed: 263
Telemetry runs in this attempt: 0, deliberately MEDUSA_ONLY

Retained artifact:
https://github.com/CurveYield2/Contract-Automation/actions/runs/36725469642/artifacts/11103752157
Name: phase0-simulation-testing-curveyield-dex-v16-source-r1-36725469642
Bytes: 13117861
ZIP SHA256: ab5dfc43a7a3c2373f0531fcf1407bdd4c1afc82c1d7eead82059f1cf28be168

Contains the real router, configuration, Medusa output/corpus and stage summary. Preserve this evidence. This is baseline randomized execution, not a security or invariant-proof conclusion.

## Completed telemetry stage — newly verified for this handoff

Run: https://github.com/CurveYield2/Contract-Automation/actions/runs/36729459569
Job: 109934879361
Request: request-v13.json
Head: 29bd9ea37b0123bb3b52a52599b199cdb5b1bbbb
Conclusion: SUCCESS
Created: 2026-09-30T14:29:07Z
Completed: 2026-09-30T14:52:56Z

Logs explicitly confirm:
[phase0-medusa] not rerun; executing telemetry-only stage

Native script exited 0 after 350 seconds. It compiled 37 production artifacts, deployed all 32 contracts (nonces 0–31), configured through nonce 126, and verified code/configuration. There are 27 mutable targets and no missing compiled targets.

| Shard | Calls | Successes | Reverts | Errors | Accounting share | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| abi-telemetry-001 | 1200 | 34 | 1166 | 0 | 0.8 | PASS |
| abi-telemetry-002 | 1200 | 36 | 1164 | 0 | 0.8 | PASS |
| abi-telemetry-003 | 1200 | 43 | 1157 | 0 | 0.8 | PASS |
| abi-telemetry-004 | 1200 | 20 | 1180 | 0 | 0.8 | PASS |

Total: 4800 real ABI calls, 133 successful transactions, 4667 reverts, zero execution errors.
Reverts remain evidence; these baseline passes do not establish economic correctness or productive protocol-path coverage.

Retained artifact:
https://github.com/CurveYield2/Contract-Automation/actions/runs/36729459569/artifacts/11104879191
Name: phase0-simulation-testing-curveyield-dex-v16-source-r1-36729459569
Bytes: 627230
ZIP SHA256: 5d76eabc0cd04bc4164f489a7313e094f84215742a652dffcd66a9646a217a69
Expiration: 2026-10-14T14:52:47Z — preserve evidence in the campaign before expiration.

The artifact was downloaded and its ZIP hash verified while updating this handoff. All four raw JSONL transcripts were parsed: exactly 1200 rows each, with beforeAccounting, afterAccounting, transaction/error, decoded inputs, action class, and accounting deltas.

Its 11 files are:
- PHASE0_DEPLOY_CONFIG_EXECUTION_v1.json
- PHASE0_RANDOMIZED_SIMULATION_SUMMARY_v1.json
- PHASE0_SIMULATION_RUN_INDEX_v1.json
- runs/abi-telemetry-001 through 004: RAW_SIMULATION_TRANSCRIPT_v1.jsonl and RUN_SUMMARY_v1.json

Summary executionMode is TELEMETRY_ONLY. Medusa status is NOT_RUN_TELEMETRY_ONLY, observedCalls is 0, and previousCompletedWorkflowRunId is 36725469642. This correctly does not claim Medusa ran in this attempt.

Coverage sourcePlanPlanned/sourcePlanDeployed are 0 because the native deployment succeeded and the parser fallback was skipped. These counters are not native deployment counts. Use deployedContracts and the authoritative package deployment report/attempt to verify the actual 32-contract deployment; strengthen canonical completeness validation accordingly.

## Cancelled rerun that must not be resumed

request-v11 initially launched run 36728672500 with Medusa enabled again.
The user objected. request-v12 used the isolated wrapper's cancellation mechanism.
Cancellation helper run 36729044698 succeeded; run 36728672500 is CANCELLED.
The replacement request-v13 ran telemetry only and succeeded.

Do not resume or rerun request-v11.

## Repairs implemented and validated in the isolated harness

1. Correct deployment gas environment names: MAX_FEE_PER_GAS_WEI and MAX_PRIORITY_FEE_PER_GAS_WEI, while recognizing explicit source-consumed override keys.
2. Preserve telemetry terminal.status in summary projection.
3. Merge deployment discoveries so authoritative package report names/addresses win over unnamed bytecode discoveries.
4. Write deployment evidence before randomized stages; fail fast with PHASE0_DEPLOYMENT_INCOMPLETE rather than spending time on an incomplete subset.
5. Compile generated Medusa router in its own Foundry project, not the production Hardhat dependency tree. Router build uses Solidity 0.8.28, Cancun, optimizer 200.
6. Render target address literals using ethers.getAddress checksum. Lowercase Solidity address literals caused the Medusa compilation failure.
7. Fail fast on failed/incomplete Medusa with PHASE0_MEDUSA_INCOMPLETE.
8. Allow native package deployment 900 seconds, with start/300-second heartbeat/exit logging. Earlier 240 seconds killed legitimate production compilation.
9. Batch independent accounting observations with Promise.all; configure ethers provider staticNetwork:true and cacheTimeout:-1. Telemetry shards now finish in roughly 84–89 seconds instead of the earlier long serial observation cost.
10. Upload .simulation-testing-output with include-hidden-files:true.
11. Isolated MEDUSA_ONLY / TELEMETRY_ONLY modes permit sequential debugging without repeating the completed stage.
12. Removed the isolated adapter-test action step during the user-requested narrowly scoped run. This does not waive appropriate canonical regression checks during promotion.

The original gas-env/upload repair instructions and the 4-deployed/28-unresolved state are obsolete. Do not restart debugging from those failures.

## Important limitations and provenance

- Both successful stages use local Anvil, canonical Ethereum chain ID 1, verified ephemeral signers, and execution-only Ethereum WETH/Permit2/payout substitutions.
- The source package is unchanged. Its own deployment order, libraries, constructors, nonce predictions, and configuration logic are retained.
- Base-variant native deployment succeeds. The alternate Katana variant fails preflight because its Aragon DAO factory has no code on this Ethereum baseline. Preserve that limitation; do not claim a Katana chain test passed.
- The source's final DAO address has no code on this fork and 12 ownership/root acceptance actions remain pending. Preserve those qualifications.
- Some tuple ABI parameters and downsampled nonaccounting wrappers remain coverage limitations.
- Generated router runtime is 36863 bytes, larger than production EIP-170. Medusa v1.5.1 defaults CodeSizeCheckDisabled:true; the real run succeeded. No router splitting was required. Production source artifacts independently passed EIP-170/EIP-3860.
- The Forge npm wrapper returned exit 0 on a failed compile in an earlier probe. Compile verification must check actual artifact/build info/nonempty bytecode, not just wrapper exit status.
- The Medusa and telemetry attempts used different ephemeral forks/deployment addresses. Never represent them as one uninterrupted fork.
- The telemetry summary is not a full source-bound combined-stage receipt. Its campaignId and previous run reference alone are insufficient to accept imported Medusa evidence. Verify source/archive, actual workflow checkout, compiler/target identities and per-stage fork provenance before canonical ingestion.
- Baseline dispositions in the telemetry-only summary still describe Medusa as NOT_RUN_TELEMETRY_ONLY. Reconciliation must import the actual earlier Medusa disposition with evidence, not flip status or invent current-run counts.

## Exact next work for the successor

1. Read this handoff, current controller authority, repository AGENTS instructions, and the rebind protocol. Fetch the exact branch and both successful artifacts. Preserve them before expiration.
2. Implement a universal, explicit completed-stage evidence import/resume mechanism so the existing Medusa result is reused without running Medusa again. Bind imported evidence to exact source, compilation/targets, workflow identity, policy thresholds, artifact hashes, and separate fork provenance. Reject mismatches. Do not weaken gates or simply paste PASS/counts into a summary.
3. Promote the validated isolated deployment/router/telemetry repairs to canonical Phase 0 files, adapting imports and preserving current main changes. Perform only the required targeted regression and infrastructure checks.
4. Follow the controller's V7 runner rebind protocol: qualify the exact repaired runner commit, update admitted execution pins/fixtures on a dedicated controller branch, run the required GitHub checks, and merge only the exact tested head. Re-fetch current pins rather than copying historical values below.
5. Run the remaining existing-campaign Phase 0 pipeline using accepted completed-stage evidence. Preserve completed source intelligence; generate required raw evidence references, later-phase inputs/matrices, and finalizer inputs. Do not restart the campaign or rerun Medusa.
6. Seal Phase 0 only after real finalizer gates pass, then execute the existing browser orchestrator/wake path and verify that the Phase 1 agent actually wakes. Workflow dispatch alone is not the end condition.

Do not launch the full bootstrap unchanged: its default simulation path would repeat Medusa.

## Canonical integration map

These files have not yet received the full successful branch repairs:
- .github/workflows/lite-phase0-randomized-simulation-v1.yml
- packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs
- packages/github-native-sim/test/phase0-randomized-simulation-v1.test.mjs

Canonical imports differ from the isolated engine:
- isolated ../../../runner/src/... becomes canonical ../../runner/src/...
- isolated ../../src/execution.mjs becomes canonical ./execution.mjs
- isolated ../../src/source-known-deployment-plan-v1.mjs becomes canonical ./source-known-deployment-plan-v1.mjs

The canonical test previously accepted incomplete-deployment subset continuation; replace that expectation with a meaningful fail-fast regression. Canonical artifact upload previously omitted include-hidden-files:true. Confirm fresh code before editing.

Evidence writer:
scripts/write-phase0-simulation-outputs-v1.mjs
Finalizer:
scripts/lite-phase0-finalize-v1.mjs
Full sequence:
qualification → intelligence → randomized simulation → finalizer → browser orchestrator/wake

Relevant workflows:
- .github/workflows/lite-phase0-bootstrap-v1.yml
- .github/workflows/lite-phase0-bootstrap-recovery-dispatch-v1.yml
- .github/workflows/v7-execution-infrastructure-qualification.yml
- .github/workflows/test-lite-single-receipt-upgrade-v1.yml
- .github/workflows/lite-audit-browser-orchestrator-v1.yml

Recovery push requests live under:
process/agent-upload/lite-phase0-bootstrap-recovery/*.json
Schema: curveyield-lite-phase0-bootstrap-recovery-v1
Fields: campaign_id, campaign_path, audit_controller_ref.
Last observed recovery request was v7; confirm current requests before choosing the next version.

Historical controller pin (not an instruction to keep it):
packages/contract-automation-adapter/src/admitted-execution-contract-v1.mjs
qualified commit bbaa0182a329f7070189a2a1d70df9b849cd07bc
qualification run 36334499963.

Three fixture/tests referenced that older pin:
- packages/contract-automation-adapter/test/v26-qualified-runner-policy-v1.test.mjs
- packages/contract-automation-adapter/test/v26-execution-adapter-v1.test.mjs
- packages/controller-core/test/v26-machine-conformance-v1.test.mjs

Use exact qualifiedCommit, not a subsequent status-writeback main HEAD. Do not alter historical evidence, contract semantics, or release identity merely to satisfy a pin check.

## GitHub access and practical notes

Use the GitHub connector for reads/writes. Direct fetch of:
https://api.github.com/repos/CurveYield2/Contract-Automation/actions/runs/<id>
and /jobs gave reliable current status. Normalized job/step wrappers sometimes returned stale active-step data.

Completed job logs are available through github_fetch_workflow_job_logs. Active jobs can return BlobNotFound.
Artifacts are available through github_fetch_workflow_run_artifacts and github_download_workflow_artifact.

The isolated workflow supports workflow_dispatch and pushes of requests/*.json on the repair branch. Cancellation requests use cancel_run_id and only cancel this isolated workflow. Do not create a new run merely to obtain status.

Root progress reports already exist:
PHASE0_MEDUSA_PROGRESS_UPDATE_v1.md
PHASE0_MEDUSA_PROGRESS_UPDATE_v2.md
They predate the final telemetry result above. This handoff is the current continuation record.
