# Blind Qualification and Controlled Rollout v1 — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Execute each task sequentially and deliver its verified result before proceeding.

**Goal:** Establish measurable evidence of detection improvement without teaching reviewers the answer key, and activate the new policy without corrupting live campaigns.
**Architecture:** Separate process conformance, defect-detection scoring and release admission. Keep answer keys outside reviewer-visible repositories/Projects. Bind every release decision to exact automation and authority revisions.
**Tech Stack:** Existing GitHub controller/runner, JSON evidence, deterministic Node.js scoring and existing reviewed workflow entrypoints.
**Spec:** 00_BUILD_CONTRACT_v1.md plus 01_BASELINE_AND_INVENTORY_v1.md and 02_REVIEW_AND_BASELINE_CHECKS_v1.md.

## Global constraints

No benchmark exploit construction or production execution is part of this plan. Use owner-supplied validated isolated fixtures and safe defensive assertions. Never publish restricted answer keys in public Contract-Automation. No local compilation/dependency installation. Do not resurrect an archived qualification workflow merely because old documentation names it; inspect current workflows and extend the appropriate live entrypoint.

## Review focus

- Hidden-key leakage through logs, filenames or shared memory: Task 8 invalidates the run.
- Severity shopping and excluded misses: Task 8 freezes truth and scoring policy before runs.
- One lucky run: Task 9 requires repeat qualification with fresh sessions.
- Partial authority/controller deployment: Task 10 blocks policy admission.
- Expensive reruns and runaway workflows: Task 10 requires static-only refresh and bounded execution.

## Stage 5 / Task 8 — Scoring contract and blind boundaries

**Files**
- Create scripts/lib/lite-detection-qualification-v1.mjs.
- Create scripts/tests/lite-detection-qualification-v1.test.mjs.
- Create protocol/schemas/curveyield-detection-qualification-v1.schema.json.
- Campaign public-safe output: work/qualification/DETECTION_QUALIFICATION_v1.json and controller-rendered DETECTION_QUALIFICATION_v1.md.
- Owner-restricted answer key and case mapping stay in the existing restricted benchmark location identified in Task 1.

**Interface**
scoreQualificationV1({releaseBinding,policy,truth,cases,runs,adjudications,contamination}) -> {schemaVersion:"curveyield-detection-qualification-v1",releaseBinding,policy,metrics,caseResults,blockingReasons,decision}.
releaseBinding = {automationCommit,authorityCommit,authorityDigest,inventorySchemaVersion,reviewSchemaVersion,baselineSchemaVersion,policyVersion}.
decision = QUALIFIED|NOT_QUALIFIED|INVALID.
policy is frozen before reviewer access and has exact initial defaults:
{criticalRecall:1,highRecall:1,mediumRecall:0.9,lowRecall:0.8,minimumPrecision:0.95,maximumCriticalHighFalsePositivesOnCleanControls:0,requiredFreshRuns:2,minimumHoldoutDefectCases:20,minimumCleanControlCases:10,minimumContractFamilies:3}.
These are proposed release criteria, not measured results. Do not weaken them after observing misses.

truth row = {caseId,fixtureDigest,propertyId,validatedSeverity,validationEvidenceRefs,controlCaseId,split}.
split = REGRESSION|HOLDOUT|CLEAN_CONTROL.
adjudication = {caseId,findingId,sourceMatch,propertyMatch,rootCauseMatch,impactMatch,decision,reason,evidenceRefs,adjudicatorIdentity}.
decision MATCH|NO_MATCH|INVALID_TRUTH. Titles and keyword overlap alone never constitute a match.

- [ ] Write tests for duplicate findings on one case; same title but wrong source; correct root cause with differently worded title; invalid/unvalidated truth; missing run output; contaminated run; Critical false positive on a clean control; zero denominator for a severity class.
- [ ] Freeze an owner-validated truth manifest and split before execution. Known disclosed cases belong to REGRESSION only. Never relabel the original disclosed benchmark as a fresh blind holdout.
- [ ] Require at least 20 validated HOLDOUT defect cases and 10 independently validated CLEAN_CONTROL cases across at least 3 contract families. At least one validated case per severity class is required to claim that class qualified; zero denominator yields NOT_EVALUATED, not 100%.
- [ ] Holdouts must not differ only by identifier renaming from disclosed cases. The owner confirms distinct structural/property scenarios and tracks exposure. The implementation agent cannot certify unseen status for cases it has already read.
- [ ] Deliver reviewers only opaque case IDs, exact source, neutral specifications and allowed operational inputs. Do not expose seed labels, severity labels, diffs, answer-key filenames, scoring results or paired-control mapping before sealing.
- [ ] Use an owner-controlled scoring boundary that reviewers cannot read. Shared credentials with access to the key do not establish enforced blinding. If isolation cannot be verified, record ASSISTED_REGRESSION or UNVERIFIED_BLINDING and do not grant HOLDOUT qualification.
- [ ] Count a detection when a sealed finding is adjudicated to the correct source/root cause/property and supported impact. Duplicate findings count once. A concern present only in intermediate notes is discovery recall, not final detection recall.
- [ ] Compute discoveryRecall, finalRecall, precision and falsePositiveCount separately per severity, contract family and run. precision = matchedDistinctFindings / allAdjudicatedDistinctFindings. Report unresolved findings separately and block qualification until adjudicated.
- [ ] For each severity require detected >= ceil(threshold * validatedEligibleCases), independently per run. Never pool two runs so one run's detections hide the other's misses.
- [ ] An invalid truth case requires owner adjudication and recorded reason. The original count remains visible. If removal changes minimum suite sizes, qualification is incomplete until an unexposed replacement is admitted.
- [ ] Contamination makes the affected HOLDOUT run INVALID. Timeouts, missing results and process failures produce NOT_QUALIFIED, not an excluded denominator or clean result.
- [ ] Run node --test scripts/tests/lite-detection-qualification-v1.test.mjs on GitHub. Commit scorer and report synthetic expected scores.

## Stage 5 / Task 9 — Qualification execution and interpretation

**Files**
- Integrate qualification evidence admission in scripts/lite-phase-packet-controller-v1.mjs.
- Extend packages/github-native-sim/test/lite-phase-packet-controller-integration-v1.test.mjs.
- Preserve execution evidence under existing campaign artifact ownership; do not create public answer-key artifacts.

- [ ] First run deterministic conformance fixtures from Tasks 1–8. Passing these establishes control logic only; label it PROCESS_CONFORMANCE_PASS.
- [ ] Run the disclosed original benchmark as REGRESSION after its full validated case list is recovered. Report all misses, including lower severity; incomplete truth cannot yield a full 30-case score.
- [ ] Execute the frozen HOLDOUT/CLEAN_CONTROL suite twice with fresh, isolated reviewer sessions and identical releaseBinding. Browser sessions run sequentially. The second run receives no first-run conclusions or scores.
- [ ] Seal all reviewer outputs before revealing the owner key to the scoring process. Preserve run IDs, exact source identities, model/settings as observed, session lineage, raw evidence and adjudication identity.
- [ ] Require no missed validated Critical/High case in either holdout run, the fixed Medium/Low thresholds in each run, precision >=0.95 in each run, and zero Critical/High false positives on clean controls.
- [ ] Require all review assignments accepted, integration obligations closed and baseline evidence complete. A strong detection score cannot waive a process failure.
- [ ] Publish the release scorecard with per-run/per-severity counts, contract-family results, false positives, exclusions, unknowns, contamination status and exact limitations.
- [ ] If a holdout fails, classify its first loss point using Task 1. Repair that bounded failure. Retire exposed cases into regression and use new owner-provided unseen cases for fresh qualification. Never repeatedly tune on the same holdout while retaining its blind label.
- [ ] Limit automatic retry to one unchanged transient infrastructure retry. A second failure requires a diagnosed changed input/code or external repair; no self-triggering rerun loop.
- [ ] Record QUALIFIED only for the tested release/profile/families. State that finite suite success does not prove absence of defects in future audits.

**Acceptance:** A release cannot pass because six findings were produced, because all forms exist, or because simulations completed. Both independent holdout runs meet every frozen metric and process gate.

## Stage 5 / Task 10 — Atomic admission, compatibility and workflow guards

**Files**
- Modify scripts/lite-phase-packet-controller-v1.mjs.
- Modify scripts/lib/lite-phase-work-v1.mjs and scripts/lib/lite-phase-prefill-v1.mjs.
- Modify scripts/validate-lite-authority-automation-sync-v1.mjs.
- Extend packages/github-native-sim/test/lite-phase-schema-policy-v1.test.mjs and packages/github-native-sim/test/lite-phase-packet-controller-integration-v1.test.mjs.
- Update the resolved authority package in Audit-Controller and its manifest/ZIP using the established synchronization implementation.
- Extend the existing relevant live controller workflow; do not create an additional production audit orchestrator.

**Interface**
admitDetectionPolicyV1({campaign,releaseBinding,qualification,installedCapabilities}) -> {admitted:boolean,errors,requiredMigration:null|object}.
installedCapabilities must exactly support inventory, assignment, review, challenge, baseline result and authority versions. Unknown policyVersion always rejects.

- [ ] Write compatibility fixtures: old campaign remains on old policy; new campaign missing baseline validator; authority hash mismatch; unknown schema; changed automation commit after qualification; partial rollout; rework of a sealed phase.
- [ ] Add explicit policy admission at new campaign creation. A new-policy campaign cannot begin with any missing producer/consumer capability or without valid qualification for its releaseBinding.
- [ ] Keep code installed but disabled while qualification is incomplete. Distinguish INSTALLED_UNQUALIFIED, QUALIFIED and ACTIVE_FOR_NEW_CAMPAIGNS.
- [ ] Preserve old campaign receipts as historical evidence. Do not relabel old presence-based review as accepted semantic review. A campaign upgraded by explicit typed migration gets a new generation/rebind and reruns affected inventory/discovery/baseline work; source-identical reusable evidence remains digest-bound.
- [ ] Define invalidation edges: source/build change invalidates inventory and descendants; inventory change invalidates assignments/reviews/baselines; review change invalidates challenge/reconciliation; property/harness/environment change invalidates affected execution/interpretation; authority policy change invalidates admission as prescribed by migration.
- [ ] A report-only controller refresh uses no compiler, Anvil or simulation. New runtime execution occurs only for missing/stale required evidence or an explicit bound rework request.
- [ ] Use per-campaign concurrency with cancel-in-progress=false, an exact campaign/revision lease and compare-and-swap writes. Separate browser-global serialization must remain intact.
- [ ] For any touched workflow define job and child process timeouts, failure artifact upload, explicit terminal state, bounded retries and guaranteed cleanup. Default controller job limit 20 minutes; each network operation 60 seconds with at most 2 retries; existing longer simulation job limits remain profile-owned. Do not apply a 20-minute controller wrapper to a legitimate longer simulation job.
- [ ] For child runtime execution consume the admitted profile timeout, terminate the process group on expiry, allow 30 seconds cleanup, then force termination and write EXECUTION_FAILED. Missing heartbeat after 120 seconds produces diagnostic output; it must not be mistaken for a successful completion.
- [ ] Ensure generated output commits cannot retrigger their input workflow. No workflow is added merely to run these tests on every main push.
- [ ] Run the bounded changed-component tests plus authority/automation-sync validation on GitHub. Do not restore a broad archived qualification suite or introduce unrelated testing requirements.
- [ ] Deliver the exact code/authority release bindings, test run links, qualification scorecard and admission state. Rollback disables new-policy admission; it does not reinterpret accepted evidence or erase failed attempts.

## Required end-to-end rejection matrix

All rows must be represented in a named test and reported in the release checklist.

| Fixture | Required result |
|---|---|
| 30 contracts, only 2 accepted review sets | Phase 4 blocked; missing 28 visible |
| Internal/private helper omitted | Inventory incomplete; discovery not admitted |
| All expected record keys plus boilerplate | Present count only; accepted remains zero |
| A and B use same chat/project memory | Independence not verified; holdout invalid |
| B accesses A conclusions before seal | Contamination recorded; no blind credit |
| Cross-contract edge lacks integration review | Phase 4 blocked |
| Zero candidates, applicable fee/auth properties | Baseline checks still required |
| Baseline NOT_APPLICABLE because harness missing | Rejected |
| Test exits zero but expected assertion absent | Execution incomplete; gate blocked |
| Required guard check hits unrelated setup revert | Rejected |
| Property fails with valid evidence | Execution complete; clean verdict blocked |
| Candidate not reproduced once | Candidate remains open until adequate adjudication |
| Old digest/session/assignment resubmission | Rejected; live state unchanged |
| Exact duplicate accepted event | Idempotent; no duplicate wake/receipt |
| Partial controller/authority deployment | New-policy admission blocked |
| Clean control falsely reported Critical/High | Qualification fails |
| Holdout known from original disclosed table | Regression only; no holdout credit |
| Required evidence unavailable | Explicit blocker; never silent PASS |
| Controller-only revalidation | No simulation launch |
| Frozen source edited to make tests pass | Integrity failure |

## Ready-to-use implementation handoff

Read 00_BUILD_CONTRACT_v1.md, then execute Tasks 1–10 in order across the three companions. Before editing, pin current repository/authority revisions and record any moved integration target; do not silently implement against stale paths. Existing runtime paths listed in the plans were inspected, while proposed new module paths are marked Create.

For each task:
1. Read only relevant owner instructions and existing implementation.
2. Add the named failing fixtures and verify failure in GitHub.
3. Implement the specified interfaces and state behavior.
4. Run the bounded tests in GitHub and inspect every result.
5. Commit the completed unit and return its commit/run links immediately.
6. Persist exact next task and blocking evidence, then continue executable work.

Do not restart sealed/completed tasks, add a new orchestration platform, impose word-count quotas, publish answer keys, count generic rows as security analysis, or weaken qualification after failure. Missing owner-controlled holdouts blocks qualification; finish all other implementation and deliver it as INSTALLED_UNQUALIFIED.

## Recommendation-to-task map

| Original recommendation | Task coverage |
|---|---|
| Trace all missed defects to first failure | 1, 8–9 |
| Explicit bounded source assignments and integration | 2–3, 5 |
| Source-specific reasoning behind no issue | 4–5 |
| Candidate-independent baseline checks | 6–7 |
| Independent second discovery pass | 3, 5, 8–9 |
| Fresh blind qualification before restored confidence | 8–10 |

Planning is complete when these documents are committed and verified. Implementation is complete only when Tasks 1–10 have their own evidence; installation may finish without qualification only with the explicit blocked admission state above.
