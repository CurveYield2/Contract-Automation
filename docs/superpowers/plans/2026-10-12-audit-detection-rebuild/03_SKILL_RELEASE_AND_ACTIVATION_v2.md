# Audit Detection Rebuild v2 — T8–T10: Skill v12, Frozen v11, Activation and Qualification

> **For the implementing agent:** `00_BUILD_CONTRACT_v2.md` applies in full. T0–T7 must be merged before T8. Follow the release order in 00 §6 exactly; it is what prevents campaigns from pointing at missing files.

Supersedes `03_QUALIFICATION_AND_ROLLOUT_v1.md` (removed; Git history keeps it). The v1 rule "keep the new policy disabled until qualified" is replaced by D8. The v1 step "run the disclosed original benchmark" is deleted (D9).

---

## T8 — Author skill v12 in a staging folder

**Goal:** a complete `Audit_Litemode_v12` package that passes the authority/automation sync validator. It is placed outside `Audit Skill - Current Authority`, so nothing changes for live or new campaigns yet.

This task has two PRs: first Contract-Automation, then Audit-Controller.

### T8.1 Contract-Automation PR (`upgrade/adr-T8-validator`)

1. In `scripts/validate-lite-authority-automation-sync-v1.mjs`:
   1. Add an optional argument `--authority-root <repo-relative path>`. When it is given, validate that package directory instead of discovering the single package (search `need(packages.length===1`). When it is not given, keep today's behavior.
   2. Delete the check containing `PHASE0_MEDUSA_CALL_LIMIT_V1=125000`.
   3. Run the validator against current main through the T0 job (next step). If any other check fails only because it requires retired Phase 0 Medusa or telemetry text or artifacts, delete that check too and list each deleted check in the PR.
   4. Do not weaken any other check.
2. At the marker `# ADR-EXTRA-CHECKS` in `scripts/adr-audit-controller-checks-v1.sh`, add the following (keep the T0 "no new failures" rule: it fails only if target fails and main passes):
   1. Read the optional file `process/adr-verify/AUTHORITY_ROOT_v1.txt`. Create it in this PR containing an empty line.
   2. For both checkouts, run `node scripts/validate-lite-authority-automation-sync-v1.mjs --controller-root <checkout> --automation-root .`. For the target checkout only, append `--authority-root <value>` when the file is non-empty.
   3. Fail if the target fails while main passes.
3. Done when the T0 workflow is green with both ref files at their defaults (`main` and empty).

### T8.2 Audit-Controller PR (`upgrade/adr-T8-skill-v12`)

1. Copy the whole directory `Audit Skill - Current Authority/Audit_Litemode_v11/` to `audit-process/v7/staging-authority/Audit_Litemode_v12/`. Copy every file byte-for-byte first, then edit only as listed below.
2. Apply **every** edit in Appendices A–E to the copy. Do not edit any file in `Audit Skill - Current Authority/`.
3. `MANIFEST.json` in the copy:
   - set `"schemaVersion": "audit-litemode-v12-manifest-v1"`, `"release": "Audit_Litemode_v12"` and `"packageRevision": "v12"`;
   - add `"detectionPolicy": "audit-detection-rebuild-v1"` and `"taxonomyVersion": "curveyield-defect-taxonomy-v1"`;
   - leave `files` as copied. The existing ZIP-sync workflow regenerates `files` after the swap in T9.
4. Verify:
   1. Open a Contract-Automation PR `upgrade/adr-T8-check` that only sets `process/adr-verify/AUDIT_CONTROLLER_REF_v1.txt` to `upgrade/adr-T8-skill-v12` and `process/adr-verify/AUTHORITY_ROOT_v1.txt` to `audit-process/v7/staging-authority/Audit_Litemode_v12`.
   2. The `audit-controller-checks` job must be green.
   3. Fix the AC branch until it is.
   4. Merge the AC PR.
   5. In the check PR, set the ref file back to `main` and keep the authority-root line. The job then validates the staging package on main. Merge the check PR once it is green.

**Done when:** the staging package is on AC `main`, the validator passes on it, and `Audit Skill - Current Authority` is unchanged.

---

## T9 — Frozen-authority registry, v11 freeze and the v12 swap

**Goal:**
- Campaigns bound to v10.3 or v11 keep resolving their authority files after v11 leaves `Audit Skill - Current Authority`.
- Then v12 becomes the current authority.

### T9.1 Contract-Automation PR (`upgrade/adr-T9-frozen-resolver`)

1. **Create `packages/github-native-sim/src/adr-frozen-authority-v1.mjs`.**
   - `loadFrozenAuthorityRegistryV1(root)` reads `audit-process/v7/frozen-authorities/FROZEN_AUTHORITY_REGISTRY_v1.json` from the Audit-Controller checkout `root`. If the file is missing, it returns the built-in default containing exactly the v10.3 entry, using the constants currently in `scripts/lib/lite-phase-work-v1.mjs` (search `LEGACY_V103_`).
   - `resolveFrozenAuthorityFileV1(root, rel)`:
     - for the registry entry whose `logicalRoot` equals `rel` or is a prefix of `rel + '/'`, and only when the logical file does not exist;
     - verify the frozen `SKILL.md` sha256, the frozen `MANIFEST.json` sha256, and the requested file's bytes and sha256 against the manifest `files` entry, with exactly the algorithm of the current `frozenV103File`;
     - return the absolute frozen path, or `null` when no entry matches;
     - throw the same error messages as today on any digest mismatch.
   - `authorityLinkPathV1(root, rel)` returns the frozen repository-relative path when the logical path does not exist and an entry matches; otherwise it returns `rel`.
2. **`scripts/lib/lite-phase-work-v1.mjs`:** in `requiredFile`, replace `frozenV103File(root,rel)` with `resolveFrozenAuthorityFileV1(root,rel)`. Delete `frozenV103File` and the `LEGACY_V103_*` constants, which now live in the default registry. `requiredFile` behavior for every existing path must be identical.
3. **`scripts/prepare-lite-assignment-successor-v2.mjs`:** replace the `authorityLinkPath` arrow function body with a call to `authorityLinkPathV1(root, p)`. Delete `legacyLogicalRoot` and `frozenAuthorityRoot`.
4. **`scripts/lib/lite-master-review-v1.mjs`:** replace `const isV11=/Audit_Litemode_v11(?:\/|$)/.test(String(authorityRoot??''));` with `const rev=Number((String(authorityRoot??'').match(/Audit_Litemode_v(\d+)(?:\.\d+)?(?:\/|$)/)||[])[1]??0); const isV11OrLater=rev>=11;` and use `isV11OrLater` in the next line. Do not change the sealed-rework v10.3 checks.
5. **`scripts/lib/lite-post-completion-followup-v1.mjs`:** replace the exact comparison with `'Audit Skill - Current Authority/Audit_Litemode_v11/SKILL.md'` by the regex test `/^Audit Skill - Current Authority\/Audit_Litemode_v(1[1-9]|[2-9][0-9])\/SKILL\.md$/`.
6. **`.github/workflows/lite-phase-work-packet-controller-v1.yml`:**
   - search `guide='Audit Skill - Current Authority/Audit_Litemode_v11/master-review/TARGETED_TEST_DIRECTIVE_v1.md'`;
   - make the controller print an extra output `authorityLinkRoot`, equal to `authorityLinkPathV1(root, authorityRoot)`, for every status;
   - read it in the controller step outputs as `authority_link_root`;
   - set `guide="${{ steps.controller.outputs.authority_link_root }}/master-review/TARGETED_TEST_DIRECTIVE_v1.md"`.
7. **`.github/workflows/browser-agent-reviewer-repair-v1.yml`:** search `Audit_Litemode_v11`. Replace each occurrence with a value resolved at runtime: the single package directory under `Audit Skill - Current Authority` for new wakes, or the campaign's bound authority link path when the step has the campaign. Read the surrounding step to decide which. List both replacements in the PR.
8. **Create `scripts/adr-check-frozen-authorities-v1.mjs`** (CLI `--controller-root <dir>`). For every registry entry it verifies:
   - the `SKILL.md` and `MANIFEST.json` digests;
   - every `files` entry exists with matching bytes and sha256;
   - every file in the frozen directory except `MANIFEST.json` is listed.
   - It exits non-zero with a list of problems.
   - Add a call to it at the `# ADR-EXTRA-CHECKS` marker for the target checkout. It is skipped when the registry file is absent.
9. **Tests** — `packages/github-native-sim/test/adr-frozen-authority-v1.test.mjs`, using temporary directories:
   - a v10.3 logical path resolves through the built-in default;
   - a v11 logical path resolves through a registry entry;
   - a tampered frozen file throws;
   - an existing logical path is returned unchanged;
   - `authorityLinkPathV1` maps only missing logical paths;
   - `masterReviewRequired` returns true for v11 and v12 roots that have a valid `masterReview` and throws for them without one, exactly like v11 today.

### T9.2 Audit-Controller PR (`upgrade/adr-T9-freeze-v11`)

v11 stays in Current Authority in this PR.

1. Copy `Audit Skill - Current Authority/Audit_Litemode_v11/` byte-for-byte to `audit-process/v7/frozen-authorities/Audit_Litemode_v11/`.
2. Create `audit-process/v7/frozen-authorities/FROZEN_AUTHORITY_REGISTRY_v1.json`:

```json
{
  "schemaVersion": "curveyield-frozen-authority-registry-v1",
  "entries": [
    {"release": "Audit_Litemode_v10.3",
     "logicalRoot": "Audit Skill - Current Authority/Audit_Litemode_v10.3",
     "frozenRoot": "audit-process/v7/frozen-authorities/Audit_Litemode_v10.3",
     "skillSha256": "bdb90107ea50580e67be91440ce47087de570c4f54b8474c5a3eb852af95ea27",
     "manifestSha256": "846be5f90d6e00757b817b1218dfabeb2aa4dff6c92b8e9ff47335d2db83703a"},
    {"release": "Audit_Litemode_v11",
     "logicalRoot": "Audit Skill - Current Authority/Audit_Litemode_v11",
     "frozenRoot": "audit-process/v7/frozen-authorities/Audit_Litemode_v11",
     "skillSha256": "<sha256 of the copied SKILL.md>",
     "manifestSha256": "<sha256 of the copied MANIFEST.json>"}
  ]
}
```

   Get the two v11 digests from the T0 job log: the T9.1 checker prints the actual digests when a placeholder does not match. Run the job once with placeholders, copy the printed values, and run it again.
3. Verify with a Contract-Automation check PR setting the ref file to `upgrade/adr-T9-freeze-v11`. Both the frozen-authority checker and the "no new failures" checks must be green. Then merge the AC PR and set the ref back to `main` in the check PR.

### T9.3 Swap readiness test (Contract-Automation PR `upgrade/adr-T9-swap-check`)

1. Create `packages/github-native-sim/test/adr-real-authority-swap-v1.test.mjs`. It runs **only** when the environment variable `ADR_SWAPPED_CONTROLLER_ROOT` is set, and is skipped otherwise. It:
   1. asserts that `Audit Skill - Current Authority` contains exactly one directory with `SKILL.md`, that it is `Audit_Litemode_v12`, and that its `MANIFEST.json` has `detectionPolicy` (the same rule `run-v1.sh` uses);
   2. calls `loadPhaseSchema` for phases 1–10 on the v12 root;
   3. for every file in `Audit Campaign Directory/campaigns/*.json`, follows `lastSealedReceiptPath` → `authorityRootFromReceipt`, then calls `loadPhaseSchema` for the campaign's current or last phase and `requiredFile` on its `SKILL.md`, all of which must resolve. In this sparse checkout, read only the receipt files the directory names (fetch them with `git show <ref>:<path>`).
2. At the `# ADR-EXTRA-CHECKS` marker, add: if the target ref name ends with `-swap`:
   1. copy the target checkout to `.ac-swapped`;
   2. run `node --test packages/github-native-sim/test/adr-real-authority-swap-v1.test.mjs` with `ADR_SWAPPED_CONTROLLER_ROOT=.ac-swapped`;
   3. fail if the test fails.

### T9.4 Audit-Controller swap PR (`upgrade/adr-T9-swap`)

1. Run `git mv "audit-process/v7/staging-authority/Audit_Litemode_v12" "Audit Skill - Current Authority/Audit_Litemode_v12"`.
2. Run `git rm -r "Audit Skill - Current Authority/Audit_Litemode_v11"`. Leave `Audit_Litemode_v11.zip` in place; the sync deletes stale ZIPs.
3. In `test/lite-semantic-automation-policy.test.mjs`, search `assert.equal(manifest.release,'Audit_Litemode_v11')`. Replace the hard-coded release with: find the single package directory, then assert `manifest.release` equals its directory name.
4. In `README.md`, under "Primary Lite methodology authority", replace the sentence that claims the pointer binds a ZIP path and SHA-256 with: "The pointer names the stable authority folder; the single unpacked package inside it is resolved at runtime and its release, revision and digest are recorded in each campaign."
5. Verify with the Contract-Automation check PR, setting the ref file to `upgrade/adr-T9-swap` (the name ends with `-swap`, so T9.3 runs). Everything must be green.
6. Merge the AC swap PR. Then:
   1. set the ref file back to `main` in the check PR and wait for green;
   2. merge the check PR;
   3. run the `Sync Lite Authority ZIP v2` workflow with `workflow_dispatch`. If you cannot dispatch workflows, wait for its daily 06:23 UTC run;
   4. confirm the commit `chore(authority): sync current Lite authority package and zip` added `Audit_Litemode_v12.zip`, removed `Audit_Litemode_v11.zip` and filled `MANIFEST.json` `files`.
7. **Done when:**
   - the sync commit exists;
   - the T0 workflow on `main` is green;
   - the v16 r4 directory entry still resolves through T9.3's checks (it is bound to v11 and now resolves to the frozen copy).

Do not initialize any campaign before this point.

---

## T10 — Qualification scorer, runner-pin documentation, rejection matrix and close-out

### T10.1 Detection qualification scorer (non-blocking measurement tool)

1. **Create `packages/github-native-sim/src/adr-detection-qualification-v1.mjs`** exporting `scoreQualificationV1({truth, findings, adjudications})`.
   - `truth` rows are `{caseId, kind:"defect"|"decoy"|"clean_control", severity, classId, contract}`.
   - `findings` rows are `{findingId, caseRefs, severity}`.
   - `adjudications` rows are `{caseId, findingId, match:"MATCH"|"NO_MATCH", severityReadjudicated:boolean, reason}`.
   - It returns:
     - `recall` overall and by `severity`, `classId` and `contract`, each `{matched, total}`, or `NOT_EVALUATED` when `total` is 0;
     - `precision`;
     - `decoyHits`;
     - `cleanControlCriticalHighFalsePositives`;
     - `severityAgreement`;
     - `criticalHighMisses`.
   - **Severity rule:** a Critical or High defect matched by a finding rated below High counts in `criticalHighMisses`, unless the adjudication has `severityReadjudicated:true` with a non-blank reason.
   - Duplicate findings for one case count once.
   - A title match without an adjudication `MATCH` is not a match.
2. **Tests:** `packages/github-native-sim/test/adr-detection-qualification-v1.test.mjs`. Use synthetic data only; never data from a real campaign. Cover:
   - each rule above;
   - zero denominators give `NOT_EVALUATED`;
   - a decoy hit lowers precision.
3. **Qualification status** is a Contract-Automation file `process/adr-qualification/QUALIFICATION_STATUS_v1.json`, created in this task with `{"status":"NOT_YET_QUALIFIED","updatedAt":"<now>"}`.
   - In the T7.4 coverage block, the controller appends the line `Detection qualification status: <status>` to the Phase 10 evidence index. The file is read from the Contract-Automation checkout.
   - Only the owner changes this file, after running a qualification corpus.
   - Answer keys must never be stored in Contract-Automation (public logs and artifacts) or Audit-Controller (reviewers can read it). The owner keeps them in a separate private location and runs the scorer locally or in a private runner.
   - This task does not build a corpus.

### T10.2 Runner-pin documentation alignment

The full V7 infrastructure qualification was retired on 2026-10-11 (see `.github/workflows/README.md`), and `process/V7_QUALIFICATION_STATUS.json` is legacy. Align the documents with that fact. Change text only.

1. **Contract-Automation `AGENTS.md`, section "V7 qualification".** Replace the paragraph naming `.github/workflows/v7-execution-infrastructure-qualification.yml` with: "The repository-wide full V7 qualification workflow was retired on 2026-10-11 and preserved in CurveYield2/archive. Lite execution evidence records the exact runner commit of each run in EXECUTION_EVIDENCE_v1.json; Lite campaigns do not require a qualification rebind. Do not restore the archived suite."
2. **Contract-Automation `AGENTS.md`, list "Canonical V7 control surface".** Remove the qualification workflow line.
3. **Audit-Controller `AGENTS.md`, section "V7 qualified runner rebind".** Add as its first sentence: "Applies only to Full V7 (v26) campaigns. Lite campaigns bind the exact runner commit recorded in each execution evidence file and need no rebind."
4. **Audit-Controller `docs/agent-guides/V7_RUNNER_REBIND_PROTOCOL_v1.md`.** Add the same sentence under "## Purpose".

### T10.3 Rejection-matrix test

Create `packages/github-native-sim/test/adr-rejection-matrix-v1.test.mjs`. It has one `test()` per row below. Each calls the named module function with a minimal synthetic input and asserts the result.

| Row | Function | Expected |
|---|---|---|
| 30 contracts, 2 accepted lane assignments, rest invalid 3× | `advanceDiscoveryV1` loop | 28 contracts' contexts in `gaps`; summary label `PARTIAL_COVERAGE`; campaign reaches Phase 4 (not stuck) |
| Internal/private helper exists | `buildReviewInventoryV1` | helper is a context with triggers |
| Inherited base function in 2 contracts | `buildReviewInventoryV1` | one context, `effectiveIn` has both |
| Same boilerplate evidence in 4 contexts | `validateLaneSubmissionV1` | `REPEATED_EVIDENCE` |
| Anchor outside context | `validateLaneSubmissionV1` | `ANCHOR_OUT_OF_RANGE` |
| CONCERN without candidate | `validateLaneSubmissionV1` | `CONCERN_WITHOUT_CANDIDATE` |
| Lane B packet | `buildAssignmentPacketV1` | no hypotheses path, no lane A path |
| Lanes disagree, challenger says AGREE | `validateChallengeSubmissionV1` | `LANE_COMPARISON_WRONG` |
| Stale assignment request | `advanceDiscoveryV1` | `DISCOVERY_STALE_REQUEST`, no state change |
| Same submission bytes resubmitted | `advanceDiscoveryV1` | attempts unchanged |
| Zero candidates, auth + fee surfaces | `deriveBaselineObligationsV1` | `ACCESS_CONTROL` and `ACCOUNTING_MATH` obligations |
| N/A claimed but not accepted | `deriveBaselineObligationsV1` | obligation kept |
| Gap context | `deriveBaselineObligationsV1` | obligation kept, `HIGH` |
| PASSED with unparseable ledger | Phase 6 validation | deficiency |
| PASSED with `toolInvoked:null` | Phase 6 validation | deficiency |
| NOT_ACHIEVED/ROUNDS_EXHAUSTED with 2 rounds | Phase 6 validation | deficiency |
| PROPERTY_FAILED absent from Phase 8 | Phase 8 validation | deficiency |
| Verdict text without coverage label | Phase 10 validation | deficiency |
| v11-bound campaign at Phase 3 PASS | controller | same-reviewer Phase 4, no discovery files |
| Phase 0 inventory build throws | Phase 0 block | inventory written with `complete:false`, Phase 0 not failed |
| Frozen v11 file tampered | `resolveFrozenAuthorityFileV1` | throws |
| Critical defect found but rated Medium | `scoreQualificationV1` | counted in `criticalHighMisses` |

### T10.4 Close-out

1. Confirm the 00 §9 done condition item by item in the T10 PR description, with links.
2. Delete `process/adr-verify/AUTHORITY_ROOT_v1.txt` and its use at the marker, since staging validation is no longer needed after the swap. Keep `AUDIT_CONTROLLER_REF_v1.txt` set to `main`.
3. Stop. Do not open follow-up tasks.

---

## Appendix A — Phase 4 (v12) files

**A1. `phases/phase-4/PHASE_04_SCHEMA_v1.json`.** Keep every key from v11 except the following changes:
- `"title": "Lite Combined Phases 2-5 - Discovery Reconciliation and Specialist Review"`.
- Replace `actions.step-1` with:

```json
"step-1": {
  "title": "Reconcile discovery lane, challenge and integration results",
  "formPath": "work/phase-04/PHASE_04_WORK_FORM_v1.json",
  "section": "Step 1 Input — Reconcile discovery lane, challenge and integration results",
  "fields": [
    {
      "name": "discoveryReconciliationRecords",
      "type": "REQUIRED_RECORD_LIST",
      "consumers": ["phase-5", "phase-6", "phase-8"],
      "itemRequiredFields": ["recordKey", "contextIds", "sourceAnchor", "origin", "laneAFinding", "laneBFinding", "challengeDecision", "reconciliation", "disposition", "candidateTempKeyOrNone", "rationale"],
      "itemFieldAllowedValues": {
        "origin": ["LANE_CANDIDATE", "LANE_UNRESOLVED", "DISPUTED_ROW", "LANE_DISAGREEMENT", "INTEGRATION_CONCERN", "COVERAGE_GAP"],
        "disposition": ["CANDIDATE_CREATED", "RESOLVED_NO_ISSUE", "COVERAGE_GAP_ACCEPTED"]
      },
      "controllerPrefillFields": ["recordKey", "contextIds", "sourceAnchor", "origin", "laneAFinding", "laneBFinding", "challengeDecision"]
    }
  ],
  "controllerPrefillFields": ["recordKey", "contextIds", "sourceAnchor", "origin", "laneAFinding", "laneBFinding", "challengeDecision"]
}
```

- In `derivedOutputs[0].selectors` and `bookkeepingMappings.graphRecordPaths`, replace `actions.step-1.outputs.sourceReviewRecords` with `actions.step-1.outputs.discoveryReconciliationRecords`.
- In `controllerAutomationInputs`, replace the entry named `expectedSourceReviewKeys` with `{"name": "expectedDiscoveryRecordKeys", "type": "CONTROLLER_PREFILLED_READ_ONLY_LIST", "consumers": ["phase-4-controller-validation"], "source": "controller discovery summary"}`.

**A2. `phases/phase-4/PHASE_CONTRACT.json`.**
- Set `phase.title` to the A1 title.
- Replace step 1 with `{"step": 1, "action": "Reconcile discovery lane, challenge and integration results", "instruction": "Disposition every controller-prefilled reconciliation record: create a candidate, resolve it with source-anchored reasoning, or accept a coverage gap only for COVERAGE_GAP records. Do not re-review accepted contexts.", "condition": null, "outputDestination": {"document": "work/phase-04/PHASE_04_WORK_FORM_v1.json", "section": "Step 1 Input — Reconcile discovery lane, challenge and integration results", "schema": "phases/phase-4/PHASE_04_SCHEMA_v1.json#actions.step-1", "requiredFields": ["discoveryReconciliationRecords"]}, "resources": ["./PHASE_04_SCHEMA_v1.json", "./resources/PHASE_04_WORK_FORM_TEMPLATE_v1.json", "../../discovery/RECONCILIATION_GUIDE.md"]}`.
- In `inputs.required`, replace the source-review-rows item with "Controller-generated discovery summary (lane A, lane B, challenge and integration results with gaps)".

**A3. `phases/phase-4/resources/PHASE_04_WORK_FORM_TEMPLATE_v1.json`.** Replace `actions.step-1` with `{"section": "Step 1 Input — Reconcile discovery lane, challenge and integration results", "outputs": {"discoveryReconciliationRecords": [{"recordKey": "<REQUIRED>", "contextIds": "<REQUIRED>", "sourceAnchor": "<REQUIRED>", "origin": "<REQUIRED>", "laneAFinding": "<REQUIRED>", "laneBFinding": "<REQUIRED>", "challengeDecision": "<REQUIRED>", "reconciliation": "<REQUIRED>", "disposition": "<REQUIRED>", "candidateTempKeyOrNone": "<REQUIRED>", "rationale": "<REQUIRED>"}]}}`.

**A4. `phases/phase-4/START_HERE.md`.**
- Replace the "Step 1" section with:

> ## Step 1 — Reconcile discovery results
> Before you were woken, two independent discovery lanes reviewed every in-scope context against the defect taxonomy, a challenger checked both, and the challenger reviewed every integration obligation. Read `derived` input `work/phase-04/discovery/DISCOVERY_SUMMARY_v1.json`. The controller has prefilled one record for every lane candidate, unresolved check, dispute, lane disagreement, integration concern and coverage gap. For each record: read the cited source, decide, and fill `reconciliation`, `disposition`, `candidateTempKeyOrNone` and `rationale`. `CANDIDATE_CREATED` requires a matching Step 3 candidate. `RESOLVED_NO_ISSUE` requires source anchors (`path.sol:L<n>`) in `rationale`. `COVERAGE_GAP_ACCEPTED` is allowed only for `COVERAGE_GAP` records, and gaps stay visible in the final report. Do not re-review contexts the challenger accepted without dispute.

- Delete the file `phases/phase-4/resources/PHASE4_MANUAL_COVERAGE_CANDIDATE_REGISTRY.md`. Its bookkeeping instructions contradict the controller-owned bookkeeping rule.

## Appendix B — Phase 6 (v12) files

**B1. `phases/phase-6/PHASE_06_SCHEMA_v1.json`.**
- Add `actions.step-4`:

```json
"step-4": {
  "title": "Agent-guided baseline testing",
  "formPath": "work/phase-06/PHASE_06_WORK_FORM_v1.json",
  "section": "Step 4 Input — Agent-guided baseline testing",
  "fields": [
    {
      "name": "baselineTestRecords",
      "type": "REQUIRED_RECORD_LIST",
      "consumers": ["phase-8", "phase-10"],
      "itemRequiredFields": ["testGroupId", "contract", "obligationIds", "obligationsDetail", "requestDirectory", "harnessDesign", "dispatchRounds", "requestPaths", "obligationOutcomes", "limitations"],
      "controllerPrefillFields": ["testGroupId", "contract", "obligationIds", "obligationsDetail", "requestDirectory"]
    }
  ],
  "controllerPrefillFields": ["testGroupId", "contract", "obligationIds", "obligationsDetail", "requestDirectory"]
}
```

- Add `"actions.step-4.outputs.baselineTestRecords"` to the selectors of the derived output whose path is `derived/phase-6/PHASE8_INPUT_v1.json`.
- Add the same path to `bookkeepingMappings.graphRecordPaths`.

**B2. `phases/phase-6/PHASE_CONTRACT.json`.** Add step 4 with:
- action `"Agent-guided baseline testing"`;
- instruction `"For every controller-prefilled test group, design and author harnesses for its obligations, dispatch them through the Phase-6 V7 lane (at most 3 rounds), triage every result from its assertion ledger, and record one outcome per obligation."`;
- outputDestination section `"Step 4 Input — Agent-guided baseline testing"`, schema pointer `#actions.step-4`, requiredFields `["baselineTestRecords"]`;
- resources `["./PHASE_06_SCHEMA_v1.json", "./resources/PHASE_06_WORK_FORM_TEMPLATE_v1.json", "../../shared/execution/AGENT_GUIDED_TESTING.md", "../../shared/execution/TECHNICAL_EXECUTION_REQUEST_PLAYBOOK.md"]`.

**B3. `phases/phase-6/resources/PHASE_06_WORK_FORM_TEMPLATE_v1.json`.** Add `actions.step-4` with section `"Step 4 Input — Agent-guided baseline testing"` and one `baselineTestRecords` item containing all ten fields set to `"<REQUIRED>"`.

**B4. `phases/phase-6/START_HERE.md`.**
- Replace the paragraph starting "Phase 6 performs semantic security interpretation only." with: "Phase 6 interprets the Phase 0 deploy/config evidence and the Phase 5 candidate executions (Steps 1–3), and runs the agent-guided baseline testing of every Phase 6 test group (Step 4). All tests are designed by you; automation only executes and records them."
- In Step 2, delete the sentences about `PHASE0-BASELINE-*` rows and raw transcripts, because Phase 0 telemetry is retired.
- Add after Step 3:

> ## Step 4 — Agent-guided baseline testing
> Follow [`shared/execution/AGENT_GUIDED_TESTING.md`](../../shared/execution/AGENT_GUIDED_TESTING.md). For each prefilled test group, in priority order: write a short `harnessDesign` (actors and roles, setup starting from the Phase 0 deployed state, properties and assertion names per obligation, fuzz bounds); author the harness with `npm run v7:harness:init` / `v7:harness:validate` conventions; commit the V7 request JSON under the group's `requestDirectory`; push the dispatch request `process/agent-upload/lite-v7-execution/<campaignId>-<testGroupId>-r<round>.json` with `phaseSequence: 6`; after ingestion read `controller/automation/<request>/ASSERTION_LEDGER_v1.json`; triage every failure (real property violation versus harness defect). At most 3 rounds per group. Record one outcome per obligation: `PASSED`, `PROPERTY_FAILED`, `INCONCLUSIVE` or `NOT_ACHIEVED` (reason `ROUNDS_EXHAUSTED`, `NO_EXECUTABLE_SETUP` or `TOOL_UNSUPPORTED`). Never record `PASSED` without a parsed ledger showing your named assertions passing. Every `PROPERTY_FAILED` becomes Phase 8 candidate `P6-PROP-<testGroupId>-<obligationId>`.

## Appendix C — New skill files

Create these files in the v12 package with exactly this content.

**C1. `discovery/LANE_A_START_HERE.md`**

> # Discovery Lane A — Requirement-driven review
> You review one assignment at a time. Your assignment packet lists contexts (one declaration each) with line ranges, required defect classes and the review checks for each class. For every context: read the source and its dependency ranges; write a `summary`; for every required class write a check with `applicability`, `assessment` (`SUPPORTED`, `CONCERN`, `UNRESOLVED`, `NOT_APPLICABLE`), source-specific `evidence` and `anchors` (`path.sol:L<a>-L<b>`, inside the context or its dependency ranges). Every `CONCERN` needs a candidate in the same row. Use the requirements and hypotheses listed in the packet's `inputs`. Write `SUBMISSION_v1.json` at the packet's `submissionPath`, then push the boundary request shown in your wake message. If validation fails, fix only the listed items and push again with `attempt` increased. You have 3 validation attempts per assignment. Copy-pasted evidence across contexts is rejected. Use the GitHub connector app for all repository access.

**C2. `discovery/LANE_B_START_HERE.md`.** Same as C1 except:
- the title is "Discovery Lane B — Attacker-goal review";
- the second sentence becomes: "Work top-down: for each protected asset in the packet inputs, ask how an attacker, a privileged-but-not-intended role, or a malicious token/adapter could take, freeze or misdirect it through these contexts, then record per-class checks as in Lane A.";
- add: "You must not open any other file under `work/phase-04/discovery/` or any file under `work/phase-03/`; independence from Lane A is part of the audit evidence."

**C3. `discovery/CHALLENGER_START_HERE.md`**

> # Discovery Challenger
> For each challenge assignment you receive both lanes' accepted submissions for the same contexts (one may be missing). For every context decide `ACCEPT` or `DISPUTE` with a source-specific `reason` and anchors; state `laneComparison` (`AGREE`, `DISAGREE`, `SINGLE_LANE`); add `classDecisions` for every class where a lane said `NOT_APPLICABLE` or the lanes differ. Dispute any check whose evidence does not follow from the cited lines. You do not fix the lanes' work; disputes go to reviewer-2 and the master. Integration assignments: follow `INTEGRATION_START_HERE.md`.

**C4. `discovery/INTEGRATION_START_HERE.md`**

> # Discovery Integration Review
> Each obligation asks a cross-contract question (call sequences, dependency assumptions, guard differences between sibling contracts, value flows, unguarded state changes, deployed configuration). For each obligation give `assessment` (`SUPPORTED`, `CONCERN`, `UNRESOLVED`), `reasoning` and anchors in the obligation's contracts. Every `CONCERN` needs a candidate.

**C5. `discovery/RECONCILIATION_GUIDE.md`.** One paragraph repeating the A4 Step 1 rules.

**C6. `shared/execution/AGENT_GUIDED_TESTING.md`**

> # Agent-Guided Testing
> Automation never designs tests. You design every harness from the obligation list and the Phase 0 deployed state; automation only stages, executes, records the assertion ledger and wakes you. Prefer one harness bundle per test group. Name every assertion so it can be matched in the ledger. Permission-matrix obligations test every actor and role against every state-changing entry point, including callers holding a different role. Reentrancy obligations use a malicious token or adapter. Token obligations cover fee-on-transfer, rebasing, no-return and reverting tokens. Invariant obligations state the conservation or bound being checked. Medusa may be used only through a `MEDUSA_PROPERTY` request you designed. A failing assertion is triaged: a real violation becomes `PROPERTY_FAILED`; a harness defect is fixed in the next round. Stop after 3 rounds per group and record `NOT_ACHIEVED` with the reason.

## Appendix D — Edits to existing skill files (in the v12 copy)

1. **`SKILL.md`:**
   - Set `Release identity: \`Audit_Litemode_v12\`` and `Package revision: \`v12\``, keeping the exact line format, because `run-v1.sh` parses these lines.
   - In the actor table, add the rows `discovery lane A`, `discovery lane B` and `challenger`, each with scope "Phase 4 discovery assignments (registered chats)".
   - In the phase map row for Phases 2–5, add "Phase 4 starts with controller-run discovery lanes and challenge; reviewer-2 reconciles."
   - Add the section "## Coverage model": coverage = contexts × applicable taxonomy classes (`CurveYield2/Contract-Automation/protocol/taxonomy/curveyield-defect-taxonomy-v1.json`) × detection method; gaps are recorded, never relabelled; the final verdict states `FULL_COVERAGE` or `PARTIAL_COVERAGE`.
   - Add universal rule `[U-COVERAGE-001] Coverage is measured and gaps are disclosed` with that text.
2. **`shared/policy/UNIVERSAL_RULE_REGISTRY.json`:** add `{"id": "U-COVERAGE-001", "title": "Coverage is measured and gaps are disclosed", "homepageSection": "Coverage model", "scope": "ALL_PHASES"}`.
3. **`shared/controller/LITE_PHASE_SCHEMA_POLICY.md`:** at the end of hard rule 3, append "Discovery submissions under `work/phase-04/discovery/` are controller-validated assignment files defined by `discovery/*_START_HERE.md`; they are not phase schemas."
4. **`shared/controller/LITE_PHASE_RECEIPT_PROTOCOL.md`:** at the end of "Prohibited bookkeeping sidecars", append "Discovery state, packets, submissions and the discovery summary are controller-owned assignment records, not bookkeeping sidecars."
5. **`shared/controller/AI_Auditor_Controller.md`, `profiles/AUDIT_INDEPENDENT_REVIEW.md`, `LITE_ORCHESTRATOR_MODE.md`, `docs/USER_GUIDE.md`:** in each topology table or list, add the three discovery roles as in item 1.
6. **`shared/lenses/SOLO_LENS_ISOLATION_PROTOCOL.md`:** replace the body with "Superseded in v12 by the Phase 4 discovery lanes (`discovery/`). Independence is procedural: separate registered chats, lane B without lane A material or Phase 3 hypotheses. Same-model lanes are disclosed as a limitation."
7. **`shared/policy/ASSURANCE_PRECISION_CONTROLS.md`:** replace the "Security-surface reconciliation" paragraph with "Phase 0 records every reviewable declaration (review inventory). Phase 4 discovery must accept every context or record it as a gap; gaps are disclosed per contract and class and make the coverage label PARTIAL_COVERAGE."
8. **`shared/execution/CONTRACT_AUTOMATION_CAPABILITY_MAP.md`:**
   - mark the rows "Phase-0 broad Medusa randomized baseline" and "Phase-0 ABI accounting telemetry" as `RETIRED (2026-10-11)`;
   - add the row "Agent-guided Phase 6 testing | DIRECT | reviewer-3L designs; V7 lane executes; assertion ledger recorded | design record, request, ledger".
9. **`phases/phase-0/START_HERE.md` and `phases/phase-0/PHASE_CONTRACT.json`:**
   - in step 4 and the evidence list, remove Medusa, telemetry and simulation-baseline items;
   - describe step 4 as "fork deploy/config using the package's own scripts, then a read-only deployed-state snapshot";
   - add the four review-inventory artifacts (00 §7.5);
   - remove "exceeds 100,000 observed calls" from the completion condition;
   - keep exactly nine steps in the contract, because the validator requires nine.
10. **`phases/phase-5/PHASE_05_SCHEMA_v1.json` and `phases/phase-5/START_HERE.md`:**
    - remove the `phase0BaselineSimulation` controller input and the paragraph telling reviewers to inspect it, because it is no longer produced;
    - remove `\n` literal text artifacts in the Step 3 heading.
11. **`phases/phase-8/START_HERE.md`:** in Step 2 add "Every Phase 6 `PROPERTY_FAILED` outcome is a candidate with key `P6-PROP-<testGroupId>-<obligationId>`; validate it like any other candidate."
12. **`phases/phase-10/START_HERE.md`:** in Step 3 add "State the coverage label from `work/phase-10/COVERAGE_MATRIX_v1.json` (`FULL_COVERAGE` or `PARTIAL_COVERAGE`) and the detection-qualification status exactly as printed in the final evidence index."
13. **`master-review/START_HERE.md`:** in Step 3 add the bullet "every coverage gap and dispute listed in the discovery summary and coverage matrix; a gap may be accepted only with a stated reason, or closed by ordering targeted tests."
14. **`PACKAGE_PROVENANCE.md`:** append the section "## v12 detection rebuild", listing:
    - discovery lanes and challenger;
    - complete Phase 0 review inventory;
    - candidate-independent baseline obligations tested in Phase 6 by the agent;
    - coverage matrix and label;
    - Phase 0 Medusa and telemetry retired;
    - reversal of the v38.3.2 compressions "one principal multi-lens traversal" and "Phase 5 reopens only deltas" for Phase 4 discovery.

## Appendix E — Self-check before opening the T8 AC PR

- `grep -r "Audit_Litemode_v11" audit-process/v7/staging-authority/Audit_Litemode_v12` returns only `PACKAGE_PROVENANCE.md` history lines.
- Every phase `PHASE_CONTRACT.json` step count equals its schema `actions` count.
- Every new `*.md` link resolves inside the package.
- `MANIFEST.json` has `detectionPolicy`.
