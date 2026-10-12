# Audit Detection Rebuild v2 — T4–T7: Discovery Lanes, Challenge, Baseline Obligations and AI-Guided Phase 6 Testing

> **For the implementing agent:** `00_BUILD_CONTRACT_v2.md` applies in full. T0–T3 must be merged first. Every behavior added here runs only when `detectionPolicyForAuthorityV1(...)` returns `'audit-detection-rebuild-v1'` for the campaign's bound authority (D7). Every task must add an old-path test proving a v11-bound campaign behaves exactly as before.

Supersedes `02_REVIEW_AND_BASELINE_CHECKS_v1.md` (removed; Git history keeps it).

## Shared definitions for T4–T7

**Assignment packet**, written by the controller at `work/phase-04/discovery/<assignmentId>/ASSIGNMENT_PACKET_v1.json`. Header per 00 §7.1, `schemaVersion: "curveyield-discovery-assignment-packet-v1"`, payload:

```
{
  assignmentId, role: "LANE_A" | "LANE_B" | "CHALLENGE" | "INTEGRATION",
  contexts: [ {contextId, path, contract, kind, signature, lineStart, lineEnd, effectiveIn,
               requiredClasses: [classId], reviewChecks: {<classId>: [string]},
               dependencyRanges: [{symbolId, path, lineStart, lineEnd}], triggers: [key], guardRow: <facts row or null>} ],
  obligations: [ <integration obligation objects> ],
  inputs: { requirementsPaths: [..], hypothesesPaths: [..], protectedAssetsPaths: [..] },
  priorSubmissions: { laneA: {path, sha256} | null, laneB: {path, sha256} | null },
  submissionPath: "work/phase-04/discovery/<assignmentId>/SUBMISSION_v1.json",
  instructionsPath: "<bound authority root>/discovery/<ROLE>_START_HERE.md",
  boundaryRequestPath: "process/agent-upload/lite-phase-boundary/<campaignId>-discovery.json",
  maxValidationAttempts: 3
}
```

- `contexts` is filled for LANE_A, LANE_B and CHALLENGE. `obligations` is filled for INTEGRATION only.
- **Lane A** inputs: Phase 2 requirements, Phase 3 hypotheses and Phase 1 protected assets. Use the derived Phase 2/3/1 canonical files: `derived/phase-2/PHASE_02_CANONICAL_DATA_v1.json`, `derived/phase-3/PHASE_03_CANONICAL_DATA_v1.json` and `derived/phase-1/PHASE_01_CANONICAL_DATA_v1.json`.
- **Lane B** inputs: only Phase 1 protected assets and Phase 2 requirements. **Never** Phase 3 hypotheses, never lane A material, never candidates.
- **CHALLENGE** inputs: lane A + lane B inputs plus `priorSubmissions`.
- **INTEGRATION** inputs: same as CHALLENGE.

**Lane submission** (`SUBMISSION_v1.json`, written by the lane chat). The reviewer updates the same file in place on each attempt:

```json
{
  "schemaVersion": "curveyield-discovery-lane-submission-v1",
  "assignmentId": "A-001",
  "rows": [
    {
      "contextId": "CTX-…",
      "summary": "<what this code does, in the reviewer's words>",
      "checks": [
        {"classId": "ACCESS_CONTROL", "applicability": "REQUIRED", "assessment": "SUPPORTED",
         "evidence": "<source-specific reasoning naming the guard/expression and actors>",
         "anchors": ["contracts/Foo.sol:L40-L44"]}
      ],
      "candidates": [
        {"title": "<short>", "classId": "ACCESS_CONTROL", "description": "<what is wrong and who can exploit it>", "anchors": ["contracts/Foo.sol:L41"]}
      ]
    }
  ]
}
```

- `applicability` ∈ {`REQUIRED`, `NOT_APPLICABLE`}.
- `assessment` ∈ {`SUPPORTED`, `CONCERN`, `UNRESOLVED`, `NOT_APPLICABLE`}. `NOT_APPLICABLE` is allowed only with applicability `NOT_APPLICABLE`.

**Challenge submission:**

```json
{
  "schemaVersion": "curveyield-discovery-challenge-submission-v1",
  "assignmentId": "C-001",
  "rows": [
    {"contextId": "CTX-…", "decision": "ACCEPT", "laneComparison": "AGREE",
     "reason": "<why both analyses are right, or what is wrong>", "anchors": ["contracts/Foo.sol:L40"],
     "classDecisions": [{"classId": "ACCESS_CONTROL", "decision": "ACCEPT", "reason": "<…>"}]}
  ]
}
```

- `decision` ∈ {`ACCEPT`, `DISPUTE`}.
- `laneComparison` ∈ {`AGREE`, `DISAGREE`, `SINGLE_LANE`}.

**Integration submission:**

```json
{
  "schemaVersion": "curveyield-discovery-integration-submission-v1",
  "assignmentId": "I-001",
  "rows": [
    {"obligationId": "IOB-0001", "assessment": "SUPPORTED", "reasoning": "<…>", "anchors": ["contracts/A.sol:L10-L30"], "candidates": []}
  ]
}
```

---

## T4 — Discovery validators

**Goal:** deterministic structural validation of lane, challenge and integration submissions. Validation checks reviewability and source binding only. It does not and cannot certify that the reasoning is true; the challenger and master do that.

**Read first:** 00 §7.2 and §7.4, T1 taxonomy, T3 plan.

### T4.1 Create `packages/github-native-sim/src/adr-discovery-validators-v1.mjs`

It exports the following.

**`parseAnchorV1(text)`** returns `{path, lineStart, lineEnd} | null`.
- Accepted formats: `<path>:L<n>` and `<path>:L<a>-L<b>`, with `a ≤ b`.
- `path` must be relative, POSIX, with no `..`.

**`validateLaneSubmissionV1({packet, submission})`.** Error codes:
- `SUBMISSION_SCHEMA`: wrong `schemaVersion`, missing `rows` or a non-array field.
- `ASSIGNMENT_MISMATCH`.
- `MISSING_CONTEXT`, `EXTRA_CONTEXT`, `DUPLICATE_CONTEXT`.
- `SUMMARY_EMPTY`: `summary` is blank after trim.
- `CHECK_MISSING`: a `requiredClasses` entry has no check.
- `CHECK_UNKNOWN_CLASS`.
- `CHECK_DUPLICATE`.
- `EVIDENCE_EMPTY`: `evidence` is blank after trim, or equals any of `"N/A"`, `"none"`, `"safe"`, `"no issue"`, `"reviewed"` (case-insensitive).
- `ANCHOR_INVALID`: unparseable.
- `ANCHOR_OUT_OF_RANGE`: the anchor's file and line range is not inside the context's `[lineStart,lineEnd]` in `path`, and not inside any of its `dependencyRanges`.
- `ANCHOR_REQUIRED`: a check with assessment `SUPPORTED`, `CONCERN` or `NOT_APPLICABLE` has zero anchors.
- `NA_MISMATCH`: applicability `NOT_APPLICABLE` with an assessment other than `NOT_APPLICABLE`, or the reverse.
- `CONCERN_WITHOUT_CANDIDATE`: an assessment of `CONCERN` with no candidate of the same `classId` in that row.
- `CANDIDATE_INVALID`: blank title or description, or zero anchors.
- `REPEATED_EVIDENCE`: the same `evidence` text, lower-cased with whitespace collapsed (digits kept), used in more than 3 checks across **different** contexts in one submission. The error message lists the contexts. This is the boilerplate signal.

There is no word-count rule. Do not add one.

**`validateChallengeSubmissionV1({packet, submission, laneA, laneB})`.** `laneA`/`laneB` are the accepted lane submissions, or `null` when that lane ended as a gap. Error codes:
- `SUBMISSION_SCHEMA`, `ASSIGNMENT_MISMATCH`, `MISSING_CONTEXT`, `EXTRA_CONTEXT`, `DUPLICATE_CONTEXT`.
- `REASON_EMPTY`: blank `reason`.
- `DISPUTE_WITHOUT_ANCHOR`.
- `LANE_COMPARISON_WRONG`. The controller computes the expected value:
  - `SINGLE_LANE` if exactly one lane exists;
  - `DISAGREE` if both exist and, for any class, the two assessments differ;
  - otherwise `AGREE`.
- `CLASS_DECISION_MISSING`: a `classDecisions` entry is required for every class where either lane said `NOT_APPLICABLE` or the two lanes' assessments differ.
- `CLASS_DECISION_UNKNOWN`.

**`validateIntegrationSubmissionV1({packet, submission})`.** Error codes:
- `SUBMISSION_SCHEMA`, `ASSIGNMENT_MISMATCH`.
- `MISSING_OBLIGATION`, `EXTRA_OBLIGATION`, `DUPLICATE_OBLIGATION`.
- `REASONING_EMPTY`.
- `ANCHOR_REQUIRED`: zero anchors.
- `ANCHOR_INVALID`.
- `ANCHOR_OUT_OF_SCOPE`: the anchor file is not one of the files of the obligation's `contexts`/`contracts`.
- `CONCERN_WITHOUT_CANDIDATE`.

**`feedbackTextV1(result, {attempt, maxAttempts, submissionPath})`.** Plain text:
- line 1: `"Discovery submission <id> attempt <attempt>/<max> failed validation."`;
- then one line per error: `"- <code> at <path>: <message>"`, at most 60 lines, then `"- … <n> more"`;
- then `"Repair only these items in <submissionPath>, then push the boundary request again with attempt incremented."`

### T4.2 Tests: `packages/github-native-sim/test/adr-discovery-validators-v1.test.mjs`

One test per error code listed above, at least one failing case each. Also:
- a fully valid lane submission;
- a valid challenge for `AGREE`, `DISAGREE` and `SINGLE_LANE`;
- a valid integration submission;
- an anchor inside a dependency range accepted;
- an anchor one line outside rejected;
- a submission with the same evidence text in 4 different contexts gives `REPEATED_EVIDENCE`;
- the same text 4 times inside **one** context is not flagged;
- validators never throw on a `null` submission (they return `SUBMISSION_SCHEMA`).

**Done when:** green in the T0 workflow.

---

## T5 — Discovery routing (controller, workflow, initialization, wake messages)

**Goal:** after Phase 3 passes on a v12 campaign:
1. The controller runs lane A assignments, then lane B, then challenges, then integration, one at a time, each in its registered chat.
2. Each submission is validated, with at most 3 attempts.
3. It produces the discovery summary and then activates reviewer-2 for Phase 4.

Nothing in this task may block a campaign permanently (N1–N3).

**Read first:**
- `scripts/lite-phase-packet-controller-v1.mjs`: search `const reviewKind=a['review-kind']`, `if(reviewKind==='master'){`, `const nextReviewer=assignmentReviewer(nextSequence);`, `function isFreshBoundary`, and the final `process.stdout.write(JSON.stringify({status:'PASS'`.
- `scripts/lib/lite-phase-prefill-v1.mjs`: search `export function applyPhaseBoundaryPrefill`, `function sourceReviewScaffold`, `export function phase4CoverageFromForm`, `export function validatePhaseScaffold`.
- `scripts/lib/lite-phase-work-v1.mjs`: search `export function preparePhaseWork`.
- `.github/workflows/lite-phase-work-packet-controller-v1.yml` (whole file).
- `.github/workflows/audit-source-initialization-v1.yml` and `scripts/audit-source-initialization/run-v1.sh`.
- `.github/workflows/browser-agent-watchdog.yml`: search `expectedMilestoneId` to learn how the watchdog gate decides a chat is still on task.
- `packages/github-native-sim/test/lite-phase-packet-controller-integration-v1.test.mjs`: how it builds a temporary Audit-Controller tree and authority.

### T5.1 Create `packages/github-native-sim/src/adr-discovery-v1.mjs`

It exports the following.

**`startDiscoveryV1({root, campaignPath, directory, authorityRoot, now})`**
- Reads `evidence/review-inventory/ASSIGNMENT_PLAN_v1.json`, `REVIEW_INVENTORY_v1.json` and `SYSTEM_FACTS_v1.json`, plus the taxonomy (`loadTaxonomyV1` on the Contract-Automation checkout root).
- Builds `order` = all `A-*` ids, then all `B-*`, then all `C-*`, then all `I-*`, each in numeric order.
- Writes `work/phase-04/discovery/DISCOVERY_STATE_v1.json` (header 00 §7.1, `schemaVersion: "curveyield-discovery-state-v1"`) with payload `{status:"RUNNING", order, activeAssignmentId: order[0], assignments: {<id>: {role, status:"PENDING", attempts:0, lastValidatedSubmissionSha:null, lastErrors:[], acceptedSubmissionSha:null}}, gaps: <copy of plan.gaps>}`.
- Sets the first assignment's status to `ACTIVE`.
- Writes the first packet with `buildAssignmentPacketV1`.
- If the plan file is missing or has zero assignments, it writes the state with `status:"COMPLETE"` and a gap `{code:"INVENTORY_INCOMPLETE", detail:"No assignment plan"}`, and returns `{completeImmediately:true}`. It never throws for missing files.
- Returns `{activeAssignmentId, role, packetPath}` or `{completeImmediately:true}`.

**`buildAssignmentPacketV1({root, campaignPath, directory, authorityRoot, plan, inventory, facts, taxonomy, assignmentId, state})`**
- Writes the packet described in the shared definitions.
- `requiredClasses` = `classesForTriggersV1(taxonomy, inventory.payload.triggers[contextId])`.
- `reviewChecks` copies each class's `reviewChecks`.
- `dependencyRanges` = the `dependencySymbolIds` of the context mapped to declarations.
- For `C-k`, `priorSubmissions` points at `work/phase-04/discovery/A-k/ACCEPTED_SUBMISSION_v1.json` and `.../B-k/ACCEPTED_SUBMISSION_v1.json`, each set to `null` if that lane ended as a gap.
- For `I-k` it includes the obligations listed for that assignment.
- `instructionsPath` uses `LANE_A_START_HERE.md`, `LANE_B_START_HERE.md`, `CHALLENGER_START_HERE.md` or `INTEGRATION_START_HERE.md` under `<authorityRoot>/discovery/` (files authored in T8).

**`advanceDiscoveryV1({root, campaignPath, directory, authorityRoot, assignmentId, now})`** returns `{status, feedbackText, wake}`. Exact algorithm:
1. Load the state. If `assignmentId !== state.payload.activeAssignmentId`, return `{status:"DISCOVERY_STALE_REQUEST", feedbackText:"Assignment <id> is not active; active is <active>. No action taken.", wake:null}`. This is not an error and is not published.
2. Read `submissionPath`. If it is missing, return `DISCOVERY_REWORK` with the feedback `"Submission file not found at <path>. Write it, then push the boundary request again."`. Do not increase `attempts`.
3. `sha = sha256(bytes)`. If `sha === lastValidatedSubmissionSha`, return `DISCOVERY_REWORK` with the stored `lastErrors` feedback and do not increase `attempts` (idempotent).
4. Parse the JSON. A parse failure counts as one failed attempt with error `SUBMISSION_SCHEMA`. Otherwise validate with the T4 validator for the role (challenge: pass the accepted A/B submissions or `null`).
5. On failure:
   - `attempts += 1`; store `lastValidatedSubmissionSha` and `lastErrors`.
   - If `attempts < 3`, return `DISCOVERY_REWORK` with `feedbackTextV1(...)` and `wake` for the same chat.
   - If `attempts >= 3`, set the assignment status to `GAP_RECORDED`, push one gap per context (or obligation) with `code:"VALIDATION_ATTEMPTS_EXHAUSTED", assignmentId`, then go to step 7.
6. On success: copy the submission bytes to `.../<id>/ACCEPTED_SUBMISSION_v1.json`, set the status to `ACCEPTED`, store `acceptedSubmissionSha`, then go to step 7.
7. **Advance:**
   - Take the next id in `order`.
   - If it is `C-k` and **both** `A-k` and `B-k` are `GAP_RECORDED`, mark `C-k` as `GAP_RECORDED` without waking anyone (its contexts are already gaps) and continue to the next id.
   - If a next id exists: set it to `ACTIVE`, write its packet, set `activeAssignmentId`, and return `DISCOVERY_NEXT` with `wake` for that role's chat.
   - If none remains: set `status:"COMPLETE"` and `activeAssignmentId:null`; write the summary (`buildDiscoverySummaryV1`); call T6 `deriveBaselineObligationsV1` and write `work/phase-06/BASELINE_OBLIGATIONS_v1.json`; return `DISCOVERY_COMPLETE` with `wake` for reviewer-2.
8. **Wake object:** `{chatKey: "laneA" | "laneB" | "challenger" | "reviewer-2", wakeId: "<campaignId>-discovery-<assignmentId>-a<attempts>", phaseId: "phase-4", milestoneId, messageB64}`.
   - Role to chat: A → `laneA`, B → `laneB`, C and I → `challenger`.
   - For lane and challenger wakes, `milestoneId` is `DISCOVERY_<assignmentId>` and the message comes from `discoveryWakeMessageV1`.
   - For the completion wake, `chatKey` is `reviewer-2`, `milestoneId` is `PHASE_4_WORK_PACKET` (the existing Phase 4 gate value) and the message is exactly: `"CONTROLLER: Phase 4 discovery is complete. Phase 4 is now ACTIVE for reviewer-2. Follow phases/phase-4/START_HERE.md of the bound authority. Step 1 reconciles every record prefilled from work/phase-04/discovery/DISCOVERY_SUMMARY_v1.json; then complete Steps 2 and 3 and invoke controller validation as usual."`

**`completeDiscoveryV1({root, campaignPath, directory, authorityRoot, state, now})`**
- Holds the code of step 7's "none remains" branch: summary, baseline obligations, `status:"COMPLETE"`.
- `advanceDiscoveryV1` calls it, and the controller calls it when `startDiscoveryV1` returns `completeImmediately`.
- It returns the completion wake object.

**`buildDiscoverySummaryV1({state, inventory, plan, acceptedSubmissions, taxonomy})`**
- Writes `work/phase-04/discovery/DISCOVERY_SUMMARY_v1.json` (`schemaVersion: "curveyield-discovery-summary-v1"`) with payload `{reconciliationItems, perContext, gaps, coverage}`.
- `reconciliationItems` get keys `DISC-0001`… in this exact order of origins:
  1. `LANE_CANDIDATE`: every candidate from either lane. Deduplicate by `contextId`+`classId`+normalized title; keep both lanes' text.
  2. `LANE_UNRESOLVED`: every check with assessment `UNRESOLVED`.
  3. `DISPUTED_ROW`: every challenge `DISPUTE`, row or class.
  4. `LANE_DISAGREEMENT`: every class where A and B differ and the challenger did not dispute.
  5. `INTEGRATION_CONCERN`: every integration row with `CONCERN` or `UNRESOLVED`.
  6. `COVERAGE_GAP`: every gap.
- Each item is `{recordKey, origin, contextIds, sourceAnchor: "<path>:L<start>-L<end>" of the first context (or "SYSTEM" for integration), laneAFinding, laneBFinding, challengeDecision}`.
  - The finding texts are at most 600 chars, made from the lane's assessments and candidate titles for that context, or `"NO_SUBMISSION"`.
  - `challengeDecision` is `"ACCEPT" | "DISPUTE: <reason ≤300 chars>" | "NO_CHALLENGE"`.
- `coverage` = `buildCoverageMatrixV1({inventory, taxonomy, discoveryState: <derived from accepted submissions and gaps>})`.

**`discoveryWakeMessageV1({directory, auditControllerRef, packetPath, submissionPath, instructionsPath, boundaryRequestPath, assignmentId, role, attempt, feedbackText = null})`** returns plain text. It contains, in this order:
1. role and campaign line;
2. `"Use the GitHub connector app for every repository read and write."`;
3. GitHub blob URLs (same URL style as `scripts/prepare-lite-assignment-successor-v2.mjs`) for the instructions file, the packet and the submission path;
4. the feedback text if present;
5. the exact boundary request JSON to write at `boundaryRequestPath`: `{"schemaVersion":"curveyield-lite-phase-boundary-request-v1","campaignId":"…","reviewKind":"discovery","assignmentId":"…","auditControllerRef":"…","attempt":<n>}`;
6. the sentence `"If no controller response arrives within 30 minutes of pushing the request, push the same request again with attempt increased by 1."`;
7. for role LANE_B, the sentence `"Do not open any file under work/phase-04/discovery/ except your own assignment folder, and do not open work/phase-03/."`.

### T5.2 Controller changes in `scripts/lite-phase-packet-controller-v1.mjs`

1. **Accept the new review kind.** In the list `['phase','master','master-test-result','sealed-rework','post-completion-followup']`, add `'discovery'`. Add argument `--assignment-id`, required when the review kind is `discovery`. Throw `missing --assignment-id` otherwise.
2. **Add a discovery branch** directly before `if(reviewKind==='master'){`, as `if(reviewKind==='discovery'){ … }`. It:
   - refuses (throws `campaign is held by explicit human status`) when `directory.campaignStatus` is `STOPPED_BY_HUMAN` or `BLOCKED`;
   - requires `directory.discovery?.statePath`;
   - calls `advanceDiscoveryV1`;
   - copies the returned `status` into `directory.discovery.status` and `activeAssignmentId`.
   - On `DISCOVERY_COMPLETE` it calls `preparePhaseWork` for sequence 4 with `reviewer:'reviewer-2'`, `status:'ACTIVE'`, the existing predecessor receipt, and `derivedInputPaths` = previous Phase-4 derived inputs plus `work/phase-04/discovery/DISCOVERY_SUMMARY_v1.json`. It then sets `directory.currentAssignment` to the result and `directory.campaignStatus='ACTIVE'`.
   - Writes the directory.
   - Prints one JSON line `{status, feedbackB64, discoveryWakeChatKey, discoveryWakeId, discoveryWakePhaseId, discoveryWakeMilestoneId, discoveryWakeMessageB64, campaignName}` and exits 0. On `DISCOVERY_STALE_REQUEST` it prints the status and exits 0 without writing.
3. **Start discovery at Phase 3 PASS (v12 only).** Find the block that computes `const nextReviewer=assignmentReviewer(nextSequence);` and `nextAssignment=preparePhaseWork({…sequence:nextSequence…})`. Directly after that statement, insert: if `sequence===3` and the policy is active:
   - set `nextAssignment.status='WAITING_FOR_DISCOVERY'` and `directory.campaignStatus='WAITING_FOR_DISCOVERY'`;
   - call `startDiscoveryV1`;
   - set `directory.discovery={statePath:'<campaignPath>/work/phase-04/discovery/DISCOVERY_STATE_v1.json', status:'RUNNING', activeAssignmentId:<first id>}`;
   - remember the start result for the output.
   - If `startDiscoveryV1` returns `completeImmediately`, call `advanceDiscoveryV1`'s completion path through a new exported helper `completeDiscoveryV1(...)` (extract the step-7 completion code into that helper in T5.1) and activate Phase 4 exactly as in item 2.
4. **PASS output.** In the final PASS JSON, add `discoveryStarted:true` and the same `discoveryWake…` fields when discovery started, and force `freshSuccessorRequired:false` and `sameReviewerAdvanced:false`. That way the existing workflow steps do not wake reviewer-2.
5. **Old path untouched.** When the policy is null none of the above runs. Wrap every new block in `if(policy){…}`, where `policy` is computed once near the top from the bound authority: `authorityRootFromReceipt(predecessor)` for phase requests, or the Phase-0 receipt for discovery requests.

### T5.3 Phase 4 prefill and validation changes (`scripts/lib/lite-phase-prefill-v1.mjs`)

1. **Prefill.** In `applyPhaseBoundaryPrefill`, in the Phase 4 branch, when the policy is active and `actions['step-1'].outputs.discoveryReconciliationRecords` exists in the form template (the v12 template; see T8 Appendix A), fill it from `DISCOVERY_SUMMARY_v1.json`:
   - one row per `reconciliationItems` entry, with controller-owned fields `recordKey`, `contextIds`, `sourceAnchor`, `origin`, `laneAFinding`, `laneBFinding`, `challengeDecision`;
   - reviewer fields set to `"<REQUIRED>"`;
   - `automationOwnedFields` listing the seven controller fields;
   - if the summary does not exist yet (Phase 3 PASS time), set the field to `["<PENDING_DISCOVERY>"]`;
   - if it has zero items, set `["NONE_IDENTIFIED"]`.
   - Set `automationInputs.expectedDiscoveryRecordKeys` to the list of keys.
   - Keep the existing `sourceReviewScaffold` path for non-v12 forms.
2. **Coverage.** Add `export function phase4DiscoveryCoverageV1({summary})` returning `{coverageSummary, unreviewedRequiredSurfaces}`:
   - `coverageSummary`: `"Required contexts: <n>; accepted: <a>; disputed: <d>; gaps: <g>; label: <label>."`;
   - `unreviewedRequiredSurfaces`: the sorted gap `contextIds`, or `['NONE_IDENTIFIED']`.
   - Use it instead of `phase4CoverageFromForm` when the policy is active.
   - **Gaps do not create deficiencies.**
3. **Validation (v12 only).** In `validatePhaseScaffold` (sequence 4), add these checks:
   - every `expectedDiscoveryRecordKeys` key is present exactly once;
   - `disposition` ∈ {`CANDIDATE_CREATED`, `RESOLVED_NO_ISSUE`, `COVERAGE_GAP_ACCEPTED`};
   - `CANDIDATE_CREATED` requires `candidateTempKeyOrNone` equal to a `tempKey` in step 3 `candidateRecords`;
   - `RESOLVED_NO_ISSUE` requires `rationale` to contain at least one anchor matching `/\.(sol|vy):L\d+/`;
   - `COVERAGE_GAP_ACCEPTED` is allowed only when `origin` is `COVERAGE_GAP`;
   - the value `<PENDING_DISCOVERY>` anywhere is a deficiency `"Discovery not complete"`. This cannot normally happen, because reviewer-2 is woken only after completion.
4. Do not change any behavior for v11 forms.

### T5.4 Workflow changes (`.github/workflows/lite-phase-work-packet-controller-v1.yml`)

Make exactly these edits:

1. **Inputs.** Add `discovery` to the `review_kind` options. Add input `assignment_id` (string, default `''`).
2. **Request parsing.**
   - In the `jq -e` admission expression, add the alternative `((.reviewKind // "phase")=="discovery" and ((.assignmentId|type)=="string") and (.assignmentId|test("^[ABCI]-[0-9]{3}$")))`.
   - Read `assignment_id` from the request (`jq -r '.assignmentId // empty'`) or from the dispatch input, and add it to `$GITHUB_OUTPUT`.
   - Add `discovery` to the `case "$review_kind"` list and validate `assignment_id` against `^[ABCI]-[0-9]{3}$`.
3. **Routing.** In "Resolve canonical campaign routing", add: `elif [ review_kind = discovery ]; then test "$(jq -r '.discovery.activeAssignmentId // empty' "$directory_file")" = "<assignment_id>"`. A mismatch must exit 0 with a notice `stale discovery request`, not fail. Implement it by writing `stale=true` to the outputs and gating all later steps on `steps.routing.outputs.stale != 'true'`.
4. **Controller call.** When `review_kind` is `discovery`, add `--assignment-id "<assignment_id>"` to `args`. Read the new outputs: `discovery_wake_chat_key`, `discovery_wake_id`, `discovery_wake_phase_id`, `discovery_wake_milestone_id`, `discovery_wake_message_b64`.
5. **Publish.** In the publish step's `if:`, add statuses `DISCOVERY_REWORK`, `DISCOVERY_NEXT` and `DISCOVERY_COMPLETE`. Replace the single `git push` with:

```bash
for attempt in 1 2 3; do
  if timeout -k 10s 120s git push origin "HEAD:${{ steps.request.outputs.audit_controller_ref }}"; then break; fi
  [ "$attempt" -lt 3 ] || { echo "::error::Publish failed after 3 attempts"; exit 1; }
  timeout -k 10s 120s git pull --rebase origin "${{ steps.request.outputs.audit_controller_ref }}"
done
```

6. **New step "Wake discovery chat",** placed after the publish step, with `if: steps.routing.outputs.effective_hold != 'true' && steps.controller.outputs.discovery_wake_chat_key != ''`. It:
   1. reads the registration file exactly like the step "Resolve reviewer for master-directed tests" does;
   2. resolves the URL as `.discoveryChats[key]` for `laneA`, `laneB` or `challenger`, or `.agentChats["reviewer-2"]` for `reviewer-2`;
   3. validates the URL with the same two regexes;
   4. calls `gh workflow run browser-agent-wake.yml` with `mode=resume_existing`, `worker_role=reviewer`, `gate_mode=LITE`, `gate_repository=CurveYield2/Audit-Controller`, `gate_ref`, `gate_state_path=<directory path>`, `gate_expected_phase_id=<discovery_wake_phase_id>`, `gate_expected_milestone_id=<discovery_wake_milestone_id>`, `gate_stop_campaign_statuses_csv=COMPLETE,STOPPED_BY_HUMAN`, `wake_id`, `chat_url`, `wake_message_b64`.
   5. Set `watchdog_enabled` from what you learned reading the watchdog gate: if the gate can treat a chat as "on task" while `currentAssignment.phaseId == phase-4` and the campaign status is `WAITING_FOR_DISCOVERY`, use `true`; otherwise use `false` and write the reason in the PR. A missing watchdog never blocks discovery, because the 30-minute re-push rule in the wake message covers lost runs.
7. **Do not change the concurrency group.**

### T5.5 Initialization: register the three discovery chats (v12 only)

1. In `audit-source-initialization-v1.yml`:
   - add three optional `workflow_dispatch` inputs `discovery_lane_a_chat_url`, `discovery_lane_b_chat_url` and `challenger_chat_url` (`required: false`);
   - read the same keys from the push request JSON;
   - when non-empty, validate them with `validate_chat_url`;
   - pass them as env `DISCOVERY_LANE_A_CHAT_URL`, `DISCOVERY_LANE_B_CHAT_URL`, `CHALLENGER_CHAT_URL` to `run-v1.sh`.
2. In `scripts/audit-source-initialization/run-v1.sh`:
   1. After `skill_home=...`, compute `detection_policy="$(jq -r '.detectionPolicy // empty' "${authority_packages[0]}/MANIFEST.json")"`.
   2. If it equals `audit-detection-rebuild-v1`:
      - require all three URLs (fail early with `::error::v12 campaigns require discovery_lane_a_chat_url, discovery_lane_b_chat_url and challenger_chat_url`);
      - require all eight chat URLs (4 reviewers, master, 3 discovery) to be pairwise distinct;
      - in **both** registration jq programs add `| .discoveryChats={laneA:$laneA,laneB:$laneB,challenger:$challenger}`.
   3. Otherwise ignore the three variables completely.
3. Do not change anything else in initialization.

### T5.6 Audit-Controller directory schema (second PR of T5, in Audit-Controller)

The controller writes new directory values. Make Audit-Controller's schema and validator accept them, so AC `npm run verify` stays green. Branch `upgrade/adr-T5-directory-schema`:

1. In `protocol/schemas/curveyield-audit-campaign-directory-entry-v2.schema.json`:
   - add the optional top-level properties:
     - `discovery`: object with `statePath` (string), `status` (enum `RUNNING`, `COMPLETE`) and `activeAssignmentId` (string or null), no other keys;
     - `postCompletionFollowup`: object, already used by live entries;
   - add `WAITING_FOR_DISCOVERY` and `WAITING_FOR_TARGETED_TESTS` to the `campaignStatus` enum;
   - add `WAITING_FOR_DISCOVERY` to the assignment `status` enum;
   - change the pattern `Audit_Litemode_v11(?:/|$)` to `Audit_Litemode_v(1[1-9]|[2-9][0-9])(?:/|$)`.
2. In `packages/controller-core/src/audit-campaign-directory-v2.mjs`, search `/Audit_Litemode_v11(?:\/|$)/`. Replace that regex with `/Audit_Litemode_v(1[1-9]|[2-9][0-9])(?:\/|$)/`, so v12 campaigns also require `masterReview`.
3. In `packages/controller-core/test/audit-campaign-directory-v2.test.mjs`, add one test: an entry with a v12 `workSchemaPath`, a `discovery` object and status `WAITING_FOR_DISCOVERY` validates, and the same entry without `masterReview` fails.
4. Verify:
   1. In the T5 Contract-Automation PR, set `process/adr-verify/AUDIT_CONTROLLER_REF_v1.txt` to `upgrade/adr-T5-directory-schema`.
   2. Wait for the `audit-controller-checks` job to go green, then merge this AC PR.
   3. Set the ref file back to `main` in the CA PR, wait for green again, then merge the CA PR.

### T5.7 Tests

1. `packages/github-native-sim/test/adr-discovery-v1.test.mjs` (pure module). Cases:
   1. Start writes state and the A-001 packet, and lane B packets contain no hypotheses path.
   2. A valid A-001 submission gives `DISCOVERY_NEXT` and a wake for laneA or laneB as the order dictates.
   3. An invalid submission 3 times with different bytes gives `GAP_RECORDED`, gaps added and advance.
   4. The same invalid bytes twice do not increase attempts.
   5. A stale assignment id gives `DISCOVERY_STALE_REQUEST`.
   6. `C-k` with both lanes gaps is skipped automatically.
   7. Complete writes the summary with origins in the defined order, and writes `BASELINE_OBLIGATIONS_v1.json` (stub T6 import until T6 lands; T6 replaces the stub).
   8. A missing plan gives `completeImmediately`.
   9. Determinism: the same inputs give the same files.
2. `packages/github-native-sim/test/adr-discovery-controller-v1.test.mjs` (controller integration). Build a temporary Audit-Controller tree the way `lite-phase-packet-controller-integration-v1.test.mjs` does, with:
   - a fixture authority root containing `MANIFEST.json` with `detectionPolicy`, and the Phase 3 and Phase 4 schemas/templates. For Phase 4, copy T8 Appendix A into the test fixtures.
   - Drive Phase 3 PASS, then assert `campaignStatus:"WAITING_FOR_DISCOVERY"` and `discoveryStarted:true` with `sameReviewerAdvanced:false`.
   - Drive discovery submissions to completion, then assert `currentAssignment.phaseSequence===4`, status `ACTIVE`, and that the form contains `discoveryReconciliationRecords` rows.
3. **Old-path test** in the same file: an identical v11-style fixture (no `detectionPolicy`) at Phase 3 PASS gives same-reviewer Phase 4 `ACTIVE` with the `sourceReviewRecords` scaffold, and no discovery files are written.
4. **Workflow syntax:** add a test that loads `lite-phase-work-packet-controller-v1.yml` as text and asserts it contains `discovery` in the options, the `assignment_id` input, the push-retry loop and the "Wake discovery chat" step.

**Done when:** all are green in the T0 workflow, and the existing regression step (including the existing controller integration test) is green.

---

## T6 — Baseline obligations and Phase 6 test groups

**Goal:** turn the reviewed coverage into a candidate-independent test plan for Phase 6. There is one obligation per (contract, defect class) with `testRequired:true`, grouped per contract. Gaps in review do not remove testing.

**Read first:** T1 taxonomy and coverage module, T5 summary.

### T6.1 Create `packages/github-native-sim/src/adr-baseline-obligations-v1.mjs`

Export `deriveBaselineObligationsV1({inventory, taxonomy, discoveryState, acceptedSubmissions})`. It returns an artifact with `schemaVersion: "curveyield-baseline-obligations-v1"` and payload `{obligations, testGroups, excluded}`.

1. **Required pairs.** For every reviewable context and every class in `classesForTriggersV1(...)` whose taxonomy entry has `testRequired:true`, the pair (`contract`, `classId`) is required. `contract` is `effectiveIn[0]`, or the context's `qualifiedContainer` when `effectiveIn` is empty.
2. **Exclusions.** A pair is excluded only when **every** context of that pair has the class judged `NOT_APPLICABLE` by at least one lane **and** accepted by the challenger (`classDecisions` `ACCEPT`, or a row `ACCEPT` with `laneComparison:"AGREE"`). Record it in `excluded` with `reason:"NOT_APPLICABLE_ACCEPTED"`.
3. **Obligation shape.** One obligation per remaining pair: `{obligationId:"BOB-<4 digits>", contract, classId, testMethod, title:"<class title> holds for <contract>", contextIds:[sorted], reviewChecks:<from taxonomy>, priority}`.
   - `priority` is `"HIGH"` when any of its contexts had `CONCERN` or `UNRESOLVED` in either lane, a `DISPUTE`, or a gap. Otherwise `"NORMAL"`.
4. **Ordering.** Sort obligations by priority (`HIGH` first), then by contract, then by classId. Number them in that order.
5. **Test groups.** Group by contract into `TG-<3 digits>`, at most 8 obligations per group. Split larger contracts into several groups in obligation order. Each group is `{testGroupId, contract, obligationIds, testMethods:[unique sorted], priority:<HIGH if any HIGH>}`.
6. **Determinism.** Reversed inputs give an identical digest.

Replace the T5 stub import with this function.

### T6.2 Tests: `packages/github-native-sim/test/adr-baseline-obligations-v1.test.mjs`

1. A contract with an authorization surface and a fee computation but zero candidates still gets `ACCESS_CONTROL` and `ACCOUNTING_MATH` obligations (candidate-independent).
2. `REVIEW_ONLY` classes never produce obligations.
3. A pair is excluded only when every context's N/A was accepted.
4. A gap context still produces obligations, with `priority:"HIGH"`.
5. A contract with 11 obligations gives 2 groups (8 + 3).
6. Ordering puts `HIGH` first.
7. Determinism.

**Done when:** green in the T0 workflow.

---

## T7 — Phase 6 AI-guided testing path

**Goal:**
- reviewer-3L turns each Phase 6 test group into harnesses and requests, dispatches them through the existing V7 lane (at most 3 rounds per group), and triages every result.
- Automation adds a readable assertion ledger to every execution.
- The controller validates outcomes against the ledgers.

There is no unguided fuzzing, Medusa campaign or telemetry run. Every run has a reviewer-written design record.

**Read first:**
- `.github/workflows/lite-v7-execution-dispatch-v1.yml` (whole file).
- `.github/workflows/audit-controller-execution.yml`: search `Prepare automatic Lite evidence ingestion` and `cp "../.audit-evidence/v7-execution/$V7_REQUEST_ID/controller-evidence.json" "$evidence_rel"`.
- `packages/github-native-sim/src/v7-compact-result-v1.mjs`: search `export function readV7RawResultV1`.
- `packages/github-native-sim/harness-skeletons-v2/README_v2.md`.
- The `npm run v7:harness:init` and `v7:harness:validate` sections of the root `AGENTS.md`.
- `scripts/lib/lite-phase-prefill-v1.mjs`: search `if(sequence===6){` and `export function validatePhaseScaffold`.
- `packages/github-native-sim/src/lite-boundary-artifacts-v1.mjs`: search `export function renderFinalEvidenceIndexV1`.
- `scripts/lib/lite-master-review-v1.mjs`: search `export function masterWakeMessage`.

### T7.1 Assertion ledger: create `packages/github-native-sim/src/adr-assertion-ledger-v1.mjs`

1. Export `buildAssertionLedgerV1({evidence})`. It returns `{schemaVersion:"curveyield-assertion-ledger-v1", parseStatus, tool, toolInvoked, executedCalls, tests:[{name, status:"PASS"|"FAIL"|"SKIPPED", reason}]}`.
2. Before writing the parser, read real examples of `EXECUTION_EVIDENCE_v1.json` (Audit-Controller `campaigns/*/controller/automation/*/EXECUTION_EVIDENCE_v1.json`) and of the raw result returned by `readV7RawResultV1`.
   - Write the parser for the Foundry test-result fields and the Medusa property-result fields you actually find.
   - If the fields cannot be found, return `parseStatus:"UNPARSEABLE"` with empty `tests`.
   - Set `toolInvoked:null` when the tool flag is absent.
3. It never throws.
4. Also make the file runnable as a CLI: `node packages/github-native-sim/src/adr-assertion-ledger-v1.mjs --evidence <path> --out <path>`. It writes the ledger. On any error it writes `{parseStatus:"UNPARSEABLE", error:"…"}` and exits 0.
5. In `audit-controller-execution.yml`, in step "Prepare automatic Lite evidence ingestion", directly after the line copying `controller-evidence.json` to `"$evidence_rel"`, add:

```bash
node "$GITHUB_WORKSPACE/packages/github-native-sim/src/adr-assertion-ledger-v1.mjs" --evidence "$evidence_rel" --out "$evidence_dir/ASSERTION_LEDGER_v1.json" || true
```

   Then make sure the new file is included in the same `git add` as the evidence (search the following `git add` in that step and add the path if the step adds explicit paths). This runs for every request, which is harmless because it is a new read-only file.

### T7.2 Dispatch lane: allow Phase 6 requests in `lite-v7-execution-dispatch-v1.yml`

Keep the Phase 9 behavior byte-for-byte. Add a Phase 6 alternative:
1. In the request `jq` admission, also accept `.phaseSequence==6`.
2. In the `request_path` check, accept `campaigns/*/controller/phase6-tests/TG-[0-9][0-9][0-9]/*.json` when the phase is 6.
3. In "Verify exact … binding", for phase 6 require:
   - the V7 request `.phaseId == "phase-6"`;
   - `directory.currentAssignment.phaseSequence == 6`;
   - the request path inside `"$workspace"/controller/phase6-tests/`.
   Rename the step to `Verify exact campaign/request binding` and leave the phase-9 checks unchanged inside it.
4. **Round limit.** In the same step, for phase 6, count the `*.json` files in the request's `TG-xxx` folder in the Audit-Controller checkout. If the count is greater than 3, fail with `::error::ROUND_LIMIT_REACHED for <TG>: record NOT_ACHIEVED with reasonCode ROUNDS_EXHAUSTED in the Phase 6 work form.`
5. Update the summary text to say `Phase-6 or Phase-9`.

### T7.3 Phase 6 prefill and validation (v12 only; T8 Appendix B defines the step-4 schema)

1. **Prefill.** In `applyPhaseBoundaryPrefill`, in the `if(sequence===6){` branch, when the policy is active, read `work/phase-06/BASELINE_OBLIGATIONS_v1.json` and fill `actions['step-4'].outputs.baselineTestRecords`:
   - one row per test group, with controller fields `testGroupId`, `contract`, `obligationIds` and `obligationsDetail` (array of `{obligationId, classId, title, contextIds, priority, testMethod, reviewChecks}`);
   - `requestDirectory: "controller/phase6-tests/<testGroupId>/"`;
   - reviewer fields `harnessDesign`, `dispatchRounds`, `requestPaths`, `obligationOutcomes` and `limitations` set to `"<REQUIRED>"`;
   - with zero groups, set `["NONE_IDENTIFIED"]`.
2. **Validation.** In `validatePhaseScaffold` (sequence 6), when the policy is active, for each row:
   - `dispatchRounds` is an integer 0–3 and equals the number of `*.json` files in `requestDirectory`;
   - `requestPaths` equals that file list, sorted, or `["NONE_IDENTIFIED"]` when 0;
   - `harnessDesign` is non-blank when `dispatchRounds > 0`;
   - `obligationOutcomes` covers exactly `obligationIds`, each `{obligationId, outcome, ledgerRef, assertionNames, reasonCode, note}`. By outcome:
     - `PASSED`: `ledgerRef` points to an existing `controller/automation/*/ASSERTION_LEDGER_v1.json` with `parseStatus:"PARSED"` and `toolInvoked:true`, and every name in `assertionNames` exists in `tests` with status `PASS`.
     - `PROPERTY_FAILED`: the same ledger checks, and at least one name in `assertionNames` has status `FAIL`.
     - `INCONCLUSIVE`: `note` is non-blank.
     - `NOT_ACHIEVED`: `note` is non-blank and `reasonCode` ∈ {`ROUNDS_EXHAUSTED` (requires `dispatchRounds===3`), `NO_EXECUTABLE_SETUP`, `TOOL_UNSUPPORTED`}.
   - Each failure is a normal Phase 6 deficiency (rework).
3. **Phase 8 linkage.** When the policy is active and sequence is 8, every Phase 6 `PROPERTY_FAILED` outcome must appear as a `candidateKey` equal to `P6-PROP-<testGroupId>-<obligationId>` in the Phase 8 step-2 `candidateValidations`. A missing key is a deficiency `Phase 6 property failure <key> is not validated in Phase 8`. Read the Phase 6 canonical data via `canonicalFor(root, campaignPath, 6)` (search `function canonicalFor` in the controller), or from the Phase 6 derived input if prefill does not have the helper. Do not invent another path.

### T7.4 Coverage matrix in Phase 10 and the master wake (v12 only)

1. Find the call to `renderFinalEvidenceIndexV1(` in the controller. Before it, when the policy is active:
   - build `buildCoverageMatrixV1({inventory, taxonomy, discoveryState, phase6Results})`. `phase6Results` maps each `obligationId` to its outcome from the Phase 6 canonical step 4.
   - write `work/phase-10/COVERAGE_MATRIX_v1.json`;
   - append `renderCoverageMarkdownV1(matrix)` under a heading `## Coverage matrix` to the rendered evidence index text.
2. In `validatePhaseScaffold` (sequence 10, policy active), the step-3 verdict text must contain the exact label string from `COVERAGE_MATRIX_v1.json` (`FULL_COVERAGE` or `PARTIAL_COVERAGE`). Otherwise add the deficiency `Final verdict must state coverage label <label>`.
3. In `masterWakeMessage` (`lite-master-review-v1.mjs`), when the policy is active, append the line `Coverage gaps and disputes for this segment: <blob URL of DISCOVERY_SUMMARY_v1.json> and <blob URL of COVERAGE_MATRIX_v1.json if it exists>. Review every gap; order targeted tests through the existing directive where evidence is missing.`

### T7.5 Tests

1. `packages/github-native-sim/test/adr-assertion-ledger-v1.test.mjs`:
   - a fixture evidence file shaped like a real Foundry result gives `PARSED` with PASS/FAIL tests;
   - an unknown shape gives `UNPARSEABLE`;
   - the CLI on a bad path writes the `UNPARSEABLE` file and exits 0.
2. `packages/github-native-sim/test/adr-phase6-validation-v1.test.mjs`:
   - `PASSED` with a matching ledger is valid;
   - `PASSED` with an `UNPARSEABLE` ledger is a deficiency;
   - `PASSED` with `toolInvoked:null` is a deficiency;
   - `NOT_ACHIEVED` with `ROUNDS_EXHAUSTED` and 2 rounds is a deficiency;
   - `NOT_ACHIEVED` with `NO_EXECUTABLE_SETUP` and a note is valid;
   - a request-file count mismatch is a deficiency;
   - a `PROPERTY_FAILED` missing from Phase 8 is a deficiency;
   - the v11 Phase 6 form is unaffected.
3. `packages/github-native-sim/test/adr-dispatch-workflow-v1.test.mjs`: load `lite-v7-execution-dispatch-v1.yml` as text and assert:
   - the phase-9 path pattern is still present;
   - the phase-6 pattern `controller/phase6-tests/TG-` is present;
   - `ROUND_LIMIT_REACHED` is present.

**Done when:** all are green in the T0 workflow, and the existing regression step is green.
