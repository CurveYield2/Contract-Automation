# Upgrade Agent Launcher — GitHub-Only Fallback Specification v2

## Purpose

Provide the same launch intake when Cloudflare is unavailable.

The fallback submits tasks into the same existing Development Agent Task Manager and relies on the same mandatory merge-to-main finalization.

## Workflow

Add:

`.github/workflows/upgrade-agent-launcher-v1.yml`

This workflow is intake only.

It must not:

- open ChatGPT;
- monitor agents;
- replace agents;
- merge completed work;
- implement task-lock logic;
- run audits.

## Inputs

`workflow_dispatch`:

- task_name
- instruction
- target_repository
- base_ref — default `main`
- target_branch — optional
- authority_path — default generic upgrade authority
- continuity_mode — default `managed_project`
- acceptance_criteria — optional
- initial_assignment — optional

## Behavior

The fallback must use the same deterministic admission contract as the Cloudflare path.

It:

1. validates the repository allowlist;
2. allocates manager revision;
3. renders the task specification;
4. renders the existing manager request;
5. commits both atomically to Contract-Automation `main`;
6. stops.

The request-file push starts the existing Development Agent Task Manager.

The manager/finalizer—not this launcher wrapper—owns the required eventual merge into target `main`.

## Shared admission code

Keep deterministic launcher logic in a dependency-light shared module, for example:

`process/development-agent-task-manager/launcher/shared/launcher-admission-v1.js`

Shared behavior:

- validation;
- safe slug generation;
- revision allocation;
- branch naming;
- specification rendering;
- request rendering;
- path generation.

## Output after launch

The GitHub workflow summary need only report:

- manager ID;
- admission commit;
- target branch.

Final successful output remains the merged result on target `main`.

Canonical terminal manager state should contain:

- merged PR URL;
- merge commit SHA;
- target-main SHA;
- canonical output URL;
- ChatGPT Project URL for managed-project tasks.

## Failure handling

- invalid input: fail before committing;
- active-manager collision: fail closed;
- `main` race: retry boundedly;
- atomic write failure: leave no request behind;
- manager/merge failure: do not auto-submit another request.

## Acceptance criteria

1. Cloudflare can be unavailable and task launch still works;
2. fallback emits the same specification/request shape;
3. admission commit changes exactly one manager request;
4. existing manager starts normally;
5. no browser or manager logic is duplicated;
6. mandatory merge-to-main behavior remains owned by the existing durable backend;
7. no audit execution workflow is modified.
