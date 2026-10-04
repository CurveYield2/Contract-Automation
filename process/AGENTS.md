# Process State Local Agent Rules

This file adds process-state rules to the repository-root `AGENTS.md`.

- `process/` is for canonical durable control/state material, not scratch notes or per-retry reports.
- Maintain one current state/lock/registration per task or process unless the governing schema explicitly requires immutable historical evidence.
- Do not create repeated `STATUS_vN`, `REPORT_vN`, `HANDOFF_vN`, `RETRY_vN`, or copied request files merely to record each attempt.
- Update the existing canonical state when mutable state is intended.
- Completed/superseded transient request files must be retired according to the owning process rather than accumulated forever.
- Do not create a second manager/registration/request for work that already has an active canonical identity.
- Read existing state before analyzing or restarting work; do not reconstruct completed work from scratch.
- Task-lock systems must have one active lock file per task. Do not make status copies of the lock in neighboring folders.
