# Focus and Task-Lock Local Agent Rules

This file adds focus/task-lock rules to the repository-root `AGENTS.md`.

- One task gets one active focus/task lock.
- Update that lock in place as work advances. Do not create repeated status copies, successor copies, report copies, or new lock versions for each retry.
- The lock records the end-state, satisfied work, remaining delta, blocker, and next action; it is not permission to expand scope.
- Re-read the existing lock before analysis or execution. Do not repeat analysis already captured there unless new evidence changes it.
- When the task is complete, close/retire the canonical lock according to the owning process rather than leaving multiple active variants.
