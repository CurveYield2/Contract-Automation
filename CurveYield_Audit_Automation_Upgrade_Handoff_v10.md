# CurveYield Audit Automation Upgrade Handoff v10

Updated: 2026-09-25 UTC

## 1. Authority and scope

This is the current living successor handoff for the CurveYield audit-automation upgrade lane.

**Scope: Lite pathway only.** Do not expand or redesign Full/v26 behavior unless the human explicitly reopens that scope.

Authority order:
1. explicit current human instructions;
2. live GitHub state for current implementation/work status;
3. uploaded development-plan/handoff packet for approved design intent and implementation plan;
4. admitted Lite skill package for audit-process/methodology constraints;
5. this handoff as the reconciled resume document.

Human clarification:
- **GitHub is final authority for what is currently implemented, merged, open, stale, qualified, failed, blocked, or next.**
- **The uploaded files are authority for what the development plan is intended to achieve.**
- Preserve plan intent, but never override newer verified GitHub status with stale handoff text.

Do not restart completed work.
Do not create duplicate bridges, dispatchers, watchdogs, ingestors, evidence models, or queues when an admitted primitive already exists.
Do not resume Contract-Automation issue #282; it was intentionally retired because it created an unbounded/self-perpetuating loop.

## 2. Development-plan sources

### Admitted Lite skill package

File supplied by human:
`Audit_V7_independent_Review_skill_v38.3.4_Web_Bootstrap_Optimized(2).zip`

Key Lite constraints:
- GitHub connector for repository operations;
- progressive disclosure;
- exact campaign/source/phase identity;
- evidence integrity and fail-closed behavior;
- mechanical web workers must not make semantic security judgments;
- bounded deterministic browser/web-worker tasks only;
- semantic reviewers retain security reasoning and finding judgment.

### Automation-upgrade development-plan packet

File supplied by human:
`CurveYield_Audit_Automation_Upgrade_Handoff_v1 (1)(5).zip`

Authoritative design themes:
- existing-process-first;
- private Audit-Controller as control/state/evidence authority;
- public Contract-Automation as execution plane;
- bridge-first architecture;
- deterministic Current Work Packet and work queues;
- exact execution-request construction;
- deterministic evidence ingestion;
- byte-bound completion/automation validation;
- fail-closed retirement;
- deterministic successor handoff;
- bounded inter-phase mechanical workers;
- expensive reasoning agents reserved for semantic security work.

## 3. Repository boundaries

### CurveYield2/Audit-Controller
Private campaign/control/evidence authority:
- campaign state;
- Phase Contracts;
- obligations and invalidations;
- reviewer lineage;
- deterministic controller operations;
- canonical campaign Source Intelligence acceptance/projection;
- successor handoff state.

### CurveYield2/Contract-Automation
Public execution plane:
- canonical V7 execution workflow;
- build/static/simulation execution;
- qualified runner publication;
- browser-agent wake/watchdog infrastructure;
- admitted cross-repository automation;
- technical evidence return path.

Existing-process-first rule:
1. reuse;
2. extend;
3. refactor;
4. create new process only if the existing architecture cannot safely carry the requirement.

## 4. Current live repository state

Verified after the v9 root handoff was committed.

### Contract-Automation main

Current main:
`424041a23241a7c92ed9c9e083a3f88e576be531`

Commit:
`docs(handoff): publish automation upgrade handoff v9`

The root handoff location is therefore live and established.

### Audit-Controller main

Current main:
`613b1b1fc012e57e5c76c0728d08790448af7edb`

This is the merge that published the predecessor durable handoff v8.

### Canonical qualified Contract-Automation runner

`process/V7_QUALIFICATION_STATUS.json` currently reports:
- status: `PASS`
- qualified commit: `43da64df93547959c776dcf99327555e104b1075`
- FULL qualification run: `36103484939`
- dependency lock present;
- toolchain PASS;
- Phase 6 PASS;
- Phase 7 PASS.

Do not substitute mutable/raw Contract-Automation main for this admitted qualified runner unless a newer qualification is successfully published.

## 5. Completed Lite Stage C work

### C.1 Current Work Packet — COMPLETE
Audit-Controller PR #72 merged.
Merge: `36cef94ed283beae10a84adf38c189f25b9e641d`

Lite packets bind:
- route identity separately from semantic Phase Contract identity;
- exact Phase Contract digest;
- admitted skill/build identity;
- sealed/do-not-repeat work;
- global controls;
- rework/invalidation state;
- exact next executable work.

### C.2 Milestone Work Queue — COMPLETE
Audit-Controller PR #74 merged.
Merge: `f4955d5e1398db34a171a2162cfee0e4ec9ea2b6`

Four Lite milestones:
- `P0_1`
- `P2_5`
- `P6_7`
- `P8_10`

Human STOP/RESUME state is honored and paused milestones expose no executable work.

### C.3 Machine Phase Contract / seal evaluation — COMPLETE BY VERIFICATION
Existing machinery already enforces:
- mandatory Phase Contract steps;
- required outputs;
- due obligations;
- completion validation;
- automation-completion validation;
- terminal work queue;
- fail-closed retirement/seal gate.

No duplicate rewrite is required.

### C.4 Source Intelligence technical bundle — COMPLETE
Contract-Automation PR #322 merged.
Merge / current FULL-qualified runner:
`43da64df93547959c776dcf99327555e104b1075`

FULL qualification:
`36103484939` — PASS.

The admitted compile path produces deterministic neutral Source Intelligence technical evidence from the already admitted build. It may expose compiler/AST/storage/method/ABI/Slither/SBOM facts, but must not generate finding/severity/exploitability/trust conclusions.

### C.5 Automatic execution-request dispatch — COMPLETE
Contract-Automation PR #323 merged.
Merge:
`c96e05d1fbf243e24715ae54f6c3878383fa232b`

Existing `BUILD_EXECUTION_REQUEST` now hands off to the existing V7 execution workflow automatically using exact request path and exact controller ref. Semantic reviewer wake is deferred until terminal technical execution.

### C.6 Execution observer / recovery router — COMPLETE
Contract-Automation PR #324 merged.
Merge:
`07c44a22c8bd8bb433c6afef78243f7d5c9bd68a`

PR head:
`90f561c51f080d7dca357ed7aeedf72a04f75f8a`

CONTROL_LIGHT qualification:
`36104130465` — PASS.

Terminal execution writes:
`EXECUTION_OBSERVER_RECEIPT_v1.json`

Bounded routes:
- `EVIDENCE_INGESTION`
- `RUNNER_REPAIR_REQUIRED`
- `SEMANTIC_HARNESS_REPAIR_REQUIRED`
- `TYPED_FAILURE_REVIEW_REQUIRED`
- `EVIDENCE_RECOVERY_REQUIRED`

No second poller/watchdog was introduced.

## 6. Lite inter-phase mechanical worker state

### Current merged implementation
Audit-Controller PR #67 merged:
`feat: generate extended Lite interphase work packets v2`

Merge:
`b7c43b8ed6b69d923d273ce49bc520470c885e62`

Current implementation:
- reuses `BUILD_SUCCESSOR_HANDOFF`;
- reuses the same successor-handoff builder;
- retires/fails closed on legacy v1 packet generation;
- emits `MECHANICAL_WORK_PACKET_v2.json`;
- generates exactly 10 independent mechanical work units plus final reconciliation for each supported Lite boundary;
- enforces unique unit IDs/output paths;
- confines output to the authoritative handoff `MECHANICAL/` directory;
- forbids semantic security judgment.

Supported Lite boundaries:
- `P0_TO_P1`
- `P1_TO_P2`
- `P5_TO_P6`
- `P67_TO_P8`

### Audit-Controller PR #66 — stale overlapping lane
PR #66 remains open:
`feat: expand Lite interphase mechanical work packs`

Head:
`31f5e175c22f4d0e7493e6897b43a9ba9cf25875`

This is the older v1-shaped ten-output lane and overlaps the already merged v2 implementation in PR #67.

**Do not base forward development on PR #66 and do not merge it blindly.**
Only salvage a specific unique change if one is proven still absent from current main.

### Contract-Automation PR #295 — trace only
PR #295 remains trace-only and must not be merged as forward development.

It proved controller-operation generation/writeback for its test request, not a full real-campaign browser-grunt cycle.

## 7. Closed historical blockers

Do not carry these forward:

### Private-controller credential blocker
The old `401 Bad credentials` blocker is resolved.
Audit-Controller PR #50 completed exact private-controller verification and canonical E2E, then merged.

Merge:
`0bc58cbe36712f3e6fbcb9c2689f2e92071db119`

### Lite mechanical wake-state / packet pin repair
Contract-Automation PR #255 merged.

Merge:
`49f951037a002642888edea6ef6ca7f49fd4c12f`

It repaired watchdog-state argument binding and exact packet/output pinning. Do not reopen absent a concrete regression.

## 8. CURRENT ACTIVE WORK — Stage C.7 automatic evidence ingestion

Contract-Automation PR #325:
`feat(lite): auto-ingest terminal execution evidence`

State:
**OPEN — NOT QUALIFIED — NOT MERGED**

Branch:
`upgrade/lite-evidence-ingestion-v1`

Head:
`a3a82bd97ddc6dbd124ed56f21a8ba31ff84c7a4`

Base captured by PR:
`07c44a22c8bd8bb433c6afef78243f7d5c9bd68a`

Intended bounded changes:
1. pin V7 execution to the canonical FULL-qualified Contract-Automation runner rather than mutable main;
2. preserve exact private Audit-Controller writeback branch from C.5 into terminal execution;
3. on C.6 route `EVIDENCE_INGESTION`, stage exact execution request, terminal controller evidence, observer receipt, and canonical qualification on the private campaign branch;
4. invoke existing `INGEST_EXECUTION_EVIDENCE` through the existing controller-operation pointer path;
5. wake semantic reviewer only after durable ingestion receipt;
6. fall back to explicit recovery routing if automatic ingestion fails;
7. preserve:
   - `securityDisposition=REVIEWER_REQUIRED`
   - `findingPromotion=FORBIDDEN_BY_INGESTOR`

No new ingestor, evidence model, execution engine, watcher, or polling service is intended.

## 9. CURRENT BLOCKER — PR #325 FULL qualification failed

Workflow:
`V7 Execution Infrastructure Qualification`

Run:
`36105327923`

Candidate head:
`a3a82bd97ddc6dbd124ed56f21a8ba31ff84c7a4`

Conclusion:
**FAILURE**

Failure occurred in:
`V7 request and execution contract qualification` (step 12)

Earlier setup/toolchain steps passed:
- checkout exact candidate runner — PASS
- Node setup — PASS
- qualification-scope classification — PASS
- dependency install — PASS
- canonical V7 toolchain install/verification — PASS
- qualification evidence initialization — PASS
- exact toolchain evidence — PASS
- canonical runner-manifest verification — PASS

Later FULL tests were skipped because the execution-contract qualification gate failed.

Qualification artifact exists:
`v7-infrastructure-qualification-ef918266420e817100b94ea59196daa60ab264a4`

Artifact digest:
`sha256:0ad8c5cd99dea0343a6e4fe04284d5d1c340ef8beade8a94becd841885f59117`

Therefore:
- PR #325 is **not complete**;
- C.7 is **not complete**;
- the next worker must diagnose the step-12 contract-qualification failure, repair the smallest real defect, rerun FULL qualification, and only merge after PASS.

Do not weaken the qualification gate merely to make C.7 pass.

## 10. Exact resume procedure

Resume only Stage C.7.

1. Start from current Contract-Automation main:
   `424041a23241a7c92ed9c9e083a3f88e576be531`
2. Inspect PR #325 and its failed qualification run `36105327923`.
3. Identify the exact execution-contract mismatch/failure at step 12.
4. Repair only the concrete C.7 defect.
5. Re-run FULL qualification.
6. Require PASS before merging.
7. Verify the published canonical qualification status after merge/requalification.
8. Refresh this root handoff as **v11** with:
   - merge commit;
   - qualification run;
   - canonical runner identity;
   - next finite Lite Stage C item.
9. Move on; do not recursively harden C.7 once acceptance is proven.

Acceptance criteria remain:
- exact request/evidence/runner identities survive observer→ingestor transition;
- stale or mismatched qualification fails closed;
- wrong request/evidence identity fails closed;
- ingestion receipt is durable before reviewer wake;
- ingestor cannot promote/reject/grade findings;
- no duplicate workflow/bridge/ingestor is introduced;
- existing C.6 recovery routes still work;
- Lite-only scope remains intact.

## 11. Working rules for successor agents

- Work from current main, not stale open branches.
- Compare main and any active overlapping PR before modifying the same lane.
- If functionality is already working, verify and move on.
- If a real gap exists, make the smallest correct change.
- Tests prove scope; tests do not create scope.
- Do not repeatedly harden the same component without a concrete regression.
- Never bind admitted execution to unqualified raw main.
- Keep reasoning-agent context focused on semantic security work.
- Keep mechanical workers deterministic and judgment-free.
- Keep auxiliary queues finite and terminal.
- No self-perpetuating agent loops.

## 12. Living handoff location and refresh rule

Per current human instruction, the living automation-upgrade handoff is stored at the **root of `CurveYield2/Contract-Automation` on `main`**.

Current file:
`CurveYield_Audit_Automation_Upgrade_Handoff_v10.md`

Predecessor:
`CurveYield_Audit_Automation_Upgrade_Handoff_v9.md`

Refresh after:
- each material merged Stage C change;
- each material blocker/recovery change;
- each authoritative resume-point change.

Every refresh must:
- reconcile live GitHub state first;
- increment the version by exactly one whole number;
- preserve uploaded development-plan intent;
- record stale-information corrections;
- include completed work, active PRs/branches, blockers, exact next steps, qualification identity, and overlap fences;
- be committed to Contract-Automation main;
- provide the human the GitHub URL.

## 13. Immediate successor instruction

**Fix and qualify Contract-Automation PR #325.**

Do not restart C.1-C.6.
Do not resume issue #282.
Do not merge Audit-Controller PR #66 or Contract-Automation PR #295 as forward-development branches.
Do not add another ingestor/workflow/observer before proving the admitted path cannot perform C.7.
Do not call C.7 complete until FULL qualification passes and the merge is verified.
