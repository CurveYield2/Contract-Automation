# CurveYield Audit Automation Upgrade Handoff v9

Updated: 2026-09-24 America/Los_Angeles / 2026-09-25 UTC

## 1. Authority and scope

This is the current durable successor handoff for the CurveYield audit-automation upgrade lane.

**Scope is Lite-pathway-only.** Do not expand, redesign, or opportunistically harden Full/v26 behavior unless the human explicitly reopens that scope.

Authority order for this lane:

1. explicit current human instructions;
2. live GitHub state for **current implementation/work status**;
3. the uploaded development-plan/handoff packet for **approved design intent and implementation plan**;
4. the admitted Lite skill package for audit-process/methodology constraints;
5. this handoff as the reconciled resume document.

Current human clarification:

- **GitHub is final authority on what is currently implemented, merged, open, stale, blocked, or next.**
- **The uploaded files are authority for the intended development plan and architecture.**
- When those disagree, preserve the development intent but update execution status from GitHub.

Do not restart completed work.
Do not create duplicate bridges, dispatchers, watchdogs, ingestors, evidence models, or work queues when an admitted primitive already exists.
Do not resume Contract-Automation issue #282; it was retired because it created a self-perpetuating agent loop.

## 2. Development-plan source identities

### Admitted Lite skill package supplied by the human

File:
`Audit_V7_independent_Review_skill_v38.3.4_Web_Bootstrap_Optimized(2).zip`

SHA-256:
`aed298c90c3de3bf9e64bf7e49853b7efd994c47ef9e88cc8f35f60977314cd8`

Relevant Lite identity inside the package:
- release: `audit-v7-independent-review-lite@1.0.0`
- package revision: `v38.3.4`

Important process constraints from the Lite package:
- GitHub connector app only for repository operations;
- execute/repair/retry/continue rather than stop on recoverable failures;
- progressive disclosure;
- exact campaign/source/phase identity;
- evidence integrity and fail-closed behavior;
- no semantic security judgment by mechanical web workers;
- browser/web workers may perform bounded deterministic work only.

### Original automation-upgrade plan/handoff packet supplied by the human

File:
`CurveYield_Audit_Automation_Upgrade_Handoff_v1 (1)(5).zip`

SHA-256:
`f2d38c0d23a03322028d79fbc6bbbd0e8cb484f57978d7ebe5bd6183e6111b12`

This packet remains authoritative for the approved design intent, especially:
- existing-process-first;
- private Audit-Controller as control/state/evidence authority;
- public Contract-Automation as execution plane;
- bridge-first architecture;
- deterministic Current Work Packet and work queues;
- exact execution request construction;
- deterministic evidence ingestion;
- byte-bound completion/automation validation;
- fail-closed retirement;
- deterministic successor handoff;
- bounded inter-phase web grunt workers;
- expensive reasoning agents reserved for semantic security work.

## 3. Approved architecture that must remain intact

### Repository boundary

`CurveYield2/Audit-Controller`
- private campaign/control/evidence authority;
- campaign state, Phase Contracts, obligations, invalidations, handoffs, reviewer lineage;
- deterministic controller operations.

`CurveYield2/Contract-Automation`
- public execution plane;
- canonical V7 execution workflow;
- technical build/static/simulation execution;
- browser-agent wake/watchdog infrastructure;
- cross-repository automation where admitted.

### Existing-process-first rule

Evaluate every proposed change in this order:
1. reuse an existing process/module/workflow;
2. extend it;
3. refactor it;
4. create a new process only if the existing architecture cannot safely express the requirement.

A new process is not justified merely because it is easier to code.

### Human/AI semantic boundary

Automation/mechanical workers may own:
- current-state reconstruction;
- exact read-set/work-queue construction;
- deterministic request construction;
- execution dispatch/observation;
- evidence identity validation and ingestion;
- output/digest reconciliation;
- ledger/invalidation projections;
- report/handoff scaffolding;
- completion/retirement gate evaluation;
- final evidence-index assembly.

Reasoning reviewers retain:
- semantic scope interpretation;
- architecture/trust reasoning;
- threat modeling;
- manual source review;
- economics/math judgment;
- hypothesis/property design requiring judgment;
- exploit/candidate validity;
- severity/materiality;
- finding disposition;
- remediation correctness;
- residual risk.

Machine evidence must never auto-promote a security finding.

## 4. Current live repository identities

Verified against GitHub at this handoff refresh.

### Audit-Controller

Repository:
`CurveYield2/Audit-Controller`

Current `main`:
`613b1b1fc012e57e5c76c0728d08790448af7edb`

Current main tip is the merge that published automation-upgrade handoff v8.

### Contract-Automation

Repository:
`CurveYield2/Contract-Automation`

Current `main`:
`07c44a22c8bd8bb433c6afef78243f7d5c9bd68a`

This is the merge of Stage C.6 execution-observer routing.

### Canonical qualified runner

`process/V7_QUALIFICATION_STATUS.json` currently reports:

- status: `PASS`
- qualified commit: `43da64df93547959c776dcf99327555e104b1075`
- workflow run: `36103484939`
- FULL qualification: PASS
- dependency lock: present
- canonical toolchain: PASS
- Phase 6: PASS
- Phase 7: PASS

Do **not** substitute raw Contract-Automation `main` for the admitted qualified runner merely because `main` is newer.

Stage C.6 also has CONTROL_LIGHT qualification:
`36104130465` — PASS.

## 5. Completed Lite Stage C work

### C.1 — Current Work Packet — COMPLETE

Audit-Controller PR #72 merged.
Merge:
`36cef94ed283beae10a84adf38c189f25b9e641d`

Lite packets now bind, among other things:
- route identity separately from semantic Phase Contract identity;
- exact Phase Contract SHA-256;
- admitted skill/build identity;
- sealed/do-not-repeat work;
- global controls;
- rework/invalidation state;
- exact next executable work item.

### C.2 — Milestone Work Queue — COMPLETE

Audit-Controller PR #74 merged.
Merge:
`f4955d5e1398db34a171a2162cfee0e4ec9ea2b6`

Lite milestones projected:
- `P0_1`
- `P2_5`
- `P6_7`
- `P8_10`

Real regression fixture:
`campaigns/CurveYield DEX Fresh Audit`

Human STOP/RESUME state is honored; paused milestones expose no executable work.

### C.3 — Machine Phase Contract / seal evaluation — COMPLETE BY VERIFICATION

Existing machinery already enforces:
- mandatory Phase Contract steps;
- required outputs;
- due obligations;
- completion validation;
- automation completion validation;
- terminal work queue;
- fail-closed retirement/seal gate.

No ceremonial rewrite was required.

### C.4 — Source Intelligence technical bundle — COMPLETE

Contract-Automation PR #322 merged.
Merge / admitted FULL-qualified commit:
`43da64df93547959c776dcf99327555e104b1075`

FULL qualification:
`36103484939` — PASS.

The admitted compile path now creates deterministic neutral Source Intelligence technical evidence from the already admitted build, including compiler/AST/storage/method/ABI/Slither/SBOM facts while explicitly forbidding finding, severity, exploitability, or trust conclusions.

Audit-Controller remains the canonical campaign Source Intelligence acceptance/projection authority.

### C.5 — Automatic execution-request dispatch — COMPLETE

Contract-Automation PR #323 merged.
Merge:
`c96e05d1fbf243e24715ae54f6c3878383fa232b`

After existing `BUILD_EXECUTION_REQUEST`:
1. deterministic request + receipt are written to the exact private branch;
2. exact writeback commit is captured;
3. existing V7 execution workflow self-dispatches using exact request path and controller ref;
4. semantic reviewer wake is suppressed until terminal technical execution.

No new workflow/engine/schema/secret was introduced.

### C.6 — Execution observer / recovery routing — COMPLETE

Contract-Automation PR #324 merged.
Merge / current Contract-Automation main:
`07c44a22c8bd8bb433c6afef78243f7d5c9bd68a`

PR head:
`90f561c51f080d7dca357ed7aeedf72a04f75f8a`

CONTROL_LIGHT qualification:
`36104130465` — PASS.

Terminal execution now writes:
`EXECUTION_OBSERVER_RECEIPT_v1.json`

Bounded routes:
- `EVIDENCE_INGESTION`
- `RUNNER_REPAIR_REQUIRED`
- `SEMANTIC_HARNESS_REPAIR_REQUIRED`
- `TYPED_FAILURE_REVIEW_REQUIRED`
- `EVIDENCE_RECOVERY_REQUIRED`

The observer records exact request/run/job/artifact identity and the typed owner/nextAction/retryFrom/recoveryCommand. It is uploaded before reviewer wake. `semanticReviewerPollingRequired=false`.

No second poller/watchdog was created.

## 6. Inter-phase Lite mechanical work-pack state

The old v1 single-output work packet is no longer the current implementation.

### Merged current implementation

Audit-Controller PR #67 merged:
`feat: generate extended Lite interphase work packets v2`

Merge:
`b7c43b8ed6b69d923d273ce49bc520470c885e62`

Current implementation:
- same `BUILD_SUCCESSOR_HANDOFF` operation;
- same successor-handoff builder;
- v1 work-packet generation is retired/fail-closed;
- emits `MECHANICAL_WORK_PACKET_v2.json` when `interphaseMechanical=true`;
- each supported Lite boundary emits exactly **10 mechanical work units plus one final reconciliation output**;
- unique work-unit IDs and output paths enforced;
- outputs confined to the authoritative handoff `MECHANICAL/` directory;
- semantic security judgment explicitly forbidden.

Supported boundaries remain:
- `P0_TO_P1`
- `P1_TO_P2`
- `P5_TO_P6`
- `P67_TO_P8`

### Stale overlapping PR #66 — DO NOT MERGE BLINDLY

Audit-Controller PR #66 remains open:
`feat: expand Lite interphase mechanical work packs`

Head:
`31f5e175c22f4d0e7493e6897b43a9ba9cf25875`

Live comparison against current main:
- 16 commits ahead;
- **9 commits behind**;
- branch diverged from main at `7b60298b1b1372405fbb32bf3bcebb66ec9004d9`.

PR #66 implements the older v1-shaped ten-output packet and overlaps the already merged v2 implementation in PR #67. Treat it as stale/overlapping history unless a specific unique change is proven still required. Do not base forward work on this branch.

### Trace PR #295 — TRACE ONLY / DO NOT MERGE

Contract-Automation PR #295:
`V7 controller operation awr-expand-interphase-pack-e2e-v1`

Head:
`f9b55e12993d140dfbc0dfacbf1b19499ddb5b8c`

Live comparison against current main:
- 4 commits ahead;
- **41 commits behind**;
- intentionally trace-only.

Run `36089552985` completed successfully for the controller operation and exact controller verification. It wrote the deterministic handoff/operator outputs to the private branch during that test.

Important test limitation from the run log:
`No campaignId on this request; browser-agent wake not applicable.`

Therefore that run proves controller-operation generation/writeback for the test request, **not** a real campaign browser-grunt completion cycle.

Do not merge PR #295.

## 7. Earlier blockers that are CLOSED / stale

Do not carry these forward as current blockers:

### Old private-controller credential blocker

The v1 packet ended with `401 Bad credentials` on `AUDIT_CONTROLLER_GITHUB_TOKEN`.
That blocker is resolved.

PR #50 subsequently completed exact private-controller verification and real canonical E2E, and merged.

Audit-Controller PR #50:
`feat: add audit workload reduction layer v1`

Merge:
`0bc58cbe36712f3e6fbcb9c2689f2e92071db119`

### Browser/Lite mechanical gate repair

Contract-Automation PR #255 merged:
`Fix Lite mechanical wake state and pin packet completion`

Merge:
`49f951037a002642888edea6ef6ca7f49fd4c12f`

It fixed watchdog-state argument binding and exact packet/output pinning. Do not reopen that repair absent a concrete regression.

## 8. Exact current resume point — Lite Stage C.7 ONLY

### C.7 — Automatic evidence ingestion

This is the next implementation item.

Reusable machinery already exists:
- `Audit-Controller/packages/controller-core/src/execution-evidence-ingestor-v1.mjs`
- Audit-Controller operation `INGEST_EXECUTION_EVIDENCE`
- existing exact request/evidence/qualification validation
- C.6 terminal observer route `EVIDENCE_INGESTION`
- existing canonical controller-operation bridge in Contract-Automation.

**Do not build another ingestor, another evidence model, another watcher, or another workflow unless the existing admitted path is proven incapable.**

Required bounded behavior:

1. When the C.6 observer route is `EVIDENCE_INGESTION`, carry the exact terminal execution evidence back to the exact private Audit-Controller campaign branch.
2. Bind the exact:
   - generated execution request;
   - terminal execution evidence;
   - workflow run ID;
   - job ID;
   - artifact identity/digest where applicable;
   - canonical qualified runner identity.
3. Invoke the existing `INGEST_EXECUTION_EVIDENCE` controller operation automatically through the existing canonical controller-operation path.
4. Persist the ingestion receipt on the exact private branch.
5. Preserve the hard semantic boundary:
   - `securityDisposition = REVIEWER_REQUIRED`
   - `findingPromotion = FORBIDDEN_BY_INGESTOR`
6. Do not wake the semantic reviewer before the ingestion receipt is durable.
7. Preserve typed recovery routing for non-ingestible/failed execution outcomes.
8. Test the smallest correct implementation, qualify once where required, merge, then refresh this handoff to v10 before moving on.

### Acceptance criteria for C.7

At minimum prove:
- exact evidence/request/runner identities survive the observer→ingestor transition;
- stale/mismatched qualification fails closed;
- wrong request/evidence identity fails closed;
- ingestion receipt is durable before reviewer wake;
- the ingestor cannot promote/reject/grade findings;
- no duplicate workflow/bridge/ingestor is introduced;
- existing C.6 recovery routes still work;
- Lite-only scope remains intact.

## 9. Approved implementation order after C.7

The development-plan packet's approved logical order remains authoritative unless later explicit human instructions change it:

1. integrity/authority preservation;
2. skill efficiency compression;
3. Current Work Packet;
4. Phase Work Queue;
5. machine seal/completion evaluation;
6. execution request builder;
7. canonical bridge extension;
8. execution observer/recovery;
9. **evidence ingestion — CURRENT C.7**;
10. global-control / ledger projections;
11. report assembly;
12. successor handoff;
13. final closure/evidence index;
14. web-agent inter-phase grunt lane;
15. continuous removal of duplicate/redundant infrastructure.

Several later primitives already partially exist. For each next item: verify existing behavior first; make only the missing bounded change.

## 10. Web-agent inter-phase architecture to preserve

Intended boundary architecture:

`reasoning reviewer completes semantic work`
→ `machine completion/seal validation`
→ `bounded web mechanical worker where useful`
→ `machine validates exact mechanical outputs/digests`
→ `validated successor handoff`
→ `next reasoning reviewer wakes`

Web grunt workers may do deterministic reconciliation/indexing/scaffolding only.

Never delegate:
- candidate promotion/rejection;
- severity/materiality;
- exploit validity;
- architecture/threat interpretation;
- remediation acceptance;
- residual-risk judgment;
- ambiguous semantic source interpretation.

Browser wake/watchdog infrastructure already exists in Contract-Automation. Reuse it; do not add another dispatcher.

## 11. Working rules for the successor

- Work from current `main`, not stale open branches.
- Before modifying anything, compare current main and any active branch/PR that touches the same lane.
- If functionality is already merged and working, verify and move on.
- If a concrete gap exists, make the smallest correct change.
- Tests prove scope; tests do not create scope.
- Do not recursively harden the same area without a concrete regression.
- Never bind Audit-Controller to unqualified Contract-Automation raw main for admitted execution.
- Keep expensive reasoning-agent context focused on semantic security work.
- Keep auxiliary queues finite and terminal; no self-perpetuating agent loops.

## 12. Handoff persistence rule — superseded location

Per the latest human instruction, the **living automation-upgrade handoff now belongs at the root of `CurveYield2/Contract-Automation` on `main`**.

Current file:
`CurveYield_Audit_Automation_Upgrade_Handoff_v9.md`

Refresh rule:
- update after each material merged Stage C change, material blocker/recovery change, or authoritative resume-point change;
- increment the handoff version by exactly one whole number (`v10`, `v11`, ...);
- reconcile GitHub current state before every refresh;
- preserve the development-plan requirements rather than rewriting them from memory;
- give the human the GitHub URL after each refreshed version is committed.

This location rule supersedes the older v8 instruction that treated the Audit-Controller handoff directory as the only persistence location.

## 13. Immediate next action for the successor

Resume **Lite Stage C.7 automatic evidence ingestion** from current main.

Do not restart C.1–C.6.
Do not resume issue #282.
Do not merge PR #66 or PR #295 as forward-development branches.
Do not create a new evidence ingestor or workflow before proving the existing controller-operation path cannot perform the required C.7 wiring.
