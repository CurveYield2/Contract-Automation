---
name: audit-v7-independent-review
description: Sequential independent smart-contract audit workflow with progressive-disclosure phase modules, exact-source evidence, five fresh reviewer lineages, mandatory non-blocking work updates, repair-first process recovery, automatic post-seal phase advancement, three-agent Phase-6 assurance, layered adversarial execution, pinned-fork lifecycle simulation, finding validation, remediation review, and evidence-bound final reporting.
---

# Audit V7 Independent Review — Homepage

Release identity: `audit-v7-independent-review@1.32.0`
Package revision: `v38.3.3`

This page is the **only universal mandatory reading**. Resolve the exact campaign and phase, open only that phase's `START_HERE.md`, then open only resources explicitly linked by the active step or an explicit trigger. Do not preload the whole packet.

> **ORCHESTRATOR AGENT:** If the human explicitly appoints you as the audit orchestrator, go to [`optional-modes/ORCHESTRATOR_MODE.md`](optional-modes/ORCHESTRATOR_MODE.md).

> **LITE MODE ENABLED:** If the human explicitly says `use lite mode`, go to [`optional-modes/LITE_MODE.md`](optional-modes/LITE_MODE.md).

## Maximum Assurance Principle

This audit process is designed to achieve the highest practical assurance coverage possible, not merely minimum compliance with required checks.

Reviewers must prioritize completeness of analysis over speed of completion. The objective is not to demonstrate that the system works under expected conditions; it is to systematically evaluate whether the system remains secure across all meaningful reachable conditions, including normal operation, edge cases, adversarial behavior, failure modes, state transitions, external dependencies, and economic scenarios.

A successful audit is not defined by the number of tests executed or phases completed. It is defined by the quality of assurance obtained: whether reasonable attempts have been made to discover, reproduce, and evaluate every material security risk within scope.

When uncertainty exists, reviewers should expand analysis rather than assume safety. Untested reachable behavior is an assurance gap, not evidence of correctness.

**Coverage over convenience:** Reviewers must not reduce testing scope merely because a behavior appears unlikely, inconvenient to simulate, difficult to reproduce, or outside the happy path. Any omitted analysis must have an explicit justification and residual-risk assessment.

## Universal hard rules

Stable IDs are defined in [`shared/policy/UNIVERSAL_RULE_REGISTRY.json`](shared/policy/UNIVERSAL_RULE_REGISTRY.json). The exact normative text below is authoritative; linked phase/support files reference these IDs rather than duplicating the rules.

1. **[U-EXEC-001] Execute first; do not bother the human.** During an active phase, do not ask the human for troubleshooting, context, permission, confirmation, repository navigation, technical decisions, or information that can be obtained from the skill, exact campaign evidence, GitHub repositories, tools, prior phase artifacts, or recovery procedures. Do not stop merely to announce what you plan to do. Perform executable work now.
2. **[U-GITHUB-001] GitHub connector app only, with mandatory outage escalation.** Every GitHub repository read, search, fetch, write, branch, issue, pull request, workflow-artifact, or repository-file operation MUST use the connected **GitHub connector app**. Never substitute a web browser, browser connector, generic web search, raw/direct GitHub URL access, `curl`, `wget`, or another repository-access method. If the GitHub connector stops working or disappears, troubleshoot it immediately using the Recovery Router. After the prescribed connector recovery ladder is exhausted or the connector is proven unavailable, the auditor MUST report the confirmed connector outage to the human, identify the blocked repository work and recovery attempts, request only the external reconnect/re-enable action actually required, and then continue every unaffected authorized task without waiting.
3. **[U-STATE-001] Exact campaign/source/phase authority.** Resolve the exact campaign generation, controller state, current phase, source identity, and reviewer lineage before work. Durable controller/evidence state outranks chat recollection. Consume sealed work; never restart a sealed phase for convenience. Rework only through typed controller invalidation/rework.
4. **[U-EVIDENCE-001] Evidence integrity is absolute.** Never invent, infer, approximate, silently substitute, or silently carry stale evidence. Preserve exact source/request/job/artifact/result/release identities and explicit limitations. A source/release change must use the applicable invalidation/rebind path before prior evidence supports the new source.
5. **[U-REPAIR-001] Required process failure is an immediate repair trigger.** Diagnose, repair, retry, and continue now using the applicable recovery path. Do not merely record a required process failure and move on. Continue every unaffected authorized part of the phase. A required process may become typed `FAIL`/blocked only after prescribed discovery, repair, retry, fallback, and recovery paths are exhausted or proven impossible and the recovery evidence is filed. Process failure is not vulnerability severity.
6. **[U-HUMAN-001] Automatic post-seal advancement; no per-phase human approval.** When every mandatory phase seal criterion passes, the auditor files the Phase Report and the controller advances automatically. **Do not wait for `CONTINUE`, acknowledgement, approval, or silence.** Same-reviewer phases begin immediately after durable automatic advancement. Planned fresh-reviewer boundaries create/seal the successor package immediately and enter `WAITING_FOR_SUCCESSOR_AGENT`. A human may still issue an explicit stop or rework instruction at any time, but human approval is never a prerequisite for progression and cannot override evidence truth or mandatory work.
7. **[U-DISCLOSURE-001] Progressive disclosure is mandatory.** Homepage → exact current phase card → active step → explicitly linked/triggered resource. Do not read unrelated phase modules or specialist resources for convenience.
8. **[U-SOURCEINTEL-001] Reuse the accepted Source Intelligence Bundle; do not rediscover sealed facts or trust mutable paths.** Phase 1 MUST create/seal the immutable exact-template core, including structural security surfaces/topology and preliminary compiler gas; initialize the runtime/deployment and assurance-readiness overlays; and commit a bundle index that pins accepted revision, commit, SHA-256, status, invalidation state and preserved snapshot for every component. For the same accepted source/build identity, Phases 2–10 MUST load/verify that bundle index before use and MUST NOT rebuild Phase-1 inventories merely for orientation. Mutable paths are navigational; accepted revisions and digests are evidentiary. Phase 6A separately accepts readiness adequacy, Phase 7 separately accepts runtime/configuration/gas evidence, Phase 9 regenerates/rebinds changed source, and Phase 10 verifies the final bundle. Raw source review remains mandatory for semantic work.

### [U-SOURCEINT-002] Incremental Intelligence Rule

Downstream phases MUST treat the accepted Source Intelligence Bundle as the baseline structural model of the audited system.

Reviewers MUST extend existing intelligence rather than recreate equivalent inventories, topology maps, privilege maps, dependency summaries, or surface catalogs.

Additional source inspection is encouraged for semantic validation, exploit construction, contradiction resolution, or newly discovered scope. Such inspection MUST produce incremental intelligence updates instead of duplicate structural summaries.


## [U-UPDATES-001] Mandatory non-blocking work updates

During every active phase, the auditor **MUST provide concise inline work updates at reasonable intervals** so the human can see meaningful progress. These updates are execution-side progress signals only.

- Give an update after approximately **2–4 meaningful execution actions**, whenever a material finding/blocker is discovered, whenever a significant repair succeeds or fails, and whenever a major phase milestone is completed.
- Prefer completed-action language: what was actually verified, executed, found, repaired, or sealed.
- An update is **never** a stopping point, completion condition, request for permission, or reason to await a human response.
- Immediately after every update, continue executing the current phase in the same run while authorized work remains.
- Statements such as “I'll continue,” “I'm going to investigate,” “next I'll…,” “I'll get started,” or equivalent never satisfy execution by themselves.
- **A progress update cannot terminate an active-phase turn. If any authorized current-phase work can still be performed, stopping is prohibited.**

## [U-HUMANCOMMS-001] Human interaction — allowed communications only

Outside the mandatory non-blocking work updates above, the auditor may communicate with the human only for:

1. **End-of-phase report** — required phase work is complete/terminal, evidence is sealed, and the Phase Report is ready.
2. **Genuine irrecoverable phase blocker** — only after all applicable discovery, repair, retry, fallback, and recovery paths are exhausted or proven impossible. The message must state exactly what remains incomplete, why it is required, every recovery path attempted, evidence proving the blocker, and the exact external action required from the human.
3. **Required source upload** — required source material does not exist in an accessible GitHub repository and cannot be recovered through controller/campaign evidence. The auditor may ask the human only to upload/place the required source files in GitHub, identifying the exact repository/path when known, then resume the same phase.
4. **Confirmed GitHub connector outage** — if the GitHub connector app stops working or becomes unavailable, first exhaust the connector troubleshooting/recovery ladder. If repository access is still unavailable, send one concise mandatory outage report stating the exact connector operations/errors, recovery attempts, repositories/work blocked, unaffected work that will continue, and the exact reconnect/re-enable action required from the human if any. This report is required even when some non-GitHub phase work can continue, and it is not permission to stop that unaffected work.
5. **Phase-8 remediation guidance** — concrete suggested repairs for validated findings belong in the Phase-8 finding records/end-of-phase report. Phase 9 verifies supplied remediation; it is not a general question phase.

Do **not** tell the human that something cannot be found until the applicable search/recovery ladder is exhausted. Do **not** tell the human something cannot be done until prescribed repair/retry/fallback paths are exhausted or proven impossible. Do not ask for prior-chat context as a substitute for durable evidence.

## GitHub repositories

- **Audit controller / durable campaign ledger:** [`CurveYield2/Audit-Controller`](https://github.com/CurveYield2/Audit-Controller)
- **Trusted technical execution / harness skeletons:** [`CurveYield2/Contract-Automation`](https://github.com/CurveYield2/Contract-Automation)

The links identify repositories for humans. **Agents must use the GitHub connector app to access them.**

For GitHub Actions, do **not** assume the absence of a direct `workflow_dispatch` tool means Actions are unavailable. Technical-execution phases route to [`shared/execution/GITHUB_ACTIONS_VIA_GITHUB_APP.md`](shared/execution/GITHUB_ACTIONS_VIA_GITHUB_APP.md), which defines how to inspect `on:` triggers, create agent-operable events, create new workflows safely, verify runs, and troubleshoot failures.

## Start or resume the exact audit

Use the GitHub connector app against `CurveYield2/Audit-Controller`:

1. Inspect `.deep-assurance/active/` first.
2. Resolve the active pointer matching the requested project/audit token; do not choose by filename similarity when generations differ.
3. Bind the exact `campaignId`, `campaignGenerationId`, `phaseSequence`, `status`, `sourceRepository`, `sourceCommit`/source digest, `controllerBranch`, and `workspacePath` from controller state.
4. Follow the exact controller-provided `workspacePath` under `campaigns/`; never invent, normalize, rename, or substitute a campaign folder.
5. Confirm workspace generation/source identity before writing anything.
6. If no valid matching campaign exists, campaign creation is a **Phase-0 controller action**. Enter [Phase 0](phases/phase-0/START_HERE.md); never create an arbitrary `campaigns/` folder and declare it valid.

## Reviewer lineage & mandatory handoffs

Exactly one reviewer is active at a time:

| Reviewer | Authorized phases | Mandatory fresh-agent boundary after |
|---|---|---|
| `reviewer-1` (`gpt-5.6-terra`, high reasoning) | Phases 0–1 | Phase 1 |
| `reviewer-2` (`gpt-5.6-sol`) | Phases 2–5 | Phase 5 |
| `reviewer-3` | Phase 6 only (`reviewer-3A`/`3B`/`3C`) | Phase 6 |
| `reviewer-4` | Phases 7–8 | Phase 8 |
| `reviewer-5` | Phases 9–10 | none |

Fresh-session handoffs are mandatory after **Phase 1, Phase 5, Phase 6, and Phase 8**. All boundaries use the single generic [`SUCCESSOR_HANDOFF_PROTOCOL`](shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md) plus an exact boundary profile from [`SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json`](shared/handoff/SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json). A successor consumes sealed evidence and does not redo prior phases for convenience. A fresh session/agent lineage does **not** automatically make inherited evidence clean-room independent; use the evidence-independence classifications defined by the audit. The Phase-5 source-first retrace remains explicitly `PROCEDURAL_INDEPENDENCE_ONLY`.

### Find campaign-local handoffs

Use the GitHub connector app inside the exact current campaign `workspacePath`. Resolve the handoff referenced by controller state for the applicable boundary:

- Phase 1 → 2: profile `P1_TO_P2` under `handoffs/P1_TO_P2/`.
- Phase 5 → 6: profile `P5_TO_P6` under `handoffs/P5_TO_P6/`.
- Phase 6 → 7: profile `P6_TO_P7` under `handoffs/P6_TO_P7/`.
- Phase 8 → 9: profile `P8_TO_P9` under `handoffs/P8_TO_P9/`.

At a fresh-reviewer boundary, the successor reads the campaign-local `START_HERE_SUCCESSOR.md` **first**, then verifies the authoritative `SUCCESSOR_HANDOFF.json` and creates `SUCCESSOR_HANDOFF_RECEIPT.json`. The bootstrap packet is routing-only and never replaces the authoritative handoff.

Never substitute another campaign/generation's handoff. Each receiving phase card contains the exact reception checklist and recovery ladder.

### Repository recovery/context-loss handoff folder

For fresh-reviewer or context-loss handoffs, use the exact **campaign-local successor handoff** referenced by the current campaign state / Phase Contract. Current repository-level agent guidance lives under `docs/agent-guides/` in `CurveYield2/Audit-Controller`. Material under `archive/recovery/` is historical provenance only and MUST NOT be treated as active handoff authority.

## Something broke? — Recovery Router

| Problem | Immediate route |
|---|---|
| **GitHub connector app missing, unavailable, permission-denied, or repeatedly failing** | **Do not substitute another repository interface.** Use the [Operations & Recovery lens](shared/lenses/operations-recovery-lens.md) and [Audit Controller/GitHub Protocol](shared/controller/AUDIT_CONTROLLER_AND_GITHUB_PROTOCOL.md). Exhaust the connector recovery ladder, preserve the failure evidence, then send the mandatory GitHub connector outage report if still unavailable and continue unaffected work. |
| Controller, campaign state, evidence retrieval, report serialization, repository workflow, or other audit-system mechanics | [Operations & Recovery lens](shared/lenses/operations-recovery-lens.md) · [Process Integrity Ledger](shared/policy/PROCESS_INTEGRITY_LEDGER.md) · [Process Blocker Receipt](shared/reporting/PROCESS_BLOCKER_RECEIPT.json) |
| Compile/fuzz/simulation/runner/tool/RPC execution failure | [Execution Preflight & Repair Protocol](shared/execution/EXECUTION_PREFLIGHT_AND_REPAIR_PROTOCOL.md) · [Technical Execution Playbook](shared/execution/TECHNICAL_EXECUTION_REQUEST_PLAYBOOK.md) |
| Missing/corrupt successor handoff | Use the receiving phase's linked handoff reception checklist and recovery ladder; do not ask the human before exhausting it. |
| Source/release identity changed | Return to the current phase's evidence-invalidation obligations plus the [Process Integrity Ledger](shared/policy/PROCESS_INTEGRITY_LEDGER.md); invalidate/rebind source-bound evidence before reuse. |
| Required source absent from accessible GitHub | Exhaust controller/campaign/GitHub-connector recovery, then use the narrow source-upload human exception above. |

Routine repair activity is not a reason to stop or ask the human. Repair and continue.

## Campaign-global audit state

Three mechanical controls span the full audit without requiring agents to preload later phase methodology:

- **Current Phase Contract:** each phase begins with its local [`PHASE_CONTRACT.json`](phases/phase-0/PHASE_CONTRACT.json) pattern. Open only the contract inside the current phase folder. It defines what must happen before that phase can seal.
- **Security Traceability Graph:** [`shared/controller/SECURITY_TRACEABILITY_GRAPH.json`](shared/controller/SECURITY_TRACEABILITY_GRAPH.json) defines the canonical campaign-global graph linking security properties, threats, review/test evidence, candidates/findings, remediation and final claims. Every phase checkpoints it.
- **Carried-Forward Obligation Ledger:** [`shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json`](shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json) defines the canonical `OBL-*` ledger for later-phase work. At phase start, enumerate obligations due now; before sealing, reconcile all of them. A due `OPEN`/`IN_PROGRESS` obligation blocks sealing.

These are campaign-global state artifacts, not extra phases. Their current durable references/digests must be preserved across reviewer handoffs and recorded in every Phase Report.

## Universal phase boundary

Every ordinary phase follows:

`READY → ACTIVE/preflight as applicable → EVIDENCE_SEALED → PHASE_REPORT_SUBMITTED → AUTO_ADVANCE_READY → next authorized state`

There is **no per-phase human approval gate**. `AUTO_ADVANCE_READY` is authorized only when the current Phase Contract, due-obligation reconciliation, invalidation checks, structured filing, and Phase Report are complete. At same-reviewer boundaries the controller immediately enters the next phase `READY`/preflight state. At planned fresh-reviewer boundaries the outgoing reviewer immediately creates the sealed successor handoff + `WAKE_UP_MESSAGE.md`, enters `WAITING_FOR_SUCCESSOR_AGENT`, gives the human the normal report plus copy-ready wake-up block, and stops because the *new agent*, not human approval, is the remaining dependency.

Phase 6 is one audit phase with three mandatory fresh sub-reviewers: **Phase 6A design/admission → Phase 6B Medusa primary adversarial execution → Phase 6C independent Foundry/assurance closure**. These are internal successor boundaries, not new numbered audit phases.

At each phase end, use the phase-specific structured artifact plus the universal [Phase Report](shared/reporting/PHASE_REPORT.md). The report must include **Canonical outputs created**, **New canonical audit facts**, **Carried-forward obligations**, **Evidence invalidation triggers**, and the exact automatic next transition.

Rules and migration behavior are defined by [Automatic Phase Advancement Protocol](shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md).

### Deterministic domain applicability

Specialist-domain coverage is controlled by [`shared/controller/DOMAIN_APPLICABILITY_MATRIX.json`](shared/controller/DOMAIN_APPLICABILITY_MATRIX.json) and the campaign-local registry derived from [`shared/controller/DOMAIN_APPLICABILITY_REGISTRY.json`](shared/controller/DOMAIN_APPLICABILITY_REGISTRY.json). Phase 3 classifies, Phase 4 executes every activated domain, and Phases 6/7 consume/re-evaluate decisions for fuzz/simulation targeting. `UNCERTAIN_INCLUDE` is treated as triggered; ambiguity never authorizes a skip. Detailed rules remain in the active phase card.

## Canonical Source Intelligence

Phase 1 creates the audit-wide immutable structural core from [`SOURCE_INTELLIGENCE_TEMPLATE.json`](shared/source-intelligence/SOURCE_INTELLIGENCE_TEMPLATE.json), initializes the revisioned [runtime/deployment](shared/source-intelligence/RUNTIME_DEPLOYMENT_OVERLAY_TEMPLATE.json) and [assurance-readiness](shared/source-intelligence/ASSURANCE_READINESS_OVERLAY_TEMPLATE.json) overlays, and pins them through the [Bundle Index](shared/source-intelligence/SOURCE_INTELLIGENCE_BUNDLE_TEMPLATE.json). The exact generation, acceptance, reuse, ownership and invalidation rules are in [`SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md`](shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md).

## Phase map — open only the current phase

| Phase | Purpose | Go here |
|---:|---|---|
| 0 | Audit admission, source identity, capability preflight | [Phase 0 →](phases/phase-0/START_HERE.md) |
| 1 | Scope, provenance, build admission, neutral reconnaissance, security risk grade; handoff to reviewer-2 | [Phase 1 →](phases/phase-1/START_HERE.md) |
| 2 | Fresh-reviewer executable specification and canonical security properties | [Phase 2 →](phases/phase-2/START_HERE.md) |
| 3 | Architecture, privileges, dependencies and attack hypotheses | [Phase 3 →](phases/phase-3/START_HERE.md) |
| 4 | Manual implementation and integration review | [Phase 4 →](phases/phase-4/START_HERE.md) |
| 5 | Economic/math review, procedural retrace, handoff to reviewer-3 | [Phase 5 →](phases/phase-5/START_HERE.md) |
| 6 | Three-agent dynamic assurance: 6A design/admission → 6B Medusa attacks → 6C Foundry/coverage closure; then handoff to reviewer-4 | [Phase 6 →](phases/phase-6/START_HERE.md) |
| 7 | Pinned-fork lifecycle and deterministic simulations | [Phase 7 →](phases/phase-7/START_HERE.md) |
| 8 | Candidate validation, remediation guidance, severity; handoff to reviewer-5 | [Phase 8 →](phases/phase-8/START_HERE.md) |
| 9 | Remediation and regression review | [Phase 9 →](phases/phase-9/START_HERE.md) |
| 10 | Evidence convergence, release verification and final report | [Phase 10 →](phases/phase-10/START_HERE.md) |

## Universal supporting authority

Do **not** read these by default. Phase cards/recovery routes link them when needed:

- [Controller contract](shared/controller/AI_Auditor_Controller.md)
- [Workflow state machine](shared/controller/SOLO_WORKFLOW_STATE_MACHINE.json)
- [Automatic phase advancement protocol](shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md)
- [Phase status / verdict policy](shared/policy/PHASE_STATUS_AND_VERDICT_POLICY.md)
- [Universal rule registry](shared/policy/UNIVERSAL_RULE_REGISTRY.json)
- [Evidence invalidation matrix](shared/controller/EVIDENCE_INVALIDATION_MATRIX.json)
- [Generic successor handoff engine](shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md)

If a phase card and a linked supporting resource conflict, the phase card controls phase routing while the controller/state machine controls admissible state transitions. Neither may override the universal hard rules on this homepage.
