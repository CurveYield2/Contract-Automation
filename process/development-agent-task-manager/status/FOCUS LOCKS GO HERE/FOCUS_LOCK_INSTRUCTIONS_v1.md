# Focus Lock Instructions v1

## Purpose

A focus lock is a durable anti-drift control for one development task.

Its job is to prevent agents from restarting completed work, rediscovering already-verified facts, creating parallel implementation paths, or expanding scope after a blocker appears.

The controlling implementation protocol remains:

`process/development-agent-task-manager/TASK_LOCK_PROTOCOL_v1.md`

These instructions define the repository layout and lifecycle for focus-lock files.

## Folder Layout

All focus locks live under:

`process/development-agent-task-manager/status/FOCUS LOCKS GO HERE/`

The root of that folder contains only:

- `FOCUS_LOCK_INSTRUCTIONS_v1.md`
- `FOCUS_LOCK_TEMPLATE_v1.md`
- `ACTIVE FOCUS LOCKS/`
- `RETIRED FOCUS LOCKS/`

Do not store project-specific focus locks directly in the root or directly in `status/`.

## Active Focus Locks

Put a task-specific focus lock in:

`FOCUS LOCKS GO HERE/ACTIVE FOCUS LOCKS/`

A focus lock is ACTIVE only while executable work remains or a genuine blocker remains unresolved.

Exactly one active focus lock should govern a given task.

An active lock must contain:

- END-STATE INVARIANT
- CURRENT MAIN
- AUTHORITY
- SATISFIED
- REMAINING DELTA
- PARKED OBSERVATIONS
- ACTIVE BLOCKER
- NEXT ACTION
- ANTI-DRIFT CHECK

## Satisfied Work Is Closed

Once a requirement is live-verified and recorded under SATISFIED, it is closed.

Do not repeat its investigation, redesign it, replace it, or reimplement it unless new live evidence directly proves it is no longer satisfied.

A new failure elsewhere does not reopen satisfied work.

## Smallest Remaining Delta

Every meaningful action must eliminate or verify one item in REMAINING DELTA.

Before acting, answer:

`Which REMAINING DELTA item does this action eliminate or verify?`

If the answer is none, do not perform the action.

Do not:

- repeat already-completed discovery;
- create a new workflow merely because the current one failed;
- create parallel implementation paths;
- perform unrelated cleanup;
- generalize or redesign adjacent systems;
- treat a harness failure as permission to restart protocol discovery.

## One-Path Rule

Maintain one active implementation path and one active repair path.

When a failure occurs:

`DIAGNOSE -> REPAIR THE SMALLEST BLOCKER -> RETRY -> VERIFY -> CONTINUE`

Do not branch into replacement architectures or duplicate workflows unless the human explicitly authorizes that change.

## Re-Anchor Rule

Re-anchor only when:

- current main materially changes;
- live evidence contradicts a SATISFIED item;
- an expected file or behavior differs from current main;
- work starts expanding beyond REMAINING DELTA;
- multiple consecutive actions fail to reduce REMAINING DELTA;
- a successor agent takes over.

Re-anchoring means refresh CURRENT MAIN and recompute only the remaining delta.

It does not mean restarting completed investigation.

## Retiring a Focus Lock

Move a focus lock to:

`FOCUS LOCKS GO HERE/RETIRED FOCUS LOCKS/`

when:

- REMAINING DELTA is `- None` and ACTIVE BLOCKER is `None`; or
- the lock has been explicitly superseded by a newer authoritative lock; or
- the underlying task has been abandoned or replaced by explicit human instruction.

Retired locks are historical records only.

Never use a retired lock as current execution authority.

## Resume / Successor Rule

A successor agent must read the active focus lock before doing implementation work.

It must:

1. preserve SATISFIED items unless live evidence disproves them;
2. refresh CURRENT MAIN;
3. continue only REMAINING DELTA;
4. avoid reconstructing the task from chat history;
5. update the same active lock rather than creating another lock for the same task.

## Completion Rule

A task is complete only when:

- the END-STATE INVARIANT is verified;
- required tests/validation pass;
- REMAINING DELTA is `- None`;
- ACTIVE BLOCKER is `None`.

Repository perfection is not the goal.

The requested end-state is the goal.
