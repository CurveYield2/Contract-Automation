---
name: audit-v7-independent-review
description: Sequential independent smart-contract audit workflow with progressive-disclosure phase modules, exact-source evidence, five fresh reviewer lineages, mandatory non-blocking work updates, repair-first process recovery, automatic post-seal phase advancement, three-agent Phase-6 assurance, layered adversarial execution, pinned-fork lifecycle simulation, finding validation, remediation review, and evidence-bound final reporting.
---

# Audit V7 Independent Review — Homepage

Release identity: `audit-v7-independent-review@1.32.0`
Package revision: `v38.3.4`

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
