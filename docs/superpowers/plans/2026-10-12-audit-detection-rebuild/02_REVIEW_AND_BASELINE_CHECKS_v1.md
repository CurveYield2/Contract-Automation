# Substantive Review and Baseline Checks v1 — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Execute sequentially and commit each independently verified task.

**Goal:** Require source-specific challenged review and meaningful baseline property evidence even when discovery reports no candidates.
**Architecture:** Add discovery subassignments inside Phase 4, preserve Phase 5 economic work and candidate execution, and add separately identified baseline property obligations. Keep the existing master and controller as integration owners.
**Tech Stack:** Existing Node.js ESM controller, JSON schemas, current GitHub execution adapters and browser wake path.
**Spec:** 00_BUILD_CONTRACT_v1.md and accepted Stage 2 outputs from 01_BASELINE_AND_INVENTORY_v1.md.

## Global constraints

Never equate schema conformance with semantic correctness. Never call a random unsuccessful run a proof of safety. The independent pass is a separate fresh session, not a second response in the first reviewer's chat. No concurrent browser manipulation. Preserve the existing controller's transactional staging and end-of-phase receipt ownership. Required runtime checks are isolated defensive assertions; this change does not create an autonomous offensive workflow.

## Review focus

- Source-specific but wrong reasoning: Task 4 requires explicit challenger adjudication.
- Session reuse or premature visibility of conclusions: Task 5 blocks independence claims.
- Subassignment retry mistaken for phase completion: Task 5 separates statuses.
- Zero candidates and all-N/A baseline matrices: Task 6 derives obligations independently.
- Setup success without reached assertions: Task 7 refuses execution credit.

## Stage 3 / Task 4 — Review evidence and challenge contract

**Files**
- Create scripts/lib/lite-review-evidence-v1.mjs.
- Create scripts/tests/lite-review-evidence-v1.test.mjs.
- Create protocol/schemas/curveyield-source-review-v1.schema.json.
- Create protocol/schemas/curveyield-review-challenge-v1.schema.json.
- Modify scripts/lib/lite-phase-work-v1.mjs to invoke the new validator for the new policy only.
- Modify scripts/lib/lite-phase-prefill-v1.mjs so phase4CoverageFromForm no longer labels present rows completed under the new policy.

**Interfaces**
validateSourceReviewV1({assignment, inventory, submission}) -> common validator result.
validateReviewChallengeV1({assignment, acceptedSubmissionDigest, challenge}) -> common validator result.
computeReviewCoverageV1({inventory, assignmentPlan, acceptedSubmissions, acceptedChallenges}) -> {required,present,structurallyValid,challenged,accepted,missingContextIds,rejectedContextIds}.
All counts count unique required context IDs, never raw rows. Unknown/extra rows are errors, not coverage.

submission payload = {assignmentId,lane,attempt,rows}.
row = {contextId,sourceAnchors,observedBehavior,requirements,securityChecks,disposition,candidateRefs,limitations}.
observedBehavior = {inputs,reads,writes,externalInteractions,returnAndRevertBehavior}; each member is an array of {description,anchorRefs}. Empty array is allowed only when actual source has no such operation; explanatory absence is captured by securityChecks.
requirements = [{requirementId,relationship,anchorRefs}]; relationship IMPLEMENTS|DEPENDS_ON|CONTRADICTS|UNSPECIFIED.
securityChecks = [{class,applicability,reason,anchorRefs,enforcement,assumptions,assessment}].
class = AUTHORIZATION|STATE_TRANSITION|ACCOUNTING|EXTERNAL_TRUST|FAILURE_HANDLING|REENTRANCY|ALLOWANCE|ORDERING|LIFECYCLE|DOMAIN_PROPERTY.
applicability = REQUIRED|NOT_APPLICABLE. assessment = SUPPORTED|CONCERN|UNRESOLVED|NOT_APPLICABLE.
enforcement = {mechanism,anchorRefs}; NOT_APPLICABLE uses null enforcement plus source-grounded reason.
disposition = REVIEWED_SUPPORTED|CANDIDATE_CREATED|BLOCKED.
candidateRefs and limitations use existing campaign candidate/limitation IDs. A candidate is not a confirmed vulnerability.

challenge payload = {assignmentId,submissionDigest,challengerSessionIdentity,rows}.
challenge row = {contextId,decision,checkedAnchorRefs,reason,counterargument,obligationRefs}.
decision = ACCEPT|REWORK|UNRESOLVED. A challenge cannot be self-authored by the submission session. Each row needs a source-specific counterargument considered and why it succeeds or fails.

- [ ] Write negative fixtures: exact expected recordKey with generic "safe" prose; wrong source digest; invalid excerpt digest; duplicate context; extra context; invented requirement; empty mandatory security check; copied rationale with incorrect source anchors; ACCEPT by the submitting session.
- [ ] Verify each fails with a stable error code: REVIEW_GENERIC_UNSUPPORTED, SOURCE_BINDING_MISMATCH, ANCHOR_MISMATCH, DUPLICATE_CONTEXT, EXTRA_CONTEXT, REQUIREMENT_UNKNOWN, CHECK_MISSING, EVIDENCE_NOT_BOUND, SELF_CHALLENGE.
- [ ] Implement structural checks and controller-derived required classes. Every context gets authorization/state/interaction/accounting/lifecycle applicability consideration; domain classes come from accepted domain applicability plus reviewer additions. Never infer authorization solely from the presence or name of a modifier.
- [ ] For AUTHORIZATION require the actual enforcement expression or called guard anchor, permitted actors and each reachable entry path. "onlyOwner exists elsewhere" does not support this context.
- [ ] For ACCOUNTING require units for each term, conversion scale, bound/rounding direction and an independently stated expected relation. A copied expression from implementation is not an independent reference.
- [ ] For EXTERNAL_TRUST/FAILURE_HANDLING require trust assumption, returned-value treatment, balance/receipt verification where relevant, failure branch and effects on local state.
- [ ] For STATE_TRANSITION/LIFECYCLE require pre-state, authorized transition, post-state, pending state and cancellation/reinitialization treatment.
- [ ] Detect repeated normalized rationale and unbound/generic fields as rework signals. Do not impose word-count quotas or treat unique wording as evidence of correctness. Automated checks only establish reviewability; challenged ACCEPT establishes a human/agent judgment with attribution.
- [ ] Preserve UNRESOLVED as a blocking review result. REVIEWED_SUPPORTED requires all required checks supported and no unresolved limitation. CANDIDATE_CREATED permits review completion but leaves the candidate in the downstream unresolved-candidate ledger.
- [ ] Change coverage output to report present, structurallyValid, challenged and accepted separately. accepted requires exact source binding, structural validation, ACCEPT challenge and zero unresolved row-level review obligations. The presence-only count remains diagnostic only.
- [ ] Run node --test scripts/tests/lite-review-evidence-v1.test.mjs on GitHub. Add integration assertion that 30 present rows with only two accepted rows produces accepted=2, never 30.
- [ ] Commit and deliver rejection examples plus accepted source-specific fixture. Do not claim the validator can mechanically prove prose true.

## Stage 3 / Task 5 — Independent discovery and integration routing

**Files**
- Create scripts/lib/lite-discovery-state-v1.mjs.
- Create scripts/tests/lite-discovery-state-v1.test.mjs.
- Modify scripts/lite-phase-packet-controller-v1.mjs.
- Modify scripts/prepare-lite-assignment-successor-v2.mjs.
- Modify scripts/lib/lite-master-review-v1.mjs.
- Modify .github/workflows/lite-phase-work-packet-controller-v1.yml and .github/workflows/lite-audit-browser-orchestrator-v1.yml only where required to transport discoveryAssignment.
- Extend packages/github-native-sim/test/lite-phase-packet-controller-integration-v1.test.mjs and packages/github-native-sim/test/lite-assignment-successor-v1.test.mjs.

**Interface**
advanceDiscoveryV1({state,event,artifacts,expectedRevision}) -> {state,effects,errors}.
state = {revision,policyVersion,phaseSequence:4,discoveryRunId,sourceDigest,inventoryDigest,assignmentPlanDigest,status,activeAssignmentId,acceptedA,acceptedB,integrationSeal:null|ref}.
status = READY_A|REVIEWING_A|SEALED_A|READY_B|REVIEWING_B|SEALED_B|RECONCILING|INTEGRATING|READY_PHASE4_SEAL|BLOCKED.
Events: START_ASSIGNMENT, SUBMIT_REVIEW, ACCEPT_REVIEW, REJECT_REVIEW, SEAL_LANE, START_RECONCILIATION, ACCEPT_INTEGRATION.
Each event has immutable eventId, expectedRevision and authenticated actor/session binding. Effects are existing controller operation intents; agents never perform their own state transition writes.

- [ ] Write state tests before wiring browser actions: B submission before B assignment; reused A/B chat; different campaign generation; stale revision; duplicate identical event; duplicate eventId with different bytes; phase advance while any assignment incomplete.
- [ ] Implement serialized A assignments then serialized B assignments. One active assignment at a time. Reviewer-2 may retain legacy ownership of the phase while discoveryAssignment identifies the actual fresh session and lane. Never broaden assignmentReviewer to accept arbitrary role strings.
- [ ] Persist session identity and captured chat URL with controller wake acknowledgment. Different reviewer labels in one chat fail the fresh-session requirement.
- [ ] A and B receive identical source, neutral requirements/specification and topology. B receives no A review text, findings, candidate list, challenge report or candidate-derived tests before sealing. If upstream hypotheses contain prior discovery conclusions, prepare a neutral input projection without removing source requirements.
- [ ] Define the isolation boundary honestly: private packet separation prevents normal delivery leakage but cannot prove the reviewer never accessed shared repository/project memory. If using the same ChatGPT Project with shared conclusions/memory, do not claim blinded independence. For new-policy campaigns use separate isolated discovery sessions/Projects with shared memory disabled where verifiable; otherwise mark independence UNVERIFIED and block qualification credit. Preserve the proven browser interactions; do not rewrite browser primitives.
- [ ] Seal each lane's immutable submissions before reconciliation. Any pre-seal exposure of the other lane's output records CONTAMINATED and requires fresh isolated discovery; it is not repaired by changing a label.
- [ ] After both seals, reconcile the UNION of candidate IDs and unresolved checks. Deduplicate only with source-root-cause/property equivalence and preserved original IDs. Majority vote cannot dismiss a concern.
- [ ] Create INTEGRATION assignments from Stage 2 integration obligations. Require {obligationId,sourceContexts,sharedInvariant,assumptions,observedComposition,challenge,disposition,candidateRefs}. Every obligation must be source reviewed and challenged. A per-contract pass does not satisfy cross-contract composition.
- [ ] The master challenges every required review context against source, either directly or through an explicitly designated fresh challenger. No percentage sampling may be called full challenge. A and B disagreement creates a resolution obligation; disagreement cannot disappear through report summarization.
- [ ] Subassignment ACCEPT persists work and advances to the next assignment WITHOUT sealing Phase 4 or repeating earlier phase bookkeeping. Only READY_PHASE4_SEAL permits the existing end-of-phase seal and Phase 5 preparation.
- [ ] Use compare-and-swap revision writes and existing staged transaction pattern. Identical retries are idempotent; stale or conflicting retries return a precise error and leave live state unchanged.
- [ ] Keep wake acknowledgment separate from work acceptance. A successful wake never closes an assignment.
- [ ] Run state tests and the two named integration test files on GitHub; verify no actual browser launch is needed for fixtures.
- [ ] Commit and deliver a synthetic 30-contract campaign state trace: A complete -> B complete -> reconciliation -> integration -> Phase 4 seal. Also deliver the trace where contract 30 remains incomplete and Phase 4 is held.

## Stage 4 / Task 6 — Candidate-independent baseline obligations

**Files**
- Create scripts/lib/lite-baseline-obligations-v1.mjs.
- Create scripts/tests/lite-baseline-obligations-v1.test.mjs.
- Create protocol/schemas/curveyield-baseline-obligations-v1.schema.json.
- Modify scripts/lib/lite-phase-prefill-v1.mjs and scripts/lite-phase-packet-controller-v1.mjs.
- Campaign artifact: work/phase-05/BASELINE_SECURITY_OBLIGATIONS_v1.json.

**Interface**
deriveBaselineObligationsV1({identity,inventory,requirements,topology,domainApplicability}) -> envelope with schemaVersion "curveyield-baseline-obligations-v1".
An obligation is {obligationId,class,contextIds,property,applicability,applicabilityEvidenceRefs,requiredEvidenceMode,independentReference,adjudicationRef}.
requiredEvidenceMode = SOURCE_AND_RUNTIME|SOURCE_ONLY.
applicability = REQUIRED|PROPOSED_NOT_APPLICABLE|ACCEPTED_NOT_APPLICABLE.
No candidate array is an input to this function.

| Baseline class | Trigger requiring consideration | Secure property to specify |
|---|---|---|
| AUTHORIZATION | State/value/configuration writes or privileged reads | Only intended actor set can cause protected effect |
| ROLE_LIFECYCLE | Ownership, controller, pending roles, initialization or upgrade state | Intended transition and pending-state clearing hold |
| ACCOUNTING_UNITS_BOUNDS | Fees, caps, shares, debts, reward/conversion arithmetic | Units and independently specified bounds/conservation hold |
| EXTERNAL_INPUT_TRUST | Token/router/pool/dependency addresses or returned amounts | Required identity and return/receipt validation holds |
| FAILURE_HANDLING | External calls or oracle/conversion failure branches | Failure preserves the specified safe state |
| CALLBACK_STATE | Callback-capable interactions with mutable state | Required state/authorization invariants survive permitted callbacks |
| ALLOWANCE_LIFECYCLE | Approval/permit creation or use | Scope, spender and cleanup follow the accepted requirement |
| IDENTITY_ORDERING | Pair/route/key encoding or order-sensitive lookup | Distinct intended identities remain distinct |
| DOMAIN_PROPERTY | Activated domain requirements | Explicit domain invariant is covered |

- [ ] Write a zero-candidate fixture containing authorization, fee and approval surfaces. Assert REQUIRED obligations for all three with candidateCount absent from generator inputs.
- [ ] Derive applicability from syntax/requirements/topology plus reviewer semantic correction. Machine trigger absence does not automatically prove NOT_APPLICABLE; unresolved trigger classification requires review.
- [ ] Require NOT_APPLICABLE proposals to name source anchors, absent prerequisite and why the property cannot apply. A separate challenger accepts the proposal. Missing harness, unsupported adapter, timeout, zero findings or inconvenience are forbidden reasons.
- [ ] Default REQUIRED to SOURCE_AND_RUNTIME. SOURCE_ONLY requires a documented impossibility/non-executable declaration reason accepted by the challenger; state-changing applicable properties cannot use it merely to avoid authoring checks.
- [ ] independentReference names the accepted requirement or independent mathematical/state model; it cannot simply mirror the implementation.
- [ ] Keep baseline obligation IDs separate from candidate IDs. Extend adapter request binding with targetKind=BASELINE_PROPERTY|CANDIDATE and targetId; do not create fake candidates to satisfy existing schemas.
- [ ] Union baseline obligations with existing candidate-specific requirements at the Phase 5 gate. Neither replaces the other. Reuse existing raw evidence only when all identity, property, prerequisite and assertion bindings match.
- [ ] Run node --test scripts/tests/lite-baseline-obligations-v1.test.mjs on GitHub; commit and deliver a zero-candidate baseline matrix.

## Stage 4 / Task 7 — Assertion reachability and execution completeness

**Files**
- Create scripts/lib/lite-baseline-execution-evidence-v1.mjs.
- Create scripts/tests/lite-baseline-execution-evidence-v1.test.mjs.
- Modify scripts/lite-phase-packet-controller-v1.mjs.
- Extend packages/github-native-sim/test/lite-phase5-execution-gate-v1.test.mjs.
- Identify the existing adapter producer from the bound request before editing it; record its exact path/export in the implementation checkpoint. Do not guess a new runner or create a competing workflow.

**Interface**
validateBaselineExecutionV1({obligation,request,harnessBinding,result,rawEvidence}) -> common validator result.
result is producer-authored and source-bound:
{targetKind:"BASELINE_PROPERTY",targetId,requestDigest,harnessDigest,sourceDigest,buildDigest,environmentIdentity,setupStatus,prerequisitesObserved,expectedAssertionIds,reachedAssertionIds,assertionOutcomes,positiveControl,negativeControl,terminalStatus,rawEvidenceRefs}.
terminalStatus = PASSED|PROPERTY_FAILED|INCONCLUSIVE|EXECUTION_FAILED|NOT_RUN.
assertionOutcomes = [{assertionId,outcome:"PASS"|"FAIL",observationRef}].
positiveControl = {status:"PASS"|"FAIL"|"NOT_RUN",evidenceRef}; it proves the intended allowed path reaches the relevant state.
negativeControl validates detection using a local synthetic observation/test-double with an intentionally violated property; it never alters frozen source and is not an exploit script.
environmentIdentity uses existing chain/block/profile binding where runtime state is relevant.

- [ ] Write fixtures: setup reverts; no reached assertions; missing expected assertion; fabricated result without raw observation; positive control fails; negative control detector does not flag invalid observation; source/request/harness digest mismatch; valid completed check; actual property failure.
- [ ] Assert every invalid fixture blocks. A real PROPERTY_FAILED result is valid execution evidence but prevents a clean security conclusion and creates/links a concern for adjudication.
- [ ] Require exact equality of expectedAssertionIds and observed required assertions; duplicates are errors. An unexpected permission/setup revert before the property is not a passing denial check.
- [ ] For an intended rejection check, require the intended guard/error and unchanged protected state, with a successful permitted-path control establishing valid setup.
- [ ] Capture runner-authored raw evidence; reviewer-provided result JSON without verified producer binding is rejected.
- [ ] Keep inconclusive results blocking. A completed negative test establishes only that property under its recorded conditions; never close broader concerns using NOT_REPRODUCED alone.
- [ ] Reuse an existing accepted result only if source/build/harness/request/environment/property/input bounds and assertion identities all match. Controller revalidation must not start Anvil merely to recompute forms or hashes.
- [ ] Preserve existing targeted candidate execution and master targeted-test request facilities. Extend their target binding narrowly where needed; do not invent a generalized remote command executor.
- [ ] Run the named unit and Phase 5 integration tests on GitHub. Deliver a zero-candidate campaign held for missing baseline evidence and the same fixture advancing after all required observations exist.

## Authority integration required before activation

In Audit-Controller's resolved current authority update, as one coordinated release:
- Phase 4 schema/template/START_HERE: discovery assignment refs, two sealed independent passes, source/challenge semantics and integration obligations.
- Phase 5 schema/template/START_HERE: baseline obligation refs alongside existing economic and candidate-targeted work.
- Master START_HERE: source-specific challenge, dispute ownership, rework/test requests and no unsupported concern closure.
- Shared controller/receipt policy: subassignment acceptance is not a phase receipt; end-of-phase bookkeeping remains once.
- Routing/model table: independent discovery session ownership is explicit; do not claim existing reviewer-2 alone is independent.
- Current authority manifest/package and automation-sync checks must agree. Do not directly overwrite a frozen campaign authority.

This is a methodology change. Stage 5 governs release admission. Existing campaigns retain their admitted policy until typed migration. Ship producer, schemas, validator, reporting and routing together behind the new policy gate; partial wiring must fail closed.
