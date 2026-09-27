# Lite Recovery Router

Open this file only after an actual failure/blocker/identity-change trigger. Routine audit execution does not preload recovery mechanics. Universal repair-first and GitHub-connector rules remain binding from `SKILL.md`.

## Recovery routes

| Problem | Immediate route |
|---|---|
| **GitHub connector app missing, unavailable, permission-denied, or repeatedly failing** | **Do not substitute another repository interface.** Use the [Operations & Recovery lens](../lenses/operations-recovery-lens.md) and [Audit Controller/GitHub Protocol](../controller/AUDIT_CONTROLLER_AND_GITHUB_PROTOCOL.md). Exhaust the connector recovery ladder, preserve the failure evidence, then send the mandatory GitHub connector outage report if still unavailable and continue unaffected work. |
| Controller, campaign state, evidence retrieval, report serialization, repository workflow, or other audit-system mechanics | [Operations & Recovery lens](../lenses/operations-recovery-lens.md) · [Process Integrity Ledger](../policy/PROCESS_INTEGRITY_LEDGER.md) · [Process Blocker Receipt](../reporting/PROCESS_BLOCKER_RECEIPT.json) |
| Compile/fuzz/simulation/runner/tool/RPC execution failure | [Execution Preflight & Repair Protocol](../execution/EXECUTION_PREFLIGHT_AND_REPAIR_PROTOCOL.md) · [Technical Execution Playbook](../execution/TECHNICAL_EXECUTION_REQUEST_PLAYBOOK.md) |
| Missing/corrupt successor handoff | Use the receiving phase's linked handoff reception checklist and recovery ladder; do not ask the human before exhausting it. |
| Source/release identity changed | Return to the current phase's evidence-invalidation obligations plus the [Process Integrity Ledger](../policy/PROCESS_INTEGRITY_LEDGER.md); invalidate/rebind source-bound evidence before reuse. |
| Required source absent from accessible GitHub | Exhaust controller/campaign/GitHub-connector recovery, then use the narrow source-upload human exception above. |

Routine repair activity is not a reason to stop or ask the human. Repair and continue.
