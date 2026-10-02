# Upgrade Agent Launcher — GitHub-Only Fallback Specification v1

## 1. Purpose

Provide the same launcher intake when Cloudflare is unavailable or intentionally not used.

This fallback must feed the same existing Development Agent Task Manager request contract. It must not create a second development runtime.

## 2. Recommended fallback

Add one Contract-Automation workflow:

`.github/workflows/upgrade-agent-launcher-v1.yml`

It is an intake wrapper only.

It must not:

- open ChatGPT;
- monitor agents;
- replace agents;
- implement task-lock logic;
- run audit campaigns.

Those responsibilities remain in `development-agent-task-manager.yml`.

## 3. Manual inputs

`workflow_dispatch` inputs:

- task_name
- instruction
- target_repository
- base_ref — default `main`
- target_branch — optional
- authority_path — default generic Upgrade Agent Execution Authority
- continuity_mode — default `managed_project`
- acceptance_criteria — optional
- initial_assignment — optional

If GitHub's workflow-dispatch UI is inconvenient for long text, the fallback may additionally accept a path to a prepared Markdown instruction file already committed in Contract-Automation.

## 4. Behavior

The workflow executes the same deterministic admission library used by the Cloudflare Worker where practical.

It must:

1. validate the target repository against the same allowlist;
2. allocate the same manager ID/revision convention;
3. render the same specification template;
4. render the same manager request schema;
5. commit the specification + exactly one request JSON atomically to `main`;
6. stop.

The request-file push then starts the existing Development Agent Task Manager.

Do not directly dispatch the browser manager from the launcher workflow if the durable request trigger is healthy.

## 5. Shared admission logic

To prevent Cloudflare/GitHub drift, implementation should place deterministic admission helpers in one dependency-light module such as:

`process/development-agent-task-manager/launcher/shared/launcher-admission-v1.js`

Shared functions should cover:

- safe slug generation;
- revision allocation;
- target branch generation;
- input validation;
- specification rendering;
- request rendering;
- path generation.

Cloudflare-specific GitHub authentication and GitHub Actions-specific shell/environment handling remain adapters around this shared logic.

## 6. GitHub-only status

The existing GitHub repository remains directly inspectable without the Cloudflare UI.

Canonical paths:

- active state: `process/development-agent-task-manager/active/<SAFE_ID>.json`
- completed state: `process/development-agent-task-manager/completed/<SAFE_ID>.json`
- generated spec: `process/development-agent-task-manager/specifications/<SAFE_ID>_SPEC_v1.md`
- request: `process/development-agent-task-manager/requests/<SAFE_ID>_v1.json`
- task lock: path recorded in active/completed state on the target branch.

A small job summary from the launcher workflow should print the manager ID and these paths.

## 7. Failure handling

- invalid input: fail before committing;
- active manager collision: fail closed;
- `main` moved: refetch and retry boundedly;
- failed atomic write: leave no request file behind;
- manager later fails: do not auto-submit a second request.

## 8. Security

Use the workflow's normal repository token when permissions are sufficient.

Do not print secrets.

Do not accept arbitrary repository names outside the allowlist.

Do not permit the launcher to create workflows in Audit-Controller.

## 9. Acceptance criteria

The GitHub fallback passes when:

1. the same basic task can be launched with Cloudflare unavailable;
2. it produces the same spec/request shapes as the Cloudflare path;
3. only one manager request changes in the admission commit;
4. the existing manager starts normally;
5. no browser/runtime logic is duplicated;
6. no audit execution workflow is touched.
