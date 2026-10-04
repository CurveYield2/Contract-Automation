# GitHub Actions Local Agent Rules

This file adds workflow-specific rules to the repository-root `AGENTS.md`.

- `.github/workflows` contains durable workflow entrypoints, not per-attempt scripts or a retry history.
- There MUST be only one active workflow file for a given responsibility. Edit the current workflow in place. If a real version bump is unavoidable, remove/archive the superseded workflow in the same change.
- Never create `workflow-v2.yml`, `workflow-v3.yml`, etc. as a debugging technique.
- Prefer an existing reusable or manually dispatchable workflow over creating a one-off diagnostic workflow.
- Before dispatching, inspect queued/in-progress Actions. Do not run the same workflow/target/browser lane concurrently.
- Browser workflows using the same stored login/session state are strictly single-flight.
- Never use a concurrency key based on `run_id` or another unique-per-run value when the real resource is shared; concurrency identity must represent the shared resource.
- A workflow that writes/commits results must exclude those result paths from its own push trigger.
- Do not use a broad `push` trigger for a diagnostic/test workflow. Path filters must identify only genuine inputs/implementation changes.
- A workflow must not trigger another workflow recursively without a finite, explicit terminal condition.
- Temporary repair/cancel/redrive workflows must be removed as soon as their one bounded use is complete.
- Before finishing, inspect the Actions page and confirm you did not leave duplicate same-kind runs active.
