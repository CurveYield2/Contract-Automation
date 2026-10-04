# Development/Upgrade Agent Task-Lock Protocol v1

## Scope

This protocol governs development, maintenance, repair, refactor, migration, and upgrade agents launched by the Development Agent Task Manager.

It does **not** govern audit execution agents or audit campaign orchestration. Do not inject this protocol into audit reviewer wakes, audit watchdogs/monitors, audit phase orchestration, audit campaign handoffs, audit-source initialization, Audit V7 execution/qualification, lite-audit workflows, or any other audit-specific execution path.

## Primary invariant

The human-requested end-state is the sole definition of success.

Before implementation work begins, the development agent must convert the assigned specification plus any explicit human instruction into one concrete, externally verifiable END-STATE INVARIANT in its task-lock state file.

All work must directly advance that invariant.

## Mandatory live-state check

Before changing implementation code, the agent must:

1. inspect the exact current target-branch state;
2. inspect current `main` for the target repository;
3. inspect the authoritative specification and supporting authority;
4. identify which requested requirements are already satisfied;
5. identify the smallest remaining delta.

An inherited mental model, predecessor chat, handoff, or stale queue never outranks live repository state plus the governing specification.

## Smallest-delta rule

Implement only the smallest set of changes necessary to move the live repository from its current state to the requested end-state.

Do not redesign, refactor, clean up, generalize, modernize, or repair adjacent systems unless the work is strictly necessary to satisfy or verify the END-STATE INVARIANT.

## Satisfied-requirement lock

Once a requested requirement has been live-verified and recorded as SATISFIED, it is closed.

Do not reopen, redesign, replace, or reimplement a SATISFIED requirement unless later live verification proves it is no longer satisfied.

## Discovery rule

Discovery is not authorization to repair.

For each newly discovered issue, ask:

`Does this issue prevent completion or verification of the END-STATE INVARIANT?`

- YES: record it as the ACTIVE BLOCKER or remaining delta and make the smallest necessary repair.
- NO: record it under PARKED OBSERVATIONS and immediately return to the primary task.

Parked observations do not become current scope.

## One-path rule

There may be only one active implementation path and one active repair branch for the managed task.

Do not create parallel branches, replacement architectures, alternate implementations, or secondary cleanup projects because new issues were discovered.

## Re-anchor rule

Re-anchor against `CURRENT MAIN + CURRENT AUTHORITY + END-STATE INVARIANT` whenever:

- current `main` materially changes;
- an expected file or behavior differs from the current mental model;
- a previously satisfied requirement becomes uncertain;
- work expands beyond the recorded REMAINING DELTA;
- multiple consecutive actions fail to reduce the REMAINING DELTA;
- a replacement agent takes over.

Re-anchoring means refreshing live state and rewriting the remaining delta. It does not mean restarting completed investigation.

## Anti-loop rule

Every meaningful action must do at least one of these:

- reduce REMAINING DELTA;
- move a verified requirement to SATISFIED;
- remove ACTIVE BLOCKER;
- perform a required verification directly tied to completion.

If an action does none of these, do not perform it.

Repeated investigation of already-known facts is prohibited unless new live evidence invalidates them.

## Task-lock state file

Each managed development task must maintain exactly one task-specific state file on its target branch:

`process/development-agent-task-manager/task-locks/<SAFE_MANAGER_ID>_v1.md`

If that path does not exist in the target repository, create it. Do not create multiple lock files for the same manager.

The state file must contain only:

- END-STATE INVARIANT
- CURRENT MAIN
- AUTHORITY
- SATISFIED
- REMAINING DELTA
- PARKED OBSERVATIONS
- ACTIVE BLOCKER
- NEXT ACTION

Keep it concise. It is a navigation instrument, not a diary, transcript, or work log.

Before a meaningful implementation action, the agent must be able to answer:

`Which REMAINING DELTA item does this action eliminate or verify?`

If the answer is none, do not perform it.

## Resume/replacement rule

A replacement agent must read the existing task-lock state before implementation work.

It must preserve SATISFIED items unless live verification disproves them, refresh CURRENT MAIN, recompute only the remaining delta, and continue from the durable branch checkpoint.

It must not recreate the task from scratch merely because the chat changed.

## Completion rule

The managed development task is complete only when:

1. every element of the END-STATE INVARIANT is verified against resulting repository state;
2. required tests/validation pass;
3. REMAINING DELTA contains no unresolved implementation requirement;
4. ACTIVE BLOCKER is `None`;
5. the normal Development Agent Task Manager machine completion receipt is valid.

PARKED OBSERVATIONS do not prevent completion.

Repository perfection is not the objective. The requested end-state is the objective.
