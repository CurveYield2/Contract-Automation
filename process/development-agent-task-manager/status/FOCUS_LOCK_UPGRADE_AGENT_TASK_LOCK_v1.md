# Focus Lock — Upgrade Agent Task-Lock Implementation v1

## END-STATE INVARIANT

Implement a reusable focus/task-lock system for repository upgrade/development agents in `CurveYield2/Contract-Automation` so upgrade agents remain anchored to the user's requested end-state, current `main`, and the smallest remaining implementation delta.

The implementation must integrate only with the development/upgrade-agent control plane.

## HARD EXCLUSION

Do **not** incorporate this focus/task lock into the existing audit execution pathway.

That exclusion includes, but is not limited to:

- audit reviewer wakes;
- audit reviewer watchdogs/monitors;
- audit campaign phase orchestration;
- audit browser orchestration;
- audit phase handoffs;
- Audit V7 execution/qualification workflows;
- audit-source initialization;
- lite audit phase workflows;
- any audit-specific wake, monitor, registration, receipt, or campaign-state mechanism.

Audit-related files may be read for context if necessary, but they are not implementation targets for this task.

## CURRENT MAIN BASELINE

- Repository: `CurveYield2/Contract-Automation`
- Baseline main commit: `5a34b046e2211a4cb4a3f4065156ab91d8770c80`
- Working branch: `upgrade-agent-focus-lock-v1`

## AUTHORITATIVE IMPLEMENTATION AREA

Primary implementation surface:

`process/development-agent-task-manager/`

Existing launcher/supervisor:

`.github/workflows/development-agent-task-manager.yml`

Repository-wide agent policy may be updated only where necessary to make the development-agent task lock authoritative for development/upgrade work without changing audit execution behavior.

## SATISFIED

- Located the existing development-agent launcher/supervisor.
- Confirmed `process/development-agent-task-manager/` is the correct home for the permanent protocol.
- Confirmed the existing task manager already launches, supervises, replaces, and completion-checks development agents.
- Created a dedicated implementation branch.
- Recorded the explicit audit-path exclusion.

## REMAINING DELTA

1. Add the permanent focus/task-lock protocol for development/upgrade agents.
2. Add a reusable per-task lock-state template/schema or equivalent durable state contract.
3. Integrate lock initialization into the Development Agent Task Manager start path.
4. Persist the task-specific lock state durably without creating a single shared mutable lock.
5. Inject the lock requirements into initial development-agent wakes.
6. Inject the same lock requirements into replacement/resume development-agent wakes.
7. Ensure supervisor prompts re-anchor the worker to the lock rather than broadening scope.
8. Add validation/tests that prove the development-agent lock is enforced.
9. Verify no audit-specific wake, monitor, workflow, or orchestration path was modified.
10. Update development-agent documentation to describe the lock lifecycle.
11. Re-check current `main` before completion and reconcile only if live changes affect this delta.

## PARKED OBSERVATIONS

- General repository organization issues are outside this task.
- Existing audit-process improvements are outside this task.
- Legacy audit paths are outside this task.
- Unrelated workflow cleanup is outside this task.
- Any defect discovered outside the development-agent task manager is parked unless it directly prevents this implementation.

## ACTIVE BLOCKER

None.

## NEXT ACTION

Inspect the complete Development Agent Task Manager workflow, request/completion schemas, and its replacement/supervisor wake construction; then implement the smallest lock-specific delta entirely inside the development-agent path.

## ANTI-DRIFT CHECK

Before every new implementation action, answer:

`Which REMAINING DELTA item does this action eliminate or verify?`

If the answer is none, do not perform the action.
