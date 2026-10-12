# Audit Detection Rebuild v2 — Build Contract

> **For the implementing agent:** Read this whole file first. Then execute the tasks in `01_BASELINE_AND_INVENTORY_v2.md`, `02_REVIEW_AND_BASELINE_CHECKS_v2.md` and `03_SKILL_RELEASE_AND_ACTIVATION_v2.md` strictly in the order T0, T1, …, T10. One task = one branch = one pull request. Do not merge tasks, skip tasks, reorder tasks, or start a task before the previous task's PR is merged. When an instruction does not match what you find in the repository, stop that task, write the exact mismatch in the PR description under `## Blocked question`, and do not guess.

Supersedes `00_BUILD_CONTRACT_v1.md` (removed; Git history keeps it).

## 1. Purpose

Upgrade the Lite audit skill and the Contract-Automation code together so that every audit maximizes security coverage across **all** in-scope contracts and **all** applicable defect classes.

The current system is proven inadequate. Its failure pattern was:
- Phase 4 coverage counted rows that were *present*, not rows that were *reviewed*.
- The row list came from ABI entries only, so internal, private and library code never got rows, and inherited functions and getters had no source anchors.
- One reviewer chat had to fill about 900 rows, which produced boilerplate.
- Nothing tested security properties unless a reviewer had first raised a candidate.

This plan fixes the system. It does not repair, rerun or measure any past campaign.

## 2. Fixed decisions (do not revisit)

| ID | Decision |
|---|---|
| D1 | **Coverage definition.** Coverage = every in-scope *context* (one declaration in one effective contract) × every applicable *defect class* from the taxonomy (T1) × at least one detection method. It is reported per contract and per class. |
| D2 | **Phase 0 stays fully automated and deterministic.** It gains the review inventory, system facts, deployed-state snapshot, assignment plan and integration obligations (T2, T3). Phase 0 never runs fuzzing, Medusa, telemetry, fixture synthesis or anything that needs judgment. |
| D3 | **Phase 4 discovery runs as two independent lanes plus a challenger.** Lane A works bottom-up from requirements. Lane B works top-down from attacker goals. Then the challenger reviews both lanes' rows and the integration obligations. Each role has **one pre-created chat** registered at initialization. Assignments run one at a time. reviewer-2 then finishes Phase 4 from the reconciled results (T4, T5). |
| D4 | **Phase 6 becomes the AI-guided testing segment.** reviewer-3L designs harnesses for the baseline obligations, dispatches them through the existing V7 execution lane, and triages every result. No harness, fuzz campaign or telemetry run happens without an agent design record (T6, T7). |
| D5 | **Phase 5 is unchanged**, including the existing Phase 5 boundary candidate execution. |
| D6 | **The skill is upgraded in place.** New package `Audit_Litemode_v12` replaces `Audit_Litemode_v11` in `Audit Skill - Current Authority`. v11 is moved to `audit-process/v7/frozen-authorities/Audit_Litemode_v11`. File names inside the package do not change (`PHASE_04_SCHEMA_v1.json` keeps its name); only the package directory carries the version (T8, T9). |
| D7 | **The new behavior is keyed on the bound authority.** v12 `MANIFEST.json` carries `"detectionPolicy": "audit-detection-rebuild-v1"`. All new code paths run only when the campaign's bound authority manifest has exactly that value. Campaigns bound to v10.3 or v11 keep today's behavior byte-for-byte. |
| D8 | **Activation is not blocked on qualification.** v12 becomes the default for new campaigns when T0–T9 are merged. Detection qualification (T10) runs later; its status appears in every final report. |
| D9 | **Past campaigns are never used as fixtures or benchmarks.** `curveyield-dex-v17-source-r1` is retired by owner decision of 2026-10-12 (T0). |
| D10 | **The master reviewer keeps its role.** At each segment it additionally receives the coverage-gap list. |

## 3. Non-blocking rules (apply in every task)

- **N1 — Every loop is bounded.**
  - A discovery submission gets at most 3 validation attempts.
  - A Phase 6 test group gets at most 3 dispatch rounds.
  - After 2 materially identical infrastructure failures, stop that operation (root `AGENTS.md`).
- **N2 — An exhausted bound records a typed gap and the campaign moves on.** Never leave a campaign waiting on a loop.
  - For discovery the gap is `COVERAGE_GAP` with reason codes `VALIDATION_ATTEMPTS_EXHAUSTED`, `INVENTORY_INCOMPLETE` or `TEST_NOT_ACHIEVED`.
  - For Phase 6 the obligation is recorded `NOT_ACHIEVED` with its reason.
- **N3 — A gap is never turned into a pass.**
  - Gaps are listed per contract and per class in the Phase 10 report.
  - The final assurance label is `PARTIAL_COVERAGE` whenever a gap exists.
  - The master receives the gap list.
- **N4 — Automation faults produce `CONTROLLER_ERROR` with the exact message.** A reviewer is never asked to rework because of an automation fault (existing rule).
- **N5 — New code is dormant unless D7 is true.**
  - Old-policy behavior must not change.
  - Every task must leave every existing test passing.
  - Every task must add tests proving the old path is unchanged.
- **N6 — No new browser primitives.** Only `browser-agent-wake.yml` with `mode=resume_existing`.
- **N7 — No new workflows except the T0 verification workflow.** Edits to existing workflows are allowed only where a task names them.
- **N8 — Follow the release order in section 6 exactly.**

## 4. Implementer rules

1. **Repositories:**
   - Code, workflows, tests and these plans live in `CurveYield2/Contract-Automation` (CA).
   - Skill files, campaign state and frozen authorities live in `CurveYield2/Audit-Controller` (AC).
   - Never add a workflow to AC.
2. **Branch names:** `upgrade/adr-T<number>-<short-slug>` from current `main`. Open a PR into `main`. Merge only after the T0 workflow is green on the PR head. Delete the branch after merge.
3. **Before editing:**
   - Read the root `AGENTS.md`, the nearest `AGENTS.md` of every directory you touch, and every file listed under the task's **Read first**.
   - Find code by the exact search strings given in each task. Line numbers in this plan are hints only.
4. **No local Solidity compilation and no dependency downloads.** All verification happens in the T0 workflow.
5. **Canonical helpers:**
   - JSON canonicalization and digests: `canonicalJsonV1` and `digestCanonicalV1` from `packages/github-native-sim/src/canonical-json-v1.mjs`.
   - Repo file access in controller code: `readJson`, `writeJson`, `repoFile`, `requiredFile` and `safeRel` from `scripts/lib/lite-phase-work-v1.mjs`.
   - Do not write new copies of these helpers.
6. **Commit message format:** `feat(adr-T<n>): <what>`, `test(adr-T<n>): <what>` or `docs(adr-T<n>): <what>`.
7. **PR description must contain:**
   - the changed files;
   - the T0 workflow run link and result;
   - "old-path regression: PASS";
   - the exact next task.
8. **Runner pin note:** after each CA merge, check whether any changed file is listed in `process/RUNNER_MANIFEST.json`. If none is, write `Runner components unchanged` in the PR. If one is, stop and ask in the PR. T10 replaces the retired full-qualification pin process.
9. **Stop rule:** if the same check fails twice with no code change between the runs, stop and report in the PR. Do not loop.

## 5. Task map

| Task | File | Repo | Delivers | Depends on |
|---|---|---|---|---|
| T0 | 01 | CA (+AC state) | Verification workflow; retire v17 r1 | — |
| T1 | 01 | CA | Defect taxonomy + coverage-matrix library | T0 |
| T2 | 01 | CA | Phase 0 review inventory, system facts, deployed-state snapshot | T1 |
| T3 | 01 | CA | Phase 0 assignment plan + integration obligations | T2 |
| T4 | 02 | CA | Discovery submission, challenge and integration validators | T3 |
| T5 | 02 | CA | Discovery routing: controller, workflow, initialization, wake messages | T4 |
| T6 | 02 | CA | Baseline obligations + Phase 6 test groups | T5 |
| T7 | 02 | CA | Phase 6 AI-guided testing path: dispatch, ingestion, assertion ledger, validation | T6 |
| T8 | 03 | CA + AC | Validator update; v12 skill package authored in a staging folder | T7 |
| T9 | 03 | CA + AC | Frozen-authority registry, v11 freeze, version-agnostic resolution, v12 swap, end-to-end test | T8 |
| T10 | 03 | CA + AC | Qualification scorer (non-blocking), runner-pin docs, rejection-matrix test, handoff | T9 |

## 6. Release order (mandatory)

1. T1–T7 are merged into CA `main`. All of it is dormant because no campaign is bound to v12 yet (D7).
2. T8 is merged into AC `main`: v12 is authored under `audit-process/v7/staging-authority/Audit_Litemode_v12/`, and `Audit Skill - Current Authority` is untouched.
3. T9, in this order:
   1. CA resolver generalization is merged.
   2. The AC commit adds frozen v11 and the registry entry while v11 also still sits in Current Authority.
   3. The CA end-to-end test against that AC commit is green.
   4. The AC swap commit removes v11 from Current Authority and moves v12 in.
   5. The ZIP sync runs.
4. Only after step 3 may a new campaign be initialized. It binds to v12 automatically.

Any other order can leave campaigns pointing at missing files. Never do the swap while a T1–T7 PR is still open.

## 7. Shared contracts

### 7.1 Artifact header

Every new JSON artifact written to a campaign starts with these fields:

```json
{
  "schemaVersion": "<exact literal given by the task>",
  "campaignId": "<directory.campaignId>",
  "campaignGenerationId": "<directory.campaignGenerationId>",
  "sourceSha256": "<directory.sourceSha256>",
  "taxonomyVersion": "curveyield-defect-taxonomy-v1",
  "detectionPolicy": "audit-detection-rebuild-v1",
  "generatedAt": "<ISO-8601 UTC>",
  "payload": {}
}
```

The artifact digest is `digestCanonicalV1(artifact)` and is stored by the referencing file. It is never stored inside the artifact itself.

### 7.2 Validator result

Every validator returns `{ok, errors, value}`:
- `errors` is an array of `{code, path, message}`.
- `ok === (errors.length === 0)`.
- `value` is `null` when `ok` is false.
- Error codes are UPPER_SNAKE_CASE strings defined by the task.
- Validators never throw for bad input. They throw only for programmer errors, such as a missing required argument.

### 7.3 Identifiers

- `symbolId` = `"SYM-" + digestCanonicalV1({path, qualifiedContainer, kind, canonicalSignature}).slice(0, 16)`.
  - It deliberately has no byte offsets, so it stays stable across versions.
  - If two declarations collide, append `-2`, `-3` in source order and record a limitation `SYMBOL_ID_COLLISION`.
- `contextId` = `"CTX-"` + the same 16 hex characters as the declaration's `symbolId`. There is one context per reviewable declaration; the contracts it is effective in are listed in `effectiveIn` (T2).
- Assignment IDs: `A-001`… (lane A), `B-001`… (lane B), `C-001`… (challenge), `I-001`… (integration). They are numbered in plan order.
- Obligation IDs: `IOB-0001`… (integration), `BOB-0001`… (baseline).
- Test group IDs: `TG-001`….

### 7.4 Source anchors used by reviewers

Reviewers never compute byte offsets. They cite anchors as `"<relative/path.sol>:L<start>-L<end>"`, or `"<relative/path.sol>:L<n>"` for one line. The controller accepts an anchor only if its file is in scope and its line range lies inside the cited context's line range or inside one of the dependency symbol ranges listed in the assignment packet.

### 7.5 Campaign paths (relative to the campaign `workspacePath`)

| Path | Owner | Written in |
|---|---|---|
| `evidence/review-inventory/REVIEW_INVENTORY_v1.json` | controller | Phase 0 (T2) |
| `evidence/review-inventory/SYSTEM_FACTS_v1.json` | controller | Phase 0 (T2) |
| `evidence/review-inventory/DEPLOYED_STATE_SNAPSHOT_v1.json` | controller | Phase 0 (T2) |
| `evidence/review-inventory/ASSIGNMENT_PLAN_v1.json` | controller | Phase 0 (T3) |
| `work/phase-04/discovery/DISCOVERY_STATE_v1.json` | controller | Phase 3 PASS onward (T5) |
| `work/phase-04/discovery/<assignmentId>/ASSIGNMENT_PACKET_v1.json` | controller | T5 |
| `work/phase-04/discovery/<assignmentId>/SUBMISSION_v1.json` | reviewer (lane/challenger chat) | T5 |
| `work/phase-04/discovery/DISCOVERY_SUMMARY_v1.json` | controller | discovery complete (T5) |
| `work/phase-06/BASELINE_OBLIGATIONS_v1.json` | controller | discovery complete (T6) |
| `controller/phase6-tests/<testGroupId>/<requestName>.json` | reviewer-3L | Phase 6 (T7) |
| `controller/automation/<safeV7RequestId>/EXECUTION_EVIDENCE_v1.json` and `ASSERTION_LEDGER_v1.json` | automation (the existing ingestion location; T7 adds the ledger) | Phase 6 (T7) |
| `work/phase-10/COVERAGE_MATRIX_v1.json` | controller | Phase 10 (T7) |

## 8. Verified baseline (CA `f333814c`, AC `09de9ab`, 2026-10-12)

| Location | Fact | Fixed by |
|---|---|---|
| `packages/github-native-sim/src/source-intelligence-technical-v1.mjs` (search `const astFns=ast.functions.get(`) | AST lookup only in the most-derived contract, so inherited functions and generated getters get `UNSUPPORTED_AST_SOURCE_LOCATION` | T2 |
| `scripts/lib/lite-phase-prefill-v1.mjs` (search `function sourceReviewScaffold`) | Phase 4 rows are built from ABI functions only | T2, T5 |
| `scripts/lib/lite-phase-prefill-v1.mjs` (search `export function phase4CoverageFromForm`) | Coverage counts present record keys | T5 |
| `.github/workflows/lite-phase-work-packet-controller-v1.yml` | One global concurrency group; exactly one request per push; publish pushes without rebase | T5 |
| `.github/workflows/lite-audit-browser-orchestrator-v1.yml` and `browser-agent-wake.yml` | Only pre-created chats; reviewer ids `reviewer-1..4`; `mode` only `resume_existing` | T5 (registration extension, no new primitive) |
| `.github/workflows/lite-v7-execution-dispatch-v1.yml` | Hard-gated to Phase 9 | T7 |
| `scripts/lib/lite-phase-work-v1.mjs` (search `const LEGACY_V103_LOGICAL`), `scripts/prepare-lite-assignment-successor-v2.mjs` (search `const legacyLogicalRoot`), `scripts/lib/lite-master-review-v1.mjs` (search `const isV11=` and `const expectedRoot='Audit Skill - Current Authority/Audit_Litemode_v10.3'`), `scripts/lib/lite-post-completion-followup-v1.mjs` (search `Audit_Litemode_v11/SKILL.md`), `lite-phase-work-packet-controller-v1.yml` (search `Audit_Litemode_v11/master-review`) | Hardcoded authority versions; frozen resolver only knows v10.3 | T9 |
| `scripts/validate-lite-authority-automation-sync-v1.mjs` | Not run by any workflow; still requires `PHASE0_MEDUSA_CALL_LIMIT_V1=125000` although Phase 0 Medusa is retired | T9 |
| AC skill `phases/phase-0/START_HERE.md` | Still describes a Medusa baseline of more than 100K calls and ABI telemetry; Phase 0 is now deploy/config only | T8 |
| `process/V7_QUALIFICATION_STATUS.json`, AC `docs/agent-guides/V7_RUNNER_REBIND_PROTOCOL_v1.md`, both `AGENTS.md` files | Full V7 qualification retired 2026-10-11; docs still name `v7-execution-infrastructure-qualification.yml` | T10 |

## 9. Done condition for the whole plan

- T0–T10 are merged.
- A new campaign initialized afterwards binds to v12.
- Phase 0 for that campaign writes the four review-inventory artifacts.
- The T9 end-to-end test is green.
- The T10 rejection-matrix test is green.
- Every existing test is green.
- No campaign bound to v10.3 or v11 changed behavior.

Stop when this condition is met. Do not create follow-up queues.
