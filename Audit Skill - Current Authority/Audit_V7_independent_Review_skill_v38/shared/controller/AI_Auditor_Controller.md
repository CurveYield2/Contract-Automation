# Audit V7 Independent Review — Sequential Reviewer Controller Contract v7

## Universal rule-ID authority

The homepage `SKILL.md` is the single normative source for universal behavior identified by `U-EXEC-001`, `U-GITHUB-001`, `U-STATE-001`, `U-EVIDENCE-001`, `U-REPAIR-001`, `U-HUMAN-001`, `U-DISCLOSURE-001`, `U-UPDATES-001`, and `U-HUMANCOMMS-001`. This controller may define narrower state-machine mechanics but MUST NOT restate or weaken those rules. Registry: `shared/policy/UNIVERSAL_RULE_REGISTRY.json`.

## Purpose

This controller contract converts the Deep Assurance V6.1 multi-agent campaign into a single-active-reviewer state machine with mandatory fresh-session handoffs after Phase 1, Phase 5, Phase 6A, Phase 6B, Phase 6C, and Phase 8. The controller is a durable evidence/state authority; it does not create security conclusions.


## Progressive-disclosure runtime routing

`SKILL.md` is the universal homepage. The active reviewer MUST open only `phases/phase-<N>/START_HERE.md` for the current controller phase and then open only resources explicitly linked by the active numbered step. Other phase folders are not mandatory reading and must not be preloaded for convenience.

All access to `CurveYield2/Audit-Controller` and `CurveYield2/Contract-Automation` MUST use the connected GitHub connector app. Browser/web/raw-URL/direct-HTTP repository access is not an admitted substitute.

## Machine-readable phase contracts and campaign-global security state

Every Phase 0–10 has `phases/phase-<N>/PHASE_CONTRACT.json`, validated against `shared/controller/PHASE_CONTRACT_SCHEMA.json`. The active reviewer MUST open the current phase contract before Step 1. A phase contract defines required inputs, ordered/conditional steps, mandatory outputs, reviewer authorization, global checkpoints, sealing criteria, recovery routes, and allowed next states. Missing or internally inconsistent contract state is a process-integrity failure that must be repaired before progression.

Two campaign-global canonical artifacts persist across every reviewer lineage:

1. `SECURITY_TRACEABILITY_GRAPH` — instantiated from `shared/controller/SECURITY_TRACEABILITY_GRAPH.json`. It connects source/scope → `PROP-*` → `HYP-*` → manual review/candidates → fuzz campaigns → simulations → findings → remediation → material final claims. Material nodes may not silently disappear between phases.
2. `CARRIED_FORWARD_OBLIGATION_LEDGER` — instantiated from `shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json`. Every later-phase-required action receives a stable `OBL-*` ID, exact destination phase/reviewer, objective completion condition, and closure evidence.

At phase start, enumerate obligations due in that phase. Before `EVIDENCE_SEALED`, update the traceability graph, reconcile all due obligations, and freeze/report the current graph and ledger references/digests. Any due obligation still `OPEN` or `IN_PROGRESS` forbids sealing. `BLOCKED_CARRIED` is allowed only with a typed blocker/limitation and a policy-permitted later destination; it cannot be used merely to postpone mandatory work.

## Actor model

Exactly one audit reviewer is active at a time. Planned lineages are:

1. `reviewer-1` — Phases 0–1; `gpt-5.6-terra` with high reasoning.
2. `reviewer-2` — Phases 2–5; fresh `gpt-5.6-sol` reviewer.
3. `reviewer-3A` — Phase 6A assurance design/admission only.
4. `reviewer-3B` — Phase 6B primary Medusa adversarial execution only.
5. `reviewer-3C` — Phase 6C independent Foundry/coverage closure only.
6. `reviewer-4` — Phases 7–8.
7. `reviewer-5` — Phases 9–10.
8. `human-reviewer` — receives transparency reports and may issue explicit stop/rework instructions, but does **not** approve routine phase progression.

Phase 6A→6B and 6B→6C are mandatory fresh-agent boundaries inside numbered Phase 6. The overall audit lineage is `reviewer-3`, with exact `reviewer-3A/B/C` sublineage recorded in Phase-6 state. Sequential handoff does not by itself create clean-room evidence independence.
## Phase state contract

For Phase 0 and every assurance Phase 1–10:

1. `READY` — predecessor seal/automatic advancement plus any required successor receipt permits entry.
2. `ACTIVE` — exact phase/source/controller/reviewer identity is bound.
3. `EVIDENCE_SEALED` — all mandatory work is complete or has a policy-permitted typed terminal disposition and required structured filing/global checkpoints are durable.
4. `PHASE_REPORT_SUBMITTED` — immutable report identity/digest/reference recorded.
5. `AUTO_ADVANCE_READY` — all seal criteria pass; **no human approval is required**.
6. Same reviewer: controller immediately activates the next authorized phase. Fresh-reviewer boundary: outgoing reviewer creates/seals successor package + wake-up message, enters `WAITING_FOR_SUCCESSOR_AGENT`, and stops.
7. `COMPLETE` — Phase-10 terminal closure manifest is sealed automatically.

Explicit human `STOP_AUDIT` or rework instructions remain new controller inputs when given, but silence or missing `CONTINUE` can never block progress. See `shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md`.
## Universal Phase Report filing rule

Every Phase 0–10 Phase Report must file: (1) canonical outputs with immutable references/digests, (2) new canonical audit facts with stable IDs, (3) the current Security Traceability Graph checkpoint/reference/digest, (4) the current Carried-Forward Obligation Ledger checkpoint/reference/digest plus its human-readable obligation projection, and (5) evidence invalidation triggers. These are sealing criteria, not optional report polish.

## Execution-first human interaction and repair rule

During an active phase, the reviewer must execute autonomously and provide mandatory concise non-blocking work updates at reasonable intervals. Updates may never terminate execution while authorized work remains. The reviewer must not ask the human for troubleshooting/context/permission that can be resolved from durable evidence, GitHub connector access, tools, or recovery procedures.

Any required process failure triggers immediate diagnosis, repair, retry and continuation. Use `shared/lenses/operations-recovery-lens.md`, `shared/policy/PROCESS_INTEGRITY_LEDGER.md`, `shared/reporting/PROCESS_BLOCKER_RECEIPT.json`, and/or `shared/execution/EXECUTION_PREFLIGHT_AND_REPAIR_PROTOCOL.md` as applicable. Human communication outside work updates and end-of-phase reports is allowed only for an irrecoverable blocker after recovery exhaustion, a necessary request to upload unavailable source into GitHub, or Phase-8 remediation guidance in the Phase-8 findings/report.

## Phase 0

Phase 0 admits the engagement rather than bootstrapping a team. Before semantic source analysis:

- pin audit token/campaign generation;
- admit exact repository/commit or exact uploaded source digest;
- inventory/extract source through the controller-supported mechanical route;
- record capability preflight for controller, GitHub, exact-source build, required analyzers/fuzzers/simulator, durable evidence, and reporting/publication path;
- establish `reviewer-1` identity/session lineage;
- prove applicable instruction set read;
- create the initial campaign state;
- execute harmless publication/report path smoke where required;
- Complete `phases/phase-0/resources/PHASE0_CAPABILITY_PREFLIGHT.md`; reference/digest it in the Phase-0 report before sealing.
- produce the Phase-0 report and wait for automatic advancement.

## Phase 1 — Scope and provenance

- Freeze exact source inventory and provenance.
- Bind build/compiler admission sufficient for neutral static analysis.
- Run exact-version Slither neutral reconnaissance when technically applicable.
- Analyzer observations are non-authoritative until validation.
- Reconcile exact source/artifact/SBOM identity.
- Complete `phases/phase-1/resources/PHASE1_AUDIT_SURFACE_MANIFEST.md`; reference/digest it in the Phase-1 report before sealing.
- Enter the bounded risk-grading lens after the structural evidence package is complete.
- Complete and seal `phases/phase-1/resources/PHASE1_SECURITY_RISK_GRADE_MANIFEST.md` from assets, authority, accounting, dependencies, credible loss, assumptions and promotion triggers.
- Produce the Phase-1 report, create/seal the `P1_TO_P2` successor package, enter `WAITING_FOR_SUCCESSOR_AGENT`, and stop. `reviewer-1` must not execute Phase 2.

## Deterministic specialist-domain applicability

Phase 3 MUST classify every specialist domain using `shared/controller/DOMAIN_APPLICABILITY_MATRIX.json` and maintain the exact-source-bound campaign registry derived from `shared/controller/DOMAIN_APPLICABILITY_REGISTRY.json`. `UNCERTAIN_INCLUDE` is treated as triggered. Phase 4 MUST execute every activated specialist domain; a skip is valid only with current evidence-bound `NOT_TRIGGERED`. Phases 6 and 7 consume/re-evaluate those decisions when mapping domain-specific properties to fuzzing and lifecycle simulation. New evidence/source changes invalidate affected decisions and require reevaluation.

## Phases 2–5 — analytical first-pass sequence

Fresh `reviewer-2` verifies the `P1_TO_P2` handoff, accepts the sealed Phase-1 risk grade as the starting control, and then uses the source-first lens isolation protocol through Phase 5. New evidence may promote the grade but may not silently reduce it. Each phase seals its evidence before its report. The reviewer may use neutral machine facts, but a same-agent 'clean room' must never be represented as actor independence.


### Mandatory Phase 2–5 structured outputs

- Phase 2: complete `phases/phase-2/resources/PHASE2_SECURITY_PROPERTY_REGISTRY.md` with stable `PROP-*` IDs and downstream validation routes; reference/digest it before sealing.
- Phase 3: complete `phases/phase-3/resources/PHASE3_ATTACK_HYPOTHESIS_REGISTRY.md` with stable `HYP-*` IDs mapped to security properties; reference/digest it before sealing.
- Phase 4: complete `phases/phase-4/resources/PHASE4_MANUAL_COVERAGE_CANDIDATE_REGISTRY.md`; include manual coverage, candidate IDs, residual gaps, and explicit Phase-6/7 execution targets.
- Phase 5: complete `phases/phase-5/resources/PHASE5_RETRACE_RECONCILIATION_MATRIX.md` after the retrace is sealed, classifying material reconciliation as `CONFIRMED | CONTRADICTED | NEW | UNRESOLVED`.

Each Phase 2–5 Phase Report must reference/digest its structured artifact and complete the universal canonical outputs, new canonical facts, carried obligations, and invalidation-trigger sections before `EVIDENCE_SEALED`.

Phase 5 includes a risk-weighted source-first **procedural-independent retrace**. Before the retrace, use only the allowed source/spec/neutral evidence packet and do not intentionally consult sealed conclusion summaries from prior analytical phases. Seal the retrace before reconciliation with Phases 2–4.

## Generic successor-handoff engine

All planned fresh-reviewer boundaries use `shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md`, `SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json`, and the generic schema/receipt/checklist. Campaign artifacts are isolated under the applicable `handoffs/<PROFILE_ID>/` directory, including `P1_TO_P2`. Every outgoing reviewer also creates the boundary-local `START_HERE_SUCCESSOR.md`; every fresh successor reads that tiny routing packet first and must still verify the authoritative handoff/receipt.

## Mandatory Phase-1 successor handoff — profile `P1_TO_P2`

After Phase 1 seals and files its report, `reviewer-1` creates the generic successor package containing the sealed Phase-1 risk-grade manifest and accepted Source Intelligence Bundle identities, enters `WAITING_FOR_SUCCESSOR_AGENT`, and stops. Fresh `reviewer-2` must accept the handoff receipt before Phase 2 may begin. The inherited risk grade is the Phase-2 starting control; new evidence may promote it but may not silently reduce it.

## Mandatory Phase-5 successor handoff — profile `P5_TO_P6`

After a continuation response closes Phase 5:

1. `reviewer-2` creates the authoritative `SUCCESSOR_HANDOFF.json` and Markdown mirror from sealed evidence using `shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md`. Conditional sections use typed states (`PRESENT_NONEMPTY`, `PRESENT_EMPTY`, `NOT_APPLICABLE`, `UNRESOLVED_CARRIED`, `BLOCKED_CARRIED`) rather than ambiguous blanks/nulls.
2. Controller enters `WAITING_FOR_SUCCESSOR_AGENT`.
3. `reviewer-2` stops and **must not execute Phase 6**.
4. A fresh agent/session binds provisionally as `reviewer-3A`, executes `shared/handoff/SUCCESSOR_HANDOFF_RECEPTION_CHECKLIST.md`, and creates `SUCCESSOR_HANDOFF_RECEIPT.json`.
5. The receiver MUST NOT reinterpret typed empty/not-applicable/unresolved/blocked sections as missing information. It MUST exhaust the handoff recovery ladder before creating a blocking defect.
6. Only receipt disposition `HANDOFF_ACCEPTED` or `HANDOFF_ACCEPTED_WITH_CARRIED_LIMITATIONS` may admit Phase 6 to `PHASE6_EXECUTION_PREFLIGHT`; `ACTIVE` remains forbidden until Phase-6 preflight is sealed.
7. A repair request must cite a typed defect with exact field/artifact, expected vs observed, recovery attempts, and blocking effect. Vague requests for prior-chat context are invalid.
8. `reviewer-3A` does not redo Phases 0–5 unless a typed blocking handoff defect/controller decision returns an earlier phase for rework.

The switch is labeled `SEQUENTIAL_AGENT_HANDOFF`. It is not automatically clean-room independence.

## Phase 6 — exact build and layered adversarial automation

- Enter `PHASE6_EXECUTION_PREFLIGHT` and complete `shared/execution/EXECUTION_PREFLIGHT_AND_REPAIR_PROTOCOL.md` before `ACTIVE`.
- After accepted Phase-5 handoff, initialize `phases/phase-6/resources/PHASE6_SUBGATE_STATE.json` and execute internal gates `P6.0 → P6.1 → P6.2 → P6.3 → P6.4 → P6.5 → P6.6 → P6.7 → P6.8` strictly in order under `phases/phase-6/resources/subgates/PHASE6_SUBGATE_PROTOCOL.md`. No later gate activates before its predecessor is terminal.
- Read and enforce `phases/phase-6/resources/PHASE6_FUZZ_CAMPAIGN_METHODOLOGY.md` and `phases/phase-6/resources/PHASE6_FUZZ_HARNESS_REQUIREMENTS.md`; use `phases/phase-6/resources/PHASE6_FUZZ_CAMPAIGN_LEDGER.md` as the mandatory process record.
- Resolve supplied-harness usability before tool invocation. If a usable Medusa or native-fuzz harness is absent or methodologically inadequate, `reviewer-3` MUST create/repair the required audit-only harness/scripts/configuration; absence is not `NOT_APPLICABLE`.
- Bind the exact controller-admitted `contractAutomationRelease` and `runnerRelease`; never use a remembered/hard-coded runner identity.
- Synthesize properties, attack hypotheses, state transitions, actor roles, and numerical/time boundaries from sealed Phase-2–5 evidence.
- Execute the Phase-6 campaign tree. Processes 1–7 are mandatory: (1) broad randomized exploration, (2) human-derived properties/invariants, (3) semi-targeted randomized fuzzing, (4) stateful transaction-sequence fuzzing for stateful targets, (5) coverage-guided refinement plus rerun, (6) targeted adversarial fuzz campaigns, and (7) boundary/dictionary-directed fuzzing.
- Evaluate Processes 8–11 with objective triggers and execute when triggered: (8) explicit multi-actor state-machine model, (9) independent ghost/reference model, (10) differential fuzzing, and (11) advanced corpus/deep-campaign escalation. `NOT_TRIGGERED` requires evidence; cost or inconvenience is not a trigger waiver.
- Broad discovery and targeted adversarial fuzzing are non-substitutable. Every material Phase-2–5 fuzzable security property/hypothesis must be mapped to an executed campaign or another explicit evidence disposition.
- Execute all required Medusa campaign nodes first, including its mandatory coverage/corpus refinement + rerun, and seal terminal Medusa evidence.
- Only then execute native Foundry `testFuzz_*` and invariant/stateful campaigns, using Medusa counterexamples, coverage gaps, corpus observations, and synthesized hypotheses. Native Foundry also requires a metrics/coverage review and deliberate refinement + rerun.
- The native Foundry stage is internal gate `P6.7`; it cannot activate before all required Medusa-side gates P6.1–P6.6 are terminal. Final reconciliation is P6.8 and cannot complete until all Process 1–11 dispositions and both engine refinement/rerun requirements are proven.
- Reconcile security coverage across code/function, property, actor, state-transition, threat/hypothesis, boundary, and expressible dependency dimensions; no line-coverage percentage alone proves completion.
- `reviewer-3` performs both automated-analysis and exact-evidence-validation lenses; use `shared/lenses/automated-adversarial-analysis-lens.md`. Mechanical identity validation and handoff/source identity validation remain explicit.
- Complete `phases/phase-6/resources/PHASE6_CAMPAIGN_RESULT_SUMMARY.md` from the terminal `PHASE6_FUZZ_CAMPAIGN_LEDGER.md`; summarize Processes 1–11, metrics/coverage deltas, mapped properties/hypotheses, counterexamples, residual gaps, and unchanged production source.
- Produce report; stop for automatic advancement.

## Mandatory Phase-6 successor handoff

Under profile `P6_TO_P7`, after Phase 6C seals and files the final Phase-6 report, `reviewer-3C` automatically creates and seals campaign-local `handoffs/P6_TO_P7/SUCCESSOR_HANDOFF.json` plus `START_HERE_SUCCESSOR.md` under `shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md`, enters `WAITING_FOR_SUCCESSOR_AGENT`, and stops. `reviewer-3C` MUST NOT execute Phase 7. A fresh `reviewer-4` executes the generic successor reception checklist under profile `P6_TO_P7` and produces an accepted receipt before Phase 7 may enter `PHASE7_FORK_PREFLIGHT`.

## Phase 7 — pinned-fork lifecycle

After an accepted Phase-6 handoff receipt binds fresh `reviewer-4`, enter `PHASE7_FORK_PREFLIGHT` first. Phase 7 archive-fork execution is currently supported only for Ethereum through `SIM_ARCHIVE_PRIMARY_ETHEREUM_01`. Prove Anvil launch and exact hardfork acceptance, Ethereum archive RPC availability/identity/state, target-code readiness, impersonation/balance control, and supported workflow actions. A non-Ethereum request remains `PHASE7_FORK_PREFLIGHT` with typed `ARCHIVE_RPC_UNAVAILABLE`; do not substitute a non-archive RPC or route that condition to runner repair. Use `phases/phase-7/resources/PHASE7_LIFECYCLE_RECIPES.md`; a missing expressible recipe is a typed `RECIPE_GAP`. Only after the preflight is sealed may you execute exact pinned-fork lifecycle and triggered deterministic simulations. Preserve chain/block/RPC profile, target configuration, state setup, lifecycle sequence, repeated-cycle behavior, and evidence identity. During the existing compile/deploy lifecycle, record the compiler deployment-gas estimate for every independently deployable production contract into `shared/reporting/Contract_Deployment_Gas_Report.md` using the exact accepted compiler/optimizer/source configuration; do not create a separate deployment workflow for this metric. Reconcile report coverage against the frozen deployable-contract inventory before sealing Phase 7.
- Complete `phases/phase-7/resources/PHASE7_SIMULATION_LIFECYCLE_LEDGER.md` with one stable `SIM-*` record per required/executed scenario and reconcile it with `shared/reporting/Contract_Deployment_Gas_Report.md`.
Produce report; stop.

## Phase 8 — findings validation

Build the canonical findings-validation packet mechanically. For each candidate, follow exactly:

**Identity → Scope → Security property → Evidence → Reachability → Reproduction → Contradictions → Duplicate check → Impact → Severity → Disposition.**

Then perform the adversarial/no-go lens. Only validated findings enter the authoritative ledger.
- Complete `phases/phase-8/resources/PHASE8_FINDING_VALIDATION_PACKET.md` for every candidate, including dismissed/duplicate candidates, filing every mandatory validation step and adversarial challenge.
Produce the Phase-8 report with concrete remediation guidance for validated findings; stop for automatic advancement.

## Mandatory Phase-8 successor handoff

Under profile `P8_TO_P9`, after Phase 8 seals and files its report, `reviewer-4` automatically creates and seals campaign-local `handoffs/P8_TO_P9/SUCCESSOR_HANDOFF.json` plus `START_HERE_SUCCESSOR.md` under `shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md`, enters `WAITING_FOR_SUCCESSOR_AGENT`, and stops. `reviewer-4` MUST NOT execute Phase 9. A fresh `reviewer-5` executes the generic successor reception checklist under profile `P8_TO_P9` and produces an accepted receipt before Phase 9 may become `READY`.

## Phase 9 — remediation

After an accepted Phase-8 handoff receipt binds fresh `reviewer-5`, if fixes exist, verify exact revised source, invalidate stale source-bound evidence, retest the finding, affected invariants, integrations, regression surfaces, and release configuration. If no fixes were supplied/required, complete the mandatory phase with an explicit `NO_REMEDIATION_ARTIFACTS_REQUIRED` record rather than skipping it.
- Complete `phases/phase-9/resources/PHASE9_REMEDIATION_DELTA_LEDGER.md`; if no remediation artifacts exist, file `NO_REMEDIATION_ARTIFACTS_REQUIRED` with evidence-bound reason.
Produce report; stop.

## Phase 10 — convergence and publication

Converge only controller-accepted evidence. Verify release/source identity, all phase reports/acks, validated findings/remediation states, coverage, limitations, process health, publication artifacts, and final user delivery.

Before publication, construct the full **assurance case** for every **material claim** using `phases/phase-10/resources/ASSURANCE_CASE.md` and `phases/phase-10/resources/ASSURANCE_CASE_AND_EVIDENCE_INDEPENDENCE.md`. Each material claim must bind requirement/security property → threat/failure mode → argument → accepted evidence → **evidence independence/diversity classification** → responsible lens → exact source identity → **exact release hash/immutable release identity** when release-bound → status → limitations. Same-agent procedural retraces remain `PROCEDURAL_INDEPENDENCE_ONLY`; correlated same-agent/shared-harness evidence must not be described as independent.

The client report contains the concise `Security Claims & Assurance Evidence` summary; the full assurance-case ledger and reproducible evidence remain in the evidence bundle. A missing material-claim record, stale release binding, or false evidence-independence claim prevents finalization.

- Before the Phase-10 report is submitted, create the pre-closure snapshot from `phases/phase-10/resources/PHASE10_AUDIT_CLOSURE_MANIFEST.json`, binding exact final release/source identity, Phase 0–9 report/automatic-advancement authorization digests, final finding/remediation states, assurance-case/evidence-bundle/final-report digests, process health, limitations, and explicit `PENDING_BY_SEQUENCE` states for the Phase-10 report/automatic-authorization fields. Preserve that snapshot digest.
Produce the final report, serve the separate completed `shared/reporting/Contract_Deployment_Gas_Report.md` alongside the final audit report and other final audit information, and produce a separate Phase-10 phase report. After Phase-10 report filing, automatic completeness authorization immediately creates a **new immutable terminal closure manifest** from the same template that references the pre-closure snapshot digest and adds the Phase-10 report digest plus `AUTO_AFTER_SEAL` authorization digest. Only that terminal manifest may record `completionStatus: COMPLETE`; do not mutate the sealed pre-closure snapshot.

## Findings, verdicts, and process status

Phase status vocabulary remains `PASS`, `INFORMATIONAL_ISSUE_FOUND`, `LOW_ISSUE_FOUND`, `MEDIUM_ISSUE_FOUND`, `HIGH_ISSUE_FOUND`, `CRITICAL_ISSUE_FOUND`, `FAIL`. `FAIL` means audit-process failure, never security severity. Final security verdict is `PASS` unless one or more unresolved validated High/Critical findings require `NO_GO`. Process failure prevents final completion rather than becoming `NO_GO`.

## Evidence invalidation matrix

Every material source/build/toolchain/harness/deployment/fork/dependency/remediation/model change MUST be classified through `shared/controller/EVIDENCE_INVALIDATION_MATRIX.json` before affected evidence is reused. `INVALIDATES` evidence remains immutable historical provenance but cannot support the changed target until replacement evidence is accepted. `REQUIRES_REBIND` preserves the old evidence for its old identity but requires exact new binding/execution for new claims. Record `INV-*` traceability nodes and `OBL-*` retest/reconciliation work as required.

## Repair authority

A trusted runner defect that changes execution implementation identity MUST enter `RUNNER_REPAIR_REBIND` under `shared/execution/EXECUTION_PREFLIGHT_AND_REPAIR_PROTOCOL.md`. Preserve the failed attempt, prohibit target-source changes, qualify the repaired Contract-Automation release, record old/new identities, rebind through the controller, then retry exact audit semantics.

The active reviewer may diagnose and repair audit-system mechanics within pinned controller/integrity rules: source staging, exact request construction, evidence fetching, stale state, phase report serialization, state reconciliation, and bounded retries. It may not bypass phase gates, fabricate evidence, weaken scope, silently omit a mandatory stage, mutate a automatic advancement, or reinterpret source identity. Irrecoverable process failure requires recovery-attempt receipts.

## Human interaction and automatic advancement

The human is **not** inside a per-phase approval loop in v29. Required Phase Reports and non-blocking updates remain visible to the human. Explicit human `STOP_AUDIT` or rework instructions are honored as new controller inputs when given, but lack of `CONTINUE`, silence, or absence of response never blocks progression. Automatic advancement requires every machine/durable seal criterion to pass and cannot weaken evidence requirements.
