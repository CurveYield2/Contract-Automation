# Audit Controller and GitHub Protocol v1

## GitHub connector access hard gate

All repository access to `CurveYield2/Audit-Controller` and `CurveYield2/Contract-Automation` MUST use the connected **GitHub connector app**. A web browser, browser connector, generic web search, direct/raw GitHub URL outside the GitHub connector, `curl`, `wget`, or another repository-access mechanism is not an admitted substitute.

## GitHub connector outage recovery and mandatory human report

Loss of the GitHub connector app is a recoverable audit-system failure first, not an immediate reason to stop or substitute another repository interface. When a required GitHub operation fails because the connector is missing, unavailable, permission-denied, disconnected, or repeatedly errors, the active reviewer MUST:

1. preserve the exact failed operation, repository, timestamp/error text, and any available tool/connector evidence;
2. verify whether the GitHub connector app/tool is still exposed to the current agent/session and re-discover/reselect it through the available connected-app/tool interface when possible;
3. retry a minimal read-only known-repository operation against `CurveYield2/Audit-Controller`;
4. separately retry a minimal read-only known-repository operation against `CurveYield2/Contract-Automation` when that repository is required by the phase, so repository-specific permission failure is distinguished from total connector loss;
5. verify current connector authorization/permissions when that state is available to the agent and perform bounded retries after recoverable/transient errors;
6. use the Operations & Recovery lens and file a `PROCESS_BLOCKER_RECEIPT.json` containing the failed operations, exact errors, recovery attempts, and affected/unaffected work;
7. if the connector remains unavailable after these recovery paths are exhausted or proven impossible, **send the human a mandatory GitHub connector outage report**. The report must identify the exact repository operations blocked, errors observed, troubleshooting performed, evidence/receipt reference, unaffected work that will continue, and the exact external reconnect/re-enable action required if any; and
8. immediately continue every authorized current-phase task that does not require unavailable GitHub access. The outage report is not a stopping point.

The auditor MUST NOT claim repository state from browser/search/cache data while the connector is unavailable. If the human restores the connector, retry the exact blocked operation, verify repository identity/state, update the blocker receipt, and resume from the exact interrupted point rather than restarting completed work.

GitHub is the durable campaign/evidence ledger. The controller stores the active reviewer identity plus sequential reviewer-lineage history, current phase/revision, exact source/release identities, typed technical requests/results, evidence references/digests, findings/remediation ledgers, phase reports, automatic advancement authorizations, the P1→P2, P5→P6A, P6A→P6B, P6B→P6C, P6C→P7, and P8→P9 successor handoff packages/receipts, and terminal publication/delivery receipts.

Concurrent multi-agent worker registration, per-agent mailboxes, poll ownership, lease reassignment, unplanned replacement agents, and orchestrator takeover are not part of V7. Planned execution is sequential at reviewer boundaries: `reviewer-1` → `reviewer-2` → `reviewer-3A` → `reviewer-3B` → `reviewer-3C` → `reviewer-4` → `reviewer-5`. Phase 6 uses three fresh subreviewers so its assurance workload does not depend on one context window.

Required fencing dimensions remain campaign generation, exact source identity, controller schema/version, phase sequence/revision, request/job/artifact/result identity, and report/automatic-advancement identity. Stale-generation or stale-source writes are rejected.

The controller may mechanically group evidence and candidates but may not invent security judgment. The active reviewer owns semantic judgment for the authorized phase segment. Routine phase progression is automatic after the applicable seal/completeness criteria pass; the human may still issue explicit stop/rework instructions but is not a progression gate.


## Admitted execution contract

The controller, not the skill packet, is the operational authority for the accepted Contract-Automation release. Before technical execution the campaign binds an admitted execution contract containing `contractAutomationRelease`, `runnerRelease`, request schema/profile policy, and repository-level qualification evidence. Historical/deleted-organization identities are provenance-only.

## Phase 6/7 preflight states

Phase 6 enters `PHASE6_EXECUTION_PREFLIGHT` before `ACTIVE`. Phase 7 enters `PHASE7_FORK_PREFLIGHT` before lifecycle execution. The required checks and terminal applicability behavior are defined in `EXECUTION_PREFLIGHT_AND_REPAIR_PROTOCOL.md`.

## Runner repair and rebind

Trusted-runner defects enter `RUNNER_REPAIR_REBIND`. The failed attempt remains immutable evidence. Only infrastructure changes are permitted; target source identity is frozen. A repaired Contract-Automation release must pass repository-level qualification before the controller can bind the new execution contract and retry the audit semantics.
