---
name: audit-v7-independent-review-lite
description: Explicitly selected lower-resource EVM audit pathway retaining source-first security analysis, targeted candidate validation, exact deployment/configuration simulation, and a no-repeat upgrade to the Full pathway.
---

# Audit V7 Independent Review — Isolated Lite Pathway

Release identity: `audit-v7-independent-review-lite@1.0.0`
Package revision: `v38.3.3`

This page is the **only universal mandatory reading**. Resolve the exact campaign and phase, open only that phase's `START_HERE.md`, then open only resources explicitly linked by the active step or an explicit trigger. Do not preload the whole packet.

> **LITE AUTHORITY:** This copied pathway is active only after the human explicitly says `use lite mode`. It is isolated from the standard pathway. Do not import Full-path requirements that this Lite copy expressly removes, and never represent Lite execution as Full assurance.

> **LITE ORCHESTRATOR:** If the human appoints an orchestrator, open [`LITE_ORCHESTRATOR_MODE.md`](LITE_ORCHESTRATOR_MODE.md).

## Maximum Assurance Principle

This Lite process is designed to preserve maximum practical coverage of the core security analysis authorized by Lite mode while deliberately omitting the expensive comprehensive Phase 6–7 campaign.

Reviewers must prioritize completeness of analysis over speed of completion. The objective is not to demonstrate that the system works under expected conditions; it is to systematically evaluate whether the system remains secure across all meaningful reachable conditions, including normal operation, edge cases, adversarial behavior, failure modes, state transitions, external dependencies, and economic scenarios.

A successful audit is not defined by the number of tests executed or phases completed. It is defined by the quality of assurance obtained: whether reasonable attempts have been made to discover, reproduce, and evaluate every material security risk within scope.

When uncertainty exists inside the retained Lite scope, reviewers should expand analysis rather than assume safety. Behavior omitted by Lite authority remains an explicit assurance limitation and an upgrade target, not evidence of correctness.

**Coverage over convenience inside Lite scope:** Reviewers must not reduce retained analysis merely because a behavior appears unlikely, inconvenient, difficult to reproduce, or outside the happy path. Every Full-only process omitted by Lite authority must be enumerated in the Lite evidence record with residual-risk disclosure.

## Universal hard rules

Stable IDs are defined in [`shared/policy/UNIVERSAL_RULE_REGISTRY.json`](shared/policy/UNIVERSAL_RULE_REGISTRY.json). The exact normative text below is authoritative; linked phase/support files reference these IDs rather than duplicating the rules.

1. **[U-EXEC-001] Execute first; do not bother the human.** During an active phase, do not ask the human for troubleshooting, context, permission, confirmation, repository navigation, technical decisions, or information that can be obtained from the skill, exact campaign evidence, GitHub repositories, tools, prior phase artifacts, or recovery procedures. Do not stop merely to announce what you plan to do. Perform executable work now.
2. **[U-GITHUB-001] GitHub connector app only, with mandatory outage escalation.** Every GitHub repository read, search, fetch, write, branch, issue, pull request, workflow-artifact, or repository-file operation MUST use the connected **GitHub connector app**. Never substitute a web browser, browser connector, generic web search, raw/direct GitHub URL access, `curl`, `wget`, or another repository-access method. If the GitHub connector stops working or disappears, troubleshoot it immediately using the Recovery Router. After the prescribed connector recovery ladder is exhausted or the connector is proven unavailable, the auditor MUST report the confirmed connector outage to the human, identify the blocked repository work and recovery attempts, request only the external reconnect/re-enable action actually required, and then continue every unaffected authorized task without waiting.
3. **[U-STATE-001] Exact campaign/source/phase authority.** Resolve the exact campaign generation, controller state, current phase, source identity, and reviewer lineage before work. Durable controller/evidence state outranks chat recollection. Consume sealed work; never restart a sealed phase for convenience. Rework only through typed controller invalidation/rework.
4. **[U-EVIDENCE-001] Evidence integrity is absolute.** Never invent, infer, approximate, silently substitute, or silently carry stale evidence. Preserve exact source/request/job/artifact/result/release identities and explicit limitations. A source/release change must use the applicable invalidation/rebind path before prior evidence supports the new source.
5. **[U-REPAIR-001] Required process failure is an immediate repair trigger.** Diagnose, repair, retry, and continue now using the applicable recovery path. Do not merely record a required process failure and move on. Continue every unaffected authorized part of the phase. A required process may become typed `FAIL`/blocked only after prescribed discovery, repair, retry, fallback, and recovery paths are exhausted or proven impossible and the recovery evidence is filed. Process failure is not vulnerability severity.
6. **[U-HUMAN-001] Automatic post-seal advancement; no per-phase human approval.** When every mandatory phase seal criterion passes, the auditor files the Phase Report and the controller advances automatically. **Do not wait for `CONTINUE`, acknowledgement, approval, or silence.** Same-reviewer phases begin immediately after durable automatic advancement. Planned fresh-reviewer boundaries create/seal the successor package immediately and enter `WAITING_FOR_SUCCESSOR_AGENT`. A human may still issue an explicit stop or rework instruction at any time, but human approval is never a prerequisite for progression and cannot override evidence truth or mandatory work.
7. **[U-DISCLOSURE-001] Progressive disclosure is mandatory.** Homepage → exact current phase card → active step → explicitly linked/triggered resource. Do not read unrelated phase modules or specialist resources for convenience.
8. **[U-SOURCEINTEL-001] Reuse the accepted Source Intelligence Bundle; do not rediscover sealed facts or trust mutable paths.** Phase 0 MUST create/seal the immutable exact-template core and accepted overlay/bundle identities. `reviewer-2` verifies the Bundle once at combined Phase 2–5 entry. Later Lite segments reuse that accepted identity without repeating verification unless a material source/build/dependency/configuration/toolchain change triggers rebind or invalidation. Mutable paths are navigational; accepted revisions and digests are evidentiary. Raw source review remains mandatory for semantic work.

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
6. If no valid matching campaign exists and the human supplied a direct single-file ZIP URL, enter [Phase 0](phases/phase-0/START_HERE.md) and trigger the `Audit Source Initialization` workflow with that URL only. The workflow creates the next versioned Lite campaign, source folder, retained ZIP + unpacked source, source fence, initial controller state and active pointer. Never manually pre-create the campaign or require the human/agent to supply campaign ID, generation ID, filename, SHA-256 or byte size.

## Actor lineage & mandatory handoffs

Exactly one authorized actor is active at a time. The Phase-0 `web-bootstrap-agent` is a mechanical executor, not a semantic security reviewer:

| Reviewer | Authorized phases | Mandatory fresh-agent boundary after |
|---|---|---|
| `web-bootstrap-agent` (ChatGPT web chat + GitHub connector; mechanical authority only) | Phase 0 | Phase 0 → fresh reviewer-1 |
| `reviewer-1` (`gpt-5.6-terra`, high reasoning) | Phase 1 | Phase 1 |
| `reviewer-2` (`gpt-5.6-sol`, high reasoning) | Combined Phases 2–5 | Phase 5 |
| `reviewer-3L` (`gpt-5.6-sol`, high reasoning) | Merged Lite Phases 6–7 | merged Phase 7 completion |
| `reviewer-4` (`gpt-5.6-sol`, high reasoning) | Combined Phases 8–10 | none |

Fresh-session handoffs are mandatory after **Phase 0, Phase 1, Phase 5, and merged Lite Phase 6–7**. Phase 0 uses `P0_TO_P1` to transfer the sealed mechanical/bootstrap baseline to fresh high-reasoning reviewer-1. All boundaries use the copied Lite [`SUCCESSOR_HANDOFF_PROTOCOL`](shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md) and Lite boundary profiles. A successor consumes sealed evidence and does not redo prior work for convenience. The short Phase-5 contradiction/candidate reconciliation is not clean-room independence.

### Mandatory standardized successor wake message

Every fresh-reviewer boundary MUST create a campaign-local `WAKE_UP_MESSAGE.md` using [`shared/handoff/WAKE_UP_MESSAGE_TEMPLATE.md`](shared/handoff/WAKE_UP_MESSAGE_TEMPLATE.md). Generic wake prompts are forbidden. The message must explicitly identify:

- campaign type: **LITE**;
- exact campaign folder name;
- exact campaign-folder GitHub URL and controller `workspacePath`;
- current authority Lite skill location: `CurveYield2/Contract-Automation/Audit Skill - Current Authority/Audit_V7_independent_Review_skill_v38/optional-modes/lite-pathway/SKILL.md`;
- boundary and incoming reviewer; and
- exact assigned work: Phase 1, Combined Lite Phases 2–5, Merged Lite Phases 6–7, or Combined Lite Phases 8–10.

For `P0_TO_P1`, Phase 0 must create and validate this Phase-1 wake message **before** controller completion validation is requested.

### Handoff discovery — conditional

Only when entering a fresh-reviewer boundary or recovering from context loss, open [`HANDOFF_DISCOVERY_AND_CONTEXT_RECOVERY.md`](shared/handoff/HANDOFF_DISCOVERY_AND_CONTEXT_RECOVERY.md). Normal same-reviewer work does not preload handoff-discovery instructions.

## Recovery Router — conditional

Do **not** preload recovery mechanics during healthy execution. If a connector/controller/execution/handoff/source-identity failure actually occurs, open [`shared/controller/RECOVERY_ROUTER.md`](shared/controller/RECOVERY_ROUTER.md), execute the applicable repair route, and continue unaffected work.

## Campaign-global audit state

Three mechanical controls span the full audit without requiring agents to preload later phase methodology:

- **Current Phase Contract:** each phase begins with its local [`PHASE_CONTRACT.json`](phases/phase-0/PHASE_CONTRACT.json) pattern. Open only the contract inside the current phase folder. It defines what must happen before that phase can seal.
- **Security Traceability Graph:** [`shared/controller/SECURITY_TRACEABILITY_GRAPH.json`](shared/controller/SECURITY_TRACEABILITY_GRAPH.json) defines the canonical campaign-global graph linking security properties, threats, review/test evidence, candidates/findings, remediation and final claims. Maintain it live; seal/checkpoint it only at Lite milestones.
- **Carried-Forward Obligation Ledger:** [`shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json`](shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json) defines the canonical `OBL-*` ledger for later-phase work. At phase start, enumerate obligations due now; before sealing, reconcile all of them. A due `OPEN`/`IN_PROGRESS` obligation blocks sealing.

These are campaign-global state artifacts, not extra phases. Their current durable references/digests must be preserved across reviewer handoffs and recorded in the Phase-1, combined Phase-2–5, merged Phase-6–7, and combined Phase-8–10 milestone reports.

## Universal phase boundary

Every Lite milestone follows:

`READY → ACTIVE/preflight as applicable → EVIDENCE_SEALED → PHASE_REPORT_SUBMITTED → AUTO_ADVANCE_READY → next authorized state`

There is **no per-phase human approval gate**. Phases 2, 3, and 4 are internal analytical segments and do not file independent phase reports or seal duplicate global checkpoints; reviewer-2 maintains live state and seals one combined Phase 2–5 milestone after Phase 5. Merged Lite Phase 6–7 seals one milestone. Reviewer-4 seals the Phase 8–10 milestone, executing Phase 9 only when remediation exists.

Merged Lite Phase 6–7 uses one reviewer and only exact build admission, complete deployment/configuration simulation, candidate-specific deterministic simulation, and basic targeted fuzzing. It omits Medusa, broad/semi-targeted randomized discovery, stateful randomized campaigns, chaos, mutation, differential/reference-model work, corpus/deep campaigns, exhaustive known-attack campaigns, coverage-guided reruns, and comprehensive coverage closure.

At each Lite milestone end, use the milestone-specific structured artifact plus the copied [Phase Report](shared/reporting/PHASE_REPORT.md). The report must include **Canonical outputs created**, **New canonical audit facts**, **Carried-forward obligations**, **Evidence invalidation triggers**, and the exact automatic next transition.

Rules and migration behavior are defined by [Automatic Phase Advancement Protocol](shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md).

### Deterministic domain applicability

Specialist-domain coverage is controlled by [`shared/controller/DOMAIN_APPLICABILITY_MATRIX.json`](shared/controller/DOMAIN_APPLICABILITY_MATRIX.json) and the campaign-local registry. Phase 3 classifies once and Phase 4 executes every activated material domain. Reevaluate only when later evidence changes a trigger fact. `UNCERTAIN_INCLUDE` remains triggered; ambiguity never authorizes a skip.

## Canonical Source Intelligence

Phase 0 web-bootstrap creates the audit-wide immutable structural core from [`SOURCE_INTELLIGENCE_TEMPLATE.json`](shared/source-intelligence/SOURCE_INTELLIGENCE_TEMPLATE.json), initializes the revisioned [runtime/deployment](shared/source-intelligence/RUNTIME_DEPLOYMENT_OVERLAY_TEMPLATE.json) and [assurance-readiness](shared/source-intelligence/ASSURANCE_READINESS_OVERLAY_TEMPLATE.json) overlays, and pins them through the [Bundle Index](shared/source-intelligence/SOURCE_INTELLIGENCE_BUNDLE_TEMPLATE.json). The exact generation, acceptance, reuse, ownership and invalidation rules are in [`SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md`](shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md).

## Phase map — open only the current phase

| Phase | Purpose | Go here |
|---:|---|---|
| 0 | Web bootstrap: audit admission, source/build identity, existing-repo automation supervision, Source Intelligence, neutral reconnaissance and reusable structural preparation | [Phase 0 →](phases/phase-0/START_HERE.md) |
| 1 | High-reasoning semantic scope/dependency/standards analysis and security risk grade; handoff to reviewer-2 | [Phase 1 →](phases/phase-1/START_HERE.md) |
| 2–5 | One continuous analytical run: specification → threat/domain model → complete manual/specialist review → economic/math review → short contradiction/candidate reconciliation; one combined report | [Combined Phase 2–5 →](phases/phase-2/START_HERE.md) |
| 6–7 | One reviewer: exact build admission, complete deployment/configuration simulation, candidate-specific deterministic simulation, and basic targeted fuzzing; one combined report | [Merged Lite Phase 6–7 →](phases/phase-6/START_HERE.md) |
| 8–10 | One reviewer: candidate validation → remediation only when supplied → concise evidence index and final report | [Combined Phase 8–10 →](phases/phase-8/START_HERE.md) |

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
