# Audit Detection Rebuild v2 — T4–T7: Flow Review, Attacker Reviewer, Baseline Obligations and Attacker-Owned Phase 6

> **For the implementing agent:** `00_BUILD_CONTRACT_v2.md` applies in full. T0–T3 must be merged first. Every behavior added here runs only when `detectionPolicyForAuthorityV1(...)` returns `'audit-detection-rebuild-v1'` for the campaign's bound authority (D7). Every task must add an old-path test proving a v11-bound campaign behaves exactly as before.

Supersedes `02_REVIEW_AND_BASELINE_CHECKS_v1.md` (removed; Git history keeps it).

## Shared definitions for T4–T7

**Roles and chats.** No new chats exist (00 D3).
- F and R units go to the existing `reviewer-2` chat.
- X units go to the existing `reviewer-3L` chat. In v12 the skill calls this role the **attacker reviewer**.
- The master is the challenger at its normal reviewer-2 segment review (D10).

**Unit order:** all F units, then all R units, then all X units. Exactly one unit is active at a time.

**Unit packet.** The controller writes it at `work/phase-04/discovery/<unitId>/ASSIGNMENT_PACKET_v1.json`. It has the header from 00 §7.1, `schemaVersion: "curveyield-discovery-unit-packet-v1"`, and this payload:

```
{
  unitId, role: "FLOW_REVIEW" | "RESIDUAL_REVIEW" | "ATTACK",
  flows: [ {flowId, entryContextId, contexts: [contextIds], contracts, crossContract, depthLimited} ],
  primaryContexts: [ {contextId, path, contract, kind, signature, lineStart, lineEnd, effectiveIn,
                      requiredClasses: [classId], reviewChecks: {<classId>: [string]}, triggers: [key], guardRow} ],
  readContexts: [ {contextId, path, contract, signature, lineStart, lineEnd} ],
  systemFacts: { clusterContracts, crossContractEdges, valueFlows, siblingAsymmetries, guardRowsWithoutGuard },
  integrationQuestions: [ <IOB objects> ],
  inputs: { requirementsPaths: [..], hypothesesPaths: [..], protectedAssetsPaths: [..] },
  submissionPath: "work/phase-04/discovery/<unitId>/SUBMISSION_v1.json",
  instructionsPath: "<bound authority root>/discovery/<FLOW_REVIEW|ATTACKER>_START_HERE.md",
  boundaryRequestPath: "process/agent-upload/lite-phase-boundary/<campaignId>-discovery.json",
  maxValidationAttempts: 3
}
```

**What each role gets:**
- **F and R units:**
  - `primaryContexts` (rows to fill) and `readContexts` (everything else in the unit's flows);
  - `systemFacts` restricted to the unit's cluster;
  - inputs: Phase 1 protected assets, Phase 2 requirements and Phase 3 hypotheses, from `derived/phase-1/PHASE_01_CANONICAL_DATA_v1.json`, `derived/phase-2/PHASE_02_CANONICAL_DATA_v1.json` and `derived/phase-3/PHASE_03_CANONICAL_DATA_v1.json`.
  - `integrationQuestions` is empty.
- **X units:**
  - all of the cluster's flows, and `primaryContexts` empty;
  - `readContexts` = every context of the cluster;
  - the full cluster `systemFacts` and the unit's `integrationQuestions`;
  - inputs: **only** Phase 1 protected assets and Phase 2 requirements.
  - **Never** Phase 3 hypotheses, never any reviewer-2 submission, never candidates.

**Reading is never restricted.** Every reviewer may read and cite any in-scope or dependency file (00 D11). The only restriction is that the attacker must not open reviewer-2's discovery submissions, `work/phase-03/` or `work/phase-04/` work forms before its units are done. This keeps it independent.

**Flow-review submission** (`SUBMISSION_v1.json`, used for both F and R units; the reviewer updates the same file on each attempt):

```json
{
  "schemaVersion": "curveyield-discovery-flow-review-submission-v1",
  "unitId": "F-001",
  "flowNotes": [{"flowId": "FLOW-0001", "note": "<how value and authority move through this flow across contracts>", "anchors": ["contracts/A.sol:L10-L40", "contracts/B.sol:L5-L20"]}],
  "rows": [
    {"contextId": "CTX-…", "summary": "<what this code does>",
     "checks": [{"classId": "ACCESS_CONTROL", "applicability": "REQUIRED", "assessment": "SUPPORTED",
                 "evidence": "<source-specific reasoning>", "anchors": ["contracts/Foo.sol:L40-L44"]}],
     "candidates": [{"title": "<short>", "classId": "ACCESS_CONTROL", "description": "<what is wrong and who can exploit it>", "anchors": ["contracts/Foo.sol:L41"]}]}
  ]
}
```

- `applicability` is `REQUIRED` or `NOT_APPLICABLE`.
- `assessment` is `SUPPORTED`, `CONCERN`, `UNRESOLVED` or `NOT_APPLICABLE`. `NOT_APPLICABLE` is allowed only with applicability `NOT_APPLICABLE`.
- `flowNotes` has one entry per flow of the unit. For an R unit it is `[]`.

**Attack submission:**

```json
{
  "schemaVersion": "curveyield-discovery-attack-submission-v1",
  "unitId": "X-001",
  "attackPaths": [
    {"pathId": "AP-1", "flowIds": ["FLOW-0003", "FLOW-0007"],
     "goal": "<which asset, and steal / freeze / misdirect / inflate / take control>",
     "attackerRole": "UNPRIVILEGED",
     "steps": ["<call 1>", "<call 2>"],
     "anchors": ["contracts/A.sol:L50", "contracts/B.sol:L90-L96"],
     "result": "BLOCKED",
     "blockingControl": "<the exact check that stops it and why it cannot be bypassed>",
     "candidate": null,
     "simulationIdea": null}
  ],
  "integrationAnswers": [
    {"obligationId": "IOB-0001", "assessment": "SUPPORTED", "reasoning": "<…>", "anchors": ["contracts/A.sol:L10"], "candidate": null}
  ]
}
```

- `attackerRole` is one of `UNPRIVILEGED`, `PRIVILEGED_OTHER_ROLE`, `MALICIOUS_TOKEN_OR_ADAPTER`, `MALICIOUS_CALLBACK`, `MEV_SEARCHER`, `OWNER_OR_ADMIN`, `OTHER`.
- `result` is `VIABLE`, `BLOCKED` or `UNCERTAIN`.
- When `result` is `VIABLE` or `UNCERTAIN`:
  - `candidate` = `{title, classId, description, severityHint, anchors}`;
  - `simulationIdea` = `{transactionSequence, oracle}`. The attacker turns this into a real test in Phase 6.

---

## T4 — Flow-review and attack validators

**Goal:** deterministic structural validation. It checks reviewability and source binding only. It cannot certify that the reasoning is true; reconciliation, the master and Phase 6 tests do that.

**Read first:** 00 §7.2 and §7.4, the T1 taxonomy, the T3 flow plan.

### T4.1 Create `packages/github-native-sim/src/adr-discovery-validators-v1.mjs`

It exports the following.

**`parseAnchorV1(text, inventory)`**
- Returns `{path, lineStart, lineEnd}` or `null`.
- Accepted formats: `<path>:L<n>` and `<path>:L<a>-L<b>`, with `a ≤ b`.
- `path` must be a `sourceUnits` path in the inventory with `scopeTier` `IN_SCOPE` or `DEPENDENCY`.
- `lineEnd` must not exceed the file's line count. Record line counts in the inventory as `sourceUnits[].lineCount` and add that field to T2 if missing.

**`validateFlowReviewSubmissionV1({packet, submission, inventory})`.** Error codes:

| Code | Meaning |
|---|---|
| `SUBMISSION_SCHEMA` | Wrong `schemaVersion`, missing `rows`, or a non-array field |
| `UNIT_MISMATCH` | |
| `MISSING_CONTEXT`, `EXTRA_CONTEXT`, `DUPLICATE_CONTEXT` | Against `primaryContexts` |
| `FLOW_NOTE_MISSING` | A unit flow without a note |
| `FLOW_NOTE_EMPTY` | A flow note that is blank or has no anchors |
| `SUMMARY_EMPTY` | |
| `CHECK_MISSING` | A required class has no check |
| `CHECK_UNKNOWN_CLASS` | |
| `CHECK_DUPLICATE` | |
| `EVIDENCE_EMPTY` | Blank after trim, or equal (case-insensitive) to `"N/A"`, `"none"`, `"safe"`, `"no issue"` or `"reviewed"` |
| `ANCHOR_INVALID` | Fails `parseAnchorV1` |
| `ANCHOR_REQUIRED` | A `SUPPORTED`, `CONCERN` or `NOT_APPLICABLE` check with zero anchors |
| `NA_MISMATCH` | |
| `CONCERN_WITHOUT_CANDIDATE` | |
| `CANDIDATE_INVALID` | Blank title or description, or zero anchors |
| `REPEATED_EVIDENCE` | The same evidence text (lower-cased, whitespace collapsed, digits kept) in more than 3 checks across **different** contexts |

There is no word-count rule.

**`validateAttackSubmissionV1({packet, submission, inventory})`.** Error codes:

| Code | Meaning |
|---|---|
| `SUBMISSION_SCHEMA` | |
| `UNIT_MISMATCH` | |
| `FLOW_NOT_ATTACKED` | Every `flowId` in the packet must appear in at least one attack path. A `BLOCKED` path counts: it documents the attempted attack and the control that stops it. |
| `UNKNOWN_FLOW` | |
| `PATH_DUPLICATE_ID` | |
| `GOAL_EMPTY` | |
| `STEPS_EMPTY` | |
| `ROLE_UNKNOWN` | |
| `ANCHOR_INVALID` | |
| `ANCHOR_REQUIRED` | |
| `BLOCKING_CONTROL_MISSING` | A `BLOCKED` path without `blockingControl` or without an anchor |
| `CANDIDATE_REQUIRED` | A `VIABLE` or `UNCERTAIN` path without a `candidate` |
| `SIMULATION_IDEA_REQUIRED` | A `VIABLE` or `UNCERTAIN` path without both `transactionSequence` and `oracle` |
| `QUESTION_UNANSWERED`, `QUESTION_EXTRA`, `QUESTION_DUPLICATE` | Against `integrationQuestions` |
| `REASONING_EMPTY` | |
| `CONCERN_WITHOUT_CANDIDATE` | |
| `REPEATED_BLOCKING_CONTROL` | The same `blockingControl` text in more than 3 paths covering different flows |

**`feedbackTextV1(result, {attempt, maxAttempts, submissionPath, unitId})`**
- Line 1: `"Discovery unit <unitId> attempt <attempt>/<max> failed validation."`
- Then one line per error: `"- <code> at <path>: <message>"`. Stop after 60 lines and add `"- … <n> more"`.
- Last line: `"Repair only these items in <submissionPath>, then push the boundary request again with attempt increased by 1."`

### T4.2 Tests: `packages/github-native-sim/test/adr-discovery-validators-v1.test.mjs`

1. At least one failing case for every error code above.
2. A fully valid flow-review submission, a valid R-unit submission and a valid attack submission.
3. An anchor in a **different contract** from the reviewed context is accepted. This is the cross-contract case.
4. An anchor beyond the file's last line is rejected.
5. An anchor in a `TEST_OR_MOCK` file is rejected.
6. The same evidence in 4 different contexts gives `REPEATED_EVIDENCE`. The same evidence 4 times in one context is not flagged.
7. Validators never throw on a `null` submission.

**Done when:** green in the T0 workflow.

---

## T5 — Discovery routing through the existing chats

**Goal:** after Phase 3 passes on a v12 campaign, the controller does the following:
1. Runs reviewer-2's F and R units, then the attacker's X units, one at a time, waking the right existing chat.
2. Validates each submission, with at most 3 attempts per unit.
3. Writes the discovery summary.
4. Activates reviewer-2 for Phase 4 reconciliation.

Nothing here may block a campaign permanently (N1–N3). Initialization does not change.

**Read first:**
- `scripts/lite-phase-packet-controller-v1.mjs`: search `const reviewKind=a['review-kind']`, `if(reviewKind==='master'){`, `const nextReviewer=assignmentReviewer(nextSequence);` and the final `process.stdout.write(JSON.stringify({status:'PASS'`.
- `scripts/lib/lite-phase-prefill-v1.mjs`: search `export function applyPhaseBoundaryPrefill`, `function sourceReviewScaffold`, `export function phase4CoverageFromForm` and `export function validatePhaseScaffold`.
- `scripts/lib/lite-phase-work-v1.mjs`: search `export function preparePhaseWork`.
- `.github/workflows/lite-phase-work-packet-controller-v1.yml` (whole file).
- `.github/workflows/browser-agent-watchdog.yml`: search `expectedMilestoneId`.
- `packages/github-native-sim/test/lite-phase-packet-controller-integration-v1.test.mjs`: how it builds a temporary Audit-Controller tree and authority.

### T5.1 Create `packages/github-native-sim/src/adr-discovery-v1.mjs`

It exports the functions below.

**`startDiscoveryV1({root, campaignPath, directory, authorityRoot, automationRoot, now})`**
1. Reads `evidence/review-inventory/FLOW_PLAN_v1.json`, `REVIEW_INVENTORY_v1.json` and `SYSTEM_FACTS_v1.json`, and the taxonomy via `loadTaxonomyV1(automationRoot)`.
2. Sets `order` = F ids, then R ids, then X ids, each in numeric order.
3. Writes `work/phase-04/discovery/DISCOVERY_STATE_v1.json` (`schemaVersion: "curveyield-discovery-state-v1"`) with payload:
   `{status:"RUNNING", order, activeUnitId: order[0], units: {<id>: {role, chatKey, status:"PENDING", attempts:0, lastValidatedSubmissionSha:null, lastErrors:[], acceptedSubmissionSha:null}}, gaps: <copy of plan.gaps>}`.
   - `chatKey` is `reviewer-2` for F and R units and `reviewer-3L` for X units.
4. Activates the first unit and writes its packet with `buildUnitPacketV1`.
5. If the plan is missing or has zero units, it writes `status:"COMPLETE"` with gap `{code:"INVENTORY_INCOMPLETE", detail:"No flow plan"}` and returns `{completeImmediately:true}`.
6. It never throws for missing files.

**`buildUnitPacketV1({...same inputs..., unitId, state})`**
- Writes the packet from the shared definitions.
- `requiredClasses` = `classesForTriggersV1(taxonomy, inventory.payload.triggers[contextId])`.
- `instructionsPath` is `<authorityRoot>/discovery/FLOW_REVIEW_START_HERE.md` for F and R units, and `<authorityRoot>/discovery/ATTACKER_START_HERE.md` for X units. These files are authored in T8.

**`advanceDiscoveryV1({root, campaignPath, directory, authorityRoot, automationRoot, unitId, now})`** returns `{status, feedbackText, wake}`.
1. **Stale request.** If `unitId !== activeUnitId`, return `{status:"DISCOVERY_STALE_REQUEST", feedbackText:"Unit <id> is not active; active is <active>. No action taken.", wake:null}`. Do not write anything.
2. **Missing submission.** Return `DISCOVERY_REWORK` with feedback `"Submission file not found at <path>. Write it, then push the boundary request again."`. Attempts do not change.
3. **Repeated bytes.** If `sha256(bytes)` equals `lastValidatedSubmissionSha`, return `DISCOVERY_REWORK` with the stored errors. Attempts do not change.
4. **Validate.** A JSON parse failure counts as one failed attempt with code `SUBMISSION_SCHEMA`. Otherwise use the T4 validator for the role.
5. **On failure:**
   - set `attempts += 1` and store the sha and the errors;
   - if `attempts < 3`, return `DISCOVERY_REWORK` with a wake to the same chat;
   - if `attempts >= 3`, set the unit to `GAP_RECORDED`, add one gap per primary context or flow (`code:"VALIDATION_ATTEMPTS_EXHAUSTED"`), then go to step 7.
6. **On success:** copy the bytes to `.../<id>/ACCEPTED_SUBMISSION_v1.json`, set the unit to `ACCEPTED`, then go to step 7.
7. **Advance.**
   - If there is a next unit: activate it, write its packet, and return `DISCOVERY_NEXT` with a wake to its chat.
   - Otherwise return the result of `completeDiscoveryV1`.
8. **Wake object:** `{chatKey, wakeId: "<campaignId>-discovery-<unitId>-a<attempts>", phaseId: "phase-4", milestoneId: "DISCOVERY_<unitId>", messageB64}`. The message comes from `discoveryWakeMessageV1`.

**`completeDiscoveryV1({root, campaignPath, directory, authorityRoot, automationRoot, state, now})`**
1. Sets `status:"COMPLETE"` and `activeUnitId:null`.
2. Writes the summary (`buildDiscoverySummaryV1`).
3. Calls T6 `deriveBaselineObligationsV1` and writes `work/phase-06/BASELINE_OBLIGATIONS_v1.json`. Until T6 lands, use a stub that writes an empty obligations list.
4. Returns `DISCOVERY_COMPLETE` with this wake:
   - `{chatKey:"reviewer-2", wakeId:"<campaignId>-discovery-complete", phaseId:"phase-4", milestoneId:"PHASE_4_WORK_PACKET"}`;
   - message exactly: `"CONTROLLER: Phase 4 discovery is complete. Phase 4 is now ACTIVE for reviewer-2. Follow phases/phase-4/START_HERE.md of the bound authority: Step 1 reconciles every record prefilled from work/phase-04/discovery/DISCOVERY_SUMMARY_v1.json, then complete Steps 2 and 3 and invoke controller validation as usual."`

**`buildDiscoverySummaryV1({state, inventory, plan, acceptedSubmissions, taxonomy})`**

Writes `work/phase-04/discovery/DISCOVERY_SUMMARY_v1.json` (`schemaVersion: "curveyield-discovery-summary-v1"`) with payload `{reconciliationItems, notApplicableClaims, attackPaths, perContext, gaps, coverage}`.

1. **`reconciliationItems`.** Keys are `DISC-0001`… and the origins are added in exactly this order:
   1. `REVIEWER_CANDIDATE`: every F or R candidate.
   2. `REVIEWER_UNRESOLVED`: every check with assessment `UNRESOLVED`.
   3. `ATTACK_FINDING`: every attack path with result `VIABLE` or `UNCERTAIN`.
   4. `ATTACK_CONTRADICTS_REVIEW`: every `VIABLE` or `UNCERTAIN` attack path whose anchors fall inside a context where reviewer-2 marked the candidate's `classId` as `SUPPORTED`. This is the main cross-check between the two independent reads.
   5. `INTEGRATION_CONCERN`: every integration answer with `CONCERN` or `UNRESOLVED`.
   6. `COVERAGE_GAP`: every gap.
2. **Item fields.** Each item is `{recordKey, origin, contextIds, sourceAnchor, reviewerFinding, attackerFinding}`.
   - `sourceAnchor` is `"<path>:L<start>-L<end>"` of the first context, or the first anchor of the attack path.
   - The two finding texts are at most 600 characters each, or `"NO_SUBMISSION"`.
3. **`notApplicableClaims`.** Every reviewer-2 `NOT_APPLICABLE` check, as `{contextId, classId, evidence, anchors}`. These go to the master, not to reconciliation (D10).
4. **`coverage`** = `buildCoverageMatrixV1({inventory, taxonomy, discoveryState})`, where `discoveryState` is derived from accepted submissions, attack paths and gaps (see the T1 update below).

**`discoveryWakeMessageV1({directory, auditControllerRef, packetPath, submissionPath, instructionsPath, boundaryRequestPath, unitId, role, attempt, feedbackText = null})`** returns plain text containing, in this order:
1. A role and campaign line. For X units: `"You are the attacker reviewer."`
2. `"Use the GitHub connector app for every repository read and write."`
3. Blob URLs (same style as `scripts/prepare-lite-assignment-successor-v2.mjs`) for the instructions, the packet and the submission path.
4. The feedback text, if any.
5. The exact boundary request JSON: `{"schemaVersion":"curveyield-lite-phase-boundary-request-v1","campaignId":"…","reviewKind":"discovery","unitId":"…","auditControllerRef":"…","attempt":<n>}`.
6. `"If no controller response arrives within 30 minutes of pushing the request, push the same request again with attempt increased by 1."`
7. For X units only: `"You may read any source file. Do not open work/phase-03/, work/phase-04/ work forms, or any other unit's folder under work/phase-04/discovery/."`

### T5.2 Controller changes (`scripts/lite-phase-packet-controller-v1.mjs`)

1. **Review kind.** Add `'discovery'` to the review-kind list. Add argument `--unit-id`, required for `discovery`; if it is missing, throw `missing --unit-id`.
2. **Discovery branch.** Add `if(reviewKind==='discovery'){ … }` directly before `if(reviewKind==='master'){`. It:
   1. throws `campaign is held by explicit human status` if the status is `STOPPED_BY_HUMAN` or `BLOCKED`;
   2. requires `directory.discovery?.statePath`;
   3. calls `advanceDiscoveryV1` and copies `status` and `activeUnitId` into `directory.discovery`;
   4. on `DISCOVERY_COMPLETE`, calls `preparePhaseWork` for sequence 4 with `reviewer:'reviewer-2'`, `status:'ACTIVE'`, the existing predecessor receipt, and the previous Phase 4 `derivedInputPaths` plus `work/phase-04/discovery/DISCOVERY_SUMMARY_v1.json`, then sets `directory.currentAssignment` to the result and `directory.campaignStatus='ACTIVE'`;
   5. writes the directory;
   6. prints `{status, feedbackB64, discoveryWakeChatKey, discoveryWakeId, discoveryWakePhaseId, discoveryWakeMilestoneId, discoveryWakeMessageB64, campaignName}` and exits 0.
   - On `DISCOVERY_STALE_REQUEST` it only prints the status.
3. **Start at Phase 3 PASS (v12 only).** Directly after `nextAssignment=preparePhaseWork({…sequence:nextSequence…})`, add: if `sequence===3` and the policy is active:
   1. set `nextAssignment.status='WAITING_FOR_DISCOVERY'` and `directory.campaignStatus='WAITING_FOR_DISCOVERY'`;
   2. call `startDiscoveryV1`;
   3. set `directory.discovery={statePath, status:'RUNNING', activeUnitId}`.
   - If it returns `completeImmediately`, call `completeDiscoveryV1` and activate Phase 4 as in item 2.
4. **PASS output.** When discovery started, add `discoveryStarted:true` and the `discoveryWake…` fields to the PASS JSON, and force `freshSuccessorRequired:false` and `sameReviewerAdvanced:false`.
5. **Policy guard.** Compute `policy` once: from `authorityRootFromReceipt(predecessor)` for phase requests, or from the Phase 0 receipt for discovery requests. Wrap every new block in `if(policy){…}`. v11 behavior must not change.

### T5.3 Phase 4 prefill and validation (`scripts/lib/lite-phase-prefill-v1.mjs`)

1. **Prefill.** In the Phase 4 branch of `applyPhaseBoundaryPrefill`, when the policy is active and the template has `actions['step-1'].outputs.discoveryReconciliationRecords` (see T8 Appendix A), fill it from the summary:
   - one row per reconciliation item;
   - controller fields: `recordKey`, `contextIds`, `sourceAnchor`, `origin`, `reviewerFinding`, `attackerFinding`;
   - reviewer fields set to `"<REQUIRED>"`;
   - `automationOwnedFields` listing the six controller fields;
   - `["<PENDING_DISCOVERY>"]` before the summary exists, and `["NONE_IDENTIFIED"]` when there are zero items.
   - Set `automationInputs.expectedDiscoveryRecordKeys`.
   - Keep `sourceReviewScaffold` for non-v12 forms.
2. **Coverage.** Add `export function phase4DiscoveryCoverageV1({summary})` returning:
   - `coverageSummary`: `"Required contexts: <n>; accepted: <a>; contradicted by attacker: <c>; not-applicable claims: <na>; gaps: <g>; label: <label>."`;
   - `unreviewedRequiredSurfaces`: the sorted gap `contextIds`, or `['NONE_IDENTIFIED']`.
   - Use it instead of `phase4CoverageFromForm` when the policy is active. **Gaps never create deficiencies.**
3. **Validation.** In `validatePhaseScaffold` for sequence 4, v12 only:
   - every expected key appears exactly once;
   - `disposition` ∈ {`CANDIDATE_CREATED`, `RESOLVED_NO_ISSUE`, `COVERAGE_GAP_ACCEPTED`};
   - `CANDIDATE_CREATED` requires a matching step 3 `candidateRecords.tempKey`;
   - `RESOLVED_NO_ISSUE` requires `rationale` to contain an anchor matching `/\.(sol|vy):L\d+/`;
   - for origins `ATTACK_FINDING` and `ATTACK_CONTRADICTS_REVIEW`, `RESOLVED_NO_ISSUE` additionally requires `rationale` to name the blocking control with an anchor;
   - `COVERAGE_GAP_ACCEPTED` is allowed only for `COVERAGE_GAP` items;
   - any `<PENDING_DISCOVERY>` value is a deficiency.

### T5.4 Workflow changes (`lite-phase-work-packet-controller-v1.yml`)

1. **Inputs.** Add `discovery` to the `review_kind` options. Add input `unit_id` (string, default `''`).
2. **Request admission.**
   - In the `jq -e` expression, add the alternative `((.reviewKind // "phase")=="discovery" and ((.unitId|type)=="string") and (.unitId|test("^[FRX]-[0-9]{3}$")))`.
   - Read `unit_id` from the request or the dispatch input and output it.
   - Add `discovery` to the `case` list and validate the id against `^[FRX]-[0-9]{3}$`.
3. **Routing.** For `discovery`, compare `.discovery.activeUnitId` in the directory file with `unit_id`. On a mismatch, write `stale=true`, print the notice `stale discovery request`, and gate every later step on `steps.routing.outputs.stale != 'true'`. Never fail on a mismatch.
4. **Controller call.** Pass `--unit-id`. Read the outputs `discovery_wake_chat_key`, `discovery_wake_id`, `discovery_wake_phase_id`, `discovery_wake_milestone_id` and `discovery_wake_message_b64`.
5. **Publish.** Add `DISCOVERY_REWORK`, `DISCOVERY_NEXT` and `DISCOVERY_COMPLETE` to the publish condition. Replace the single `git push` with:

```bash
for attempt in 1 2 3; do
  if timeout -k 10s 120s git push origin "HEAD:${{ steps.request.outputs.audit_controller_ref }}"; then break; fi
  [ "$attempt" -lt 3 ] || { echo "::error::Publish failed after 3 attempts"; exit 1; }
  timeout -k 10s 120s git pull --rebase origin "${{ steps.request.outputs.audit_controller_ref }}"
done
```

6. **New step "Wake discovery chat"**, placed after publish, with condition `effective_hold != 'true' && discovery_wake_chat_key != ''`:
   1. read the registration exactly like the step "Resolve reviewer for master-directed tests";
   2. resolve the URL as `.agentChats[<chat key>]` (`reviewer-2` or `reviewer-3L`);
   3. validate it with the same two regexes;
   4. run `gh workflow run browser-agent-wake.yml` with `mode=resume_existing`, `worker_role=reviewer`, `gate_mode=LITE`, `gate_repository=CurveYield2/Audit-Controller`, `gate_ref`, `gate_state_path`, `gate_expected_phase_id`, `gate_expected_milestone_id`, `gate_stop_campaign_statuses_csv=COMPLETE,STOPPED_BY_HUMAN`, `wake_id`, `chat_url` and `wake_message_b64`;
   5. set `watchdog_enabled=true` only if the watchdog gate (read `browser-agent-watchdog.yml`) treats the chat as on task while the campaign is `WAITING_FOR_DISCOVERY`. Otherwise use `false` and give the reason in the PR. The 30-minute re-push rule covers lost runs.
7. **Do not change the concurrency group.**

### T5.5 Audit-Controller directory schema (second PR of T5)

Branch `upgrade/adr-T5-directory-schema`:

1. In `protocol/schemas/curveyield-audit-campaign-directory-entry-v2.schema.json`:
   - add the optional property `discovery`: an object with `statePath` (string), `status` (enum `RUNNING`, `COMPLETE`) and `activeUnitId` (string or null), and no other keys;
   - add the optional property `postCompletionFollowup` (object), which live entries already use;
   - add `WAITING_FOR_DISCOVERY` and `WAITING_FOR_TARGETED_TESTS` to `campaignStatus`;
   - add `WAITING_FOR_DISCOVERY` to the assignment `status`;
   - change the pattern `Audit_Litemode_v11(?:/|$)` to `Audit_Litemode_v(1[1-9]|[2-9][0-9])(?:/|$)`.
2. In `packages/controller-core/src/audit-campaign-directory-v2.mjs`, replace `/Audit_Litemode_v11(?:\/|$)/` with `/Audit_Litemode_v(1[1-9]|[2-9][0-9])(?:\/|$)/`.
3. In `packages/controller-core/test/audit-campaign-directory-v2.test.mjs`, add a test: an entry with a v12 `workSchemaPath`, a `discovery` object and `WAITING_FOR_DISCOVERY` validates, and fails without `masterReview`.
4. To verify:
   1. In the T5 Contract-Automation PR, set `process/adr-verify/AUDIT_CONTROLLER_REF_v1.txt` to `upgrade/adr-T5-directory-schema`.
   2. Wait for `audit-controller-checks` to go green.
   3. Merge the AC PR.
   4. Set the ref back to `main`, wait for green again, and merge the CA PR.

### T5.6 Tests

1. `packages/github-native-sim/test/adr-discovery-v1.test.mjs`:
   - start writes the state and the F-001 packet;
   - X packets contain no hypotheses path and no reviewer-2 paths;
   - a valid F submission gives `DISCOVERY_NEXT`;
   - the last R unit is followed by X-001 with `chatKey:"reviewer-3L"`;
   - three different invalid submissions give `GAP_RECORDED`, gaps, and advance;
   - identical bytes resubmitted do not increase attempts;
   - a stale id gives `DISCOVERY_STALE_REQUEST`;
   - a VIABLE attack path anchored in a context reviewer-2 marked SUPPORTED for the same class gives an `ATTACK_CONTRADICTS_REVIEW` item;
   - `notApplicableClaims` is listed;
   - a missing plan gives `completeImmediately`;
   - same inputs produce the same files (determinism).
2. `packages/github-native-sim/test/adr-discovery-controller-v1.test.mjs`:
   - build a temporary Audit-Controller tree like the existing integration test, with a fixture authority (MANIFEST with `detectionPolicy`, and the Phase 3 and Phase 4 schemas/templates; Phase 4 is copied from T8 Appendix A);
   - Phase 3 PASS gives `WAITING_FOR_DISCOVERY`, `discoveryStarted:true` and `sameReviewerAdvanced:false`;
   - driving all units to completion gives Phase 4 `ACTIVE` for reviewer-2, with `discoveryReconciliationRecords` rows.
3. **Old path:** a v11 fixture at Phase 3 PASS goes to same-reviewer Phase 4 `ACTIVE` with the `sourceReviewRecords` scaffold, and writes no discovery files.
4. **Workflow text test:** the controller workflow contains the `discovery` option, the `unit_id` input, the push-retry loop and the "Wake discovery chat" step.

**Done when:** all are green in the T0 workflow and the regression step is green.

---

## T6 — Baseline obligations and Phase 6 test groups

**Goal:** a candidate-independent test plan for the attacker's Phase 6:
- one obligation per (contract, defect class) with `testRequired:true`, grouped by contract;
- review gaps and "not applicable" claims never remove testing.

### T6.1 Create `packages/github-native-sim/src/adr-baseline-obligations-v1.mjs`

Export `deriveBaselineObligationsV1({inventory, taxonomy, summary})`. It returns an artifact with `schemaVersion: "curveyield-baseline-obligations-v1"` and payload `{obligations, testGroups}`.

1. **Required pairs.** For every reviewable context and every class in `classesForTriggersV1(...)` with `testRequired:true`, the pair (`contract`, `classId`) is required. `contract` is `effectiveIn[0]`, or `qualifiedContainer` when `effectiveIn` is empty.
2. **No exclusions.** A reviewer-2 `NOT_APPLICABLE` claim does **not** remove the obligation. In Phase 6 the attacker may record the outcome `NOT_APPLICABLE_CONFIRMED` with anchors, and the master sees it.
3. **Obligation shape.** One obligation per pair: `{obligationId:"BOB-<4 digits>", contract, classId, testMethod, title:"<class title> holds for <contract>", contextIds, reviewChecks, priority}`.
   - `priority` is `"HIGH"` when any of its contexts has a reviewer `CONCERN` or `UNRESOLVED`, an attack path with `VIABLE` or `UNCERTAIN`, an `ATTACK_CONTRADICTS_REVIEW` item, or a gap. Otherwise it is `"NORMAL"`.
4. **Order and numbering.** Sort by priority (HIGH first), then contract, then classId, and number in that order.
5. **Test groups.** Group by contract into `TG-<3 digits>` groups of at most 8 obligations each: `{testGroupId, contract, obligationIds, testMethods, priority}`.
6. **Determinism.** Reversed inputs give the same output.

Replace the T5 stub with this function.

### T6.2 Tests: `packages/github-native-sim/test/adr-baseline-obligations-v1.test.mjs`

1. Zero candidates with authorization and fee surfaces still give `ACCESS_CONTROL` and `ACCOUNTING_MATH` obligations.
2. `REVIEW_ONLY` classes give no obligations.
3. A `NOT_APPLICABLE` claim keeps the obligation.
4. A gap or an attacker finding makes the obligation `HIGH`.
5. 11 obligations for one contract give 2 groups.
6. HIGH obligations come first.
7. Determinism.

**Done when:** green in the T0 workflow.

---

## T7 — Phase 6 owned by the attacker reviewer

**Goal:** in Phase 6 the attacker reviewer (the `reviewer-3L` chat) does three jobs:
1. designs and runs the baseline property tests (Step 4);
2. proves or disproves every material candidate whose Phase 5 result was not decisive (Step 5);
3. records any new vulnerability its tests reveal (Step 5).

All runs go through the existing V7 lane, with at most 3 rounds per test group or candidate. Automation adds a readable assertion ledger to every run. The controller validates outcomes against the ledgers. There is no unguided fuzzing, Medusa or telemetry.

**Read first:**
- `.github/workflows/lite-v7-execution-dispatch-v1.yml`.
- `.github/workflows/audit-controller-execution.yml`: search `Prepare automatic Lite evidence ingestion` and `cp "../.audit-evidence/v7-execution/$V7_REQUEST_ID/controller-evidence.json" "$evidence_rel"`.
- `packages/github-native-sim/src/v7-compact-result-v1.mjs` (whole file).
- `packages/github-native-sim/src/native-fuzz.mjs`: search `export async function runNativeFuzzAnalysis` and `function baseResult`.
- `packages/github-native-sim/src/analysis.mjs`: search `export function parseMedusaOutput` and `parseMedusaCliOutput`.
- `packages/github-native-sim/test/native-fuzz-v1.test.mjs`, `medusa-cli-output-v1.test.mjs` and `medusa-no-tests-real-output-v2.test.mjs` (real output fixtures).
- `packages/github-native-sim/harness-skeletons-v2/README_v2.md`.
- The root `AGENTS.md` harness sections.
- `scripts/lib/lite-phase-prefill-v1.mjs`: search `if(sequence===6){` and `export function validatePhaseScaffold`.
- `packages/github-native-sim/src/lite-boundary-artifacts-v1.mjs`: search `export function renderFinalEvidenceIndexV1`.
- `scripts/lib/lite-master-review-v1.mjs`: search `export function masterWakeMessage`.

### T7.1 Named assertion results and the assertion ledger

**Verified facts (2026-10-12):**
- **Foundry.** The runner runs `forge test --fuzz-runs … --fork-url … --fork-block-number …` in `runNativeFuzzAnalysis` (`packages/github-native-sim/src/native-fuzz.mjs`). It keeps Forge's text output (`rawOutput`). That text already names every test (`[PASS] testName()` / `[FAIL: reason] testName()` under `Ran N tests for <path>:<Contract>`), but the result object never extracts those lines. So today's evidence has only an overall status.
- **Medusa.** `parseMedusaOutput` (`packages/github-native-sim/src/analysis.mjs`) already returns `properties` (named, with `status`) for JSON output. For CLI output it uses `parseMedusaCliOutput`.
- **Ledger location.** No `controller/automation/*/EXECUTION_EVIDENCE_v1.json` exists yet on Audit-Controller `main`, because the Lite dispatch-ingestion path has only been built for Phase 9 and never used. Tests must therefore use fixtures.

**Fix:** make the runner record named results, additively, without changing any tool command, argument or status decision. Then build the ledger from them.

1. **Foundry parser.** In `native-fuzz.mjs`, add and export `parseForgeTestResultsV1(text)`:
   1. Remove ANSI escape codes: `/\u001b\[[0-9;]*m/g`.
   2. Read line by line:
      - `^Ran \d+ tests? for (.+)$` sets the current suite;
      - `^\[PASS\]\s+([A-Za-z0-9_]+\([^)]*\))` adds `{suite, name, status:"PASS"}`;
      - `^\[FAIL(?::\s*(.*?))?\]\s+([A-Za-z0-9_]+\([^)]*\))` adds `{suite, name, status:"FAIL", reason}`;
      - `^\[SKIP[^\]]*\]\s+([A-Za-z0-9_]+\([^)]*\))` adds `{suite, name, status:"SKIPPED"}`.
   3. Return `{parseStatus: tests.length ? "PARSED" : "NONE_FOUND", tests}`.
   4. Never throw.
2. **Attach to every result.** In `runNativeFuzzAnalysis`, when `input.command === 'forge'`, compute `testResults = parseForgeTestResultsV1((rawOutput.stdout ?? '') + '\n' + (rawOutput.stderr ?? ''))` once and add `testResults` to the fields of **every** `baseResult(...)` return. Read `normalizedRaw` to confirm the property names `stdout` and `stderr`. Change nothing else in that function.
3. **Medusa CLI output.** If `parseMedusaCliOutput` does not already return a `properties` array of `{name, status}`, extend it to collect them. Derive the exact line format from the real Medusa 1.5.1 output fixtures in `packages/github-native-sim/test/medusa-cli-output-v1.test.mjs` and `medusa-no-tests-real-output-v2.test.mjs`. Map passing tests to `"passed"` and failing ones to `"failed"`. Do not change how status is decided.
4. **Keep the results in compact evidence.** Open `packages/github-native-sim/src/v7-compact-result-v1.mjs`. If it copies only listed fields into the compact or controller evidence, add `testResults` for the native-fuzz component and `properties` (only `name` and `status`, at most 500 entries) for the Medusa component. Otherwise change nothing.
5. **Ledger.** Create `packages/github-native-sim/src/adr-assertion-ledger-v1.mjs`:
   - It exports `buildAssertionLedgerV1({evidence})`, which returns `{schemaVersion:"curveyield-assertion-ledger-v1", parseStatus, tool, toolInvoked, executedCalls, tests:[{name, status:"PASS"|"FAIL"|"SKIPPED", reason}]}`.
   - Gather named results from every native-fuzz component's `testResults.tests`, and from every Medusa component's `properties`: `failed` becomes `FAIL`; `passed`, `completed` and `unfalsified` become `PASS`.
   - For Forge tests, `name` is `"<suite>::<test name>"`. For Medusa, it is the property name as given.
   - `toolInvoked` comes from the component's existing `toolInvoked` field, or `null` if absent.
   - `parseStatus` is `"PARSED"` when at least one named result exists. Otherwise it is `"UNPARSEABLE"`.
   - It never throws.
   - CLI: `--evidence <path> --out <path>`. On any error it writes `{parseStatus:"UNPARSEABLE", error}` and exits 0.
6. **Ingestion hook.** Unchanged: in `audit-controller-execution.yml`, step "Prepare automatic Lite evidence ingestion", directly after the line copying `controller-evidence.json` to `"$evidence_rel"`, add:

```bash
node "$GITHUB_WORKSPACE/packages/github-native-sim/src/adr-assertion-ledger-v1.mjs" --evidence "$evidence_rel" --out "$evidence_dir/ASSERTION_LEDGER_v1.json" || true
```

   Include that file in the step's `git add` if the step lists paths explicitly.
6a. **Authorization for this task.**
   - The `audit-controller-execution.yml` ingestion hook in item 6 is an approved, additive edit to a runner-listed file (00 §4 rule 8a). Record it in the PR under "Runner-listed edits".
   - `native-fuzz-v1.test.mjs` has four expectations that are already stale on `main`, because the runner already rejects output without a successful Forge suite (`NO_SUCCESSFUL_TEST_EXECUTION`). The four tests are:
     - successful native fuzz;
     - Forge failed-test output;
     - configured native-fuzz limitation;
     - non-recoverable execution failure.
   - Correct them under 00 §4 rule 8b:
     - success cases use a real Forge suite block and expect `completed`;
     - failure cases expect the status `main` actually returns today;
     - keep every negative case.
   - Do not change `runNativeFuzzAnalysis` status logic.

7. **Runner manifest.** Add the step `npm run v7:manifest -- --check` to the T0 workflow's unit job. These edits are additive result fields and should not change the policy-derived manifest. If the check fails, record a `## Blocked question` with the exact diff; do not edit the manifest by hand.
8. **Harness naming convention** (also written into `AGENT_GUIDED_TESTING.md`; see T8 Appendix C4), so outcomes can be matched to obligations:
   - one assertion per test function or Medusa property;
   - baseline tests: `test_prop_<obligationId>_<short>`;
   - candidate tests: `test_attack_<n>_<short>` and `test_control_<n>_<short>`;
   - Medusa: `property_<obligationId>_<short>`.
   - The reviewer cites these exact names (with the `<suite>::` prefix for Forge) in `assertionNames`, `attackAssertionNames` and `controlAssertionNames`.

### T7.2 Dispatch lane: allow Phase 6 requests (`lite-v7-execution-dispatch-v1.yml`)

Keep the Phase 9 behavior byte-for-byte. Add:

1. In the request `jq` admission, also accept `.phaseSequence==6`.
2. For phase 6, require the request path to match `campaigns/*/controller/phase6-tests/*/*.json`, where the folder name matches `^(TG-[0-9]{3}|CP-[A-Za-z0-9._-]+)$`:
   - `TG-` folders hold baseline test groups;
   - `CP-<candidateKey>` folders hold candidate proof work.
3. In the binding step (rename it to `Verify exact campaign/request binding`), for phase 6 require:
   - the V7 request `.phaseId == "phase-6"`;
   - `currentAssignment.phaseSequence == 6`;
   - the path inside `"$workspace"/controller/phase6-tests/`.
4. **Round limit.** If the request's folder holds more than 3 `*.json` files, fail with `::error::ROUND_LIMIT_REACHED for <folder>: record NOT_ACHIEVED (Step 4) or INCONCLUSIVE (Step 5) in the Phase 6 work form.`
5. Change the summary text to `Phase-6 or Phase-9`.

### T7.3 Phase 6 prefill and validation (v12 only; T8 Appendix B defines Steps 4 and 5)

1. **Step 4 prefill:** one `baselineTestRecords` row per test group from `work/phase-06/BASELINE_OBLIGATIONS_v1.json`.
   - Controller fields: `testGroupId`, `contract`, `obligationIds`, `obligationsDetail` and `requestDirectory: "controller/phase6-tests/<testGroupId>/"`.
   - Reviewer fields: `harnessDesign`, `dispatchRounds`, `requestPaths`, `obligationOutcomes` and `limitations`, set to `"<REQUIRED>"`.
   - With zero groups, set `["NONE_IDENTIFIED"]`.
2. **Step 5 prefill:** one `candidateProofRecords` row per material candidate (Phase 4 step 3 `candidateRecords` plus Phase 5 step 2 `newCandidateRecords`).
   - Controller fields:
     - `candidateKey`;
     - `sourceAnchor`;
     - `phase5Result`: `REPRODUCED`, `NOT_REPRODUCED`, `INCONCLUSIVE`, `EXECUTION_FAILED` or `NOT_EXECUTED`, read from the Phase 5 boundary target results the controller already renders into `LITE_TARGETED_TEST_MATRIX.md` (search `renderTargetedTestMatrixV1`);
     - `requestDirectory: "controller/phase6-tests/CP-<safe candidateKey>/"`.
   - Reviewer fields: `verdict`, `harnessDesign`, `dispatchRounds`, `requestPaths`, `ledgerRef`, `attackAssertionNames`, `controlAssertionNames` and `reasoning`.
   - Also prefill `newCandidateRecords` as `["NONE_IDENTIFIED"]`. The attacker replaces it when it finds something new.
3. **Step 4 validation**, per row:
   - `dispatchRounds` is an integer 0–3 and equals the number of `*.json` files in `requestDirectory`;
   - `requestPaths` equals that sorted list, or `["NONE_IDENTIFIED"]` when 0;
   - `harnessDesign` is non-blank when `dispatchRounds > 0`;
   - `obligationOutcomes` covers exactly `obligationIds`, each as `{obligationId, outcome, ledgerRef, assertionNames, reasonCode, note, anchors}`.
   - Rules per outcome:

     | Outcome | Requirement |
     |---|---|
     | `PASSED` | Ledger `PARSED`, `toolInvoked:true`, and every named assertion `PASS` |
     | `PROPERTY_FAILED` | Same ledger checks, and at least one named assertion `FAIL` |
     | `NOT_APPLICABLE_CONFIRMED` | Non-blank `note` and at least one anchor |
     | `INCONCLUSIVE` | Non-blank `note` |
     | `NOT_ACHIEVED` | Non-blank `note`, and `reasonCode` is `ROUNDS_EXHAUSTED` (requires `dispatchRounds===3`), `NO_EXECUTABLE_SETUP` or `TOOL_UNSUPPORTED` |

4. **Step 5 validation**, per row (`verdict` ∈ {`CONFIRMED`, `DISPROVEN`, `INCONCLUSIVE`, `PHASE5_DECISIVE`}):

   | Verdict | Requirement |
   |---|---|
   | `PHASE5_DECISIVE` | `phase5Result === "REPRODUCED"` and `reasoning` non-blank |
   | `CONFIRMED` | `ledgerRef` points to a Phase 6 ledger (`PARSED`, `toolInvoked:true`); at least one `attackAssertionNames` entry is `FAIL` (the security property is violated); every `controlAssertionNames` entry is `PASS` (the healthy path works) |
   | `DISPROVEN` | Same ledger checks; every `attackAssertionNames` entry is `PASS` (the attack is blocked) and every `controlAssertionNames` entry is `PASS`; `reasoning` names the blocking control with an anchor |
   | `INCONCLUSIVE` | Non-blank `reasoning` stating the missing proof |

   - `dispatchRounds` and `requestPaths` follow the same rules as Step 4.
   - **`NOT_REPRODUCED` from Phase 5 alone is never `DISPROVEN`.**
5. **New candidates.** Every `newCandidateRecords` item has `{tempKey: "P6-NEW-<3 digits>", title, classId, description, anchors, ledgerRef}`. `ledgerRef` may be `"NONE_IDENTIFIED"` when the finding came from reading the code during testing.
6. **Phase 8 linkage.** When the policy is active, Phase 8 step 2 `candidateValidations` must contain a `candidateKey` for:
   - every Step 4 `PROPERTY_FAILED`, as `P6-PROP-<testGroupId>-<obligationId>`;
   - every Step 5 `CONFIRMED` or `INCONCLUSIVE` candidate (its own key);
   - every `P6-NEW-*` key.
   - A missing key is a deficiency. Read the Phase 6 data with `canonicalFor(root, campaignPath, 6)`.
7. Each failure is a normal Phase 6 or Phase 8 deficiency, which means rework by the same reviewer.

### T7.4 Coverage matrix, Phase 10 and the master (v12 only)

1. **Coverage matrix.** Before the call to `renderFinalEvidenceIndexV1(`:
   - build `buildCoverageMatrixV1({inventory, taxonomy, discoveryState, phase6Results})`, where `phase6Results` maps each `obligationId` to its Step 4 outcome;
   - write `work/phase-10/COVERAGE_MATRIX_v1.json`;
   - append `## Coverage matrix` and `renderCoverageMarkdownV1(matrix)` to the evidence index.
2. **Phase 10 validation.** The step 3 verdict text must contain the exact label from the matrix: `FULL_COVERAGE` or `PARTIAL_COVERAGE`.
3. **Master wake.** In `masterWakeMessage`, when the policy is active, append: `As challenger, review every item in <blob URL of DISCOVERY_SUMMARY_v1.json>: attacker findings and contradictions, unresolved checks, not-applicable claims and coverage gaps. Amend reviewer work or order targeted tests through the existing directive; accept a gap only with a stated reason.` If `COVERAGE_MATRIX_v1.json` exists, add its URL too.

### T7.5 Tests

1. `packages/github-native-sim/test/adr-assertion-ledger-v1.test.mjs`:
   - `parseForgeTestResultsV1` on Forge text containing two suites, ANSI colour codes, fuzz-run suffixes, one `[FAIL: reason]` and one `[SKIP]` returns every test with the right suite and status;
   - text with no test lines gives `NONE_FOUND`;
   - `runNativeFuzzAnalysis` with a stub `runCommand` returns `testResults` on both the success and the failure path, while status values are unchanged from today (compare against the existing `native-fuzz-v1` expectations);
   - Medusa CLI fixture output gives named `properties`;
   - compact evidence built from these results still contains `testResults` and `properties`;
   - `buildAssertionLedgerV1` on that evidence gives `PARSED` with `<suite>::<name>` entries;
   - evidence without named results gives `UNPARSEABLE`;
   - the CLI with a bad path writes `UNPARSEABLE` and exits 0.
   - **Regression:** add `packages/github-native-sim/test/native-fuzz-v1.test.mjs` and the Medusa CLI tests to the T0 regression list.
2. `packages/github-native-sim/test/adr-phase6-validation-v1.test.mjs`. Each case gives a deficiency unless it says "valid":
   - Step 4: `PASSED` with a valid ledger is valid;
   - Step 4: `PASSED` with an `UNPARSEABLE` ledger;
   - Step 4: `PASSED` with `toolInvoked:null`;
   - Step 4: `NOT_ACHIEVED`/`ROUNDS_EXHAUSTED` with 2 rounds;
   - Step 4: `NOT_APPLICABLE_CONFIRMED` without anchors;
   - Step 5: `DISPROVEN` resting only on a Phase 5 `NOT_REPRODUCED`;
   - Step 5: `CONFIRMED` with a failing control assertion;
   - Step 5: `DISPROVEN` with passing attack and control assertions and an anchored blocking control is valid;
   - Step 5: a `P6-NEW` key missing from Phase 8;
   - a mismatch in the request-file count;
   - a v11 Phase 6 form is unaffected (no deficiency from these rules).
3. `packages/github-native-sim/test/adr-dispatch-workflow-v1.test.mjs`: the phase-9 pattern is still present, `controller/phase6-tests/` is present, and `ROUND_LIMIT_REACHED` is present.

**Done when:** all are green in the T0 workflow and the regression step is green.
