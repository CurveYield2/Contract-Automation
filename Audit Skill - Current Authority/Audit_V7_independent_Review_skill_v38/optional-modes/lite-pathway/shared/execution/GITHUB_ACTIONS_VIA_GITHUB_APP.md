# GitHub Actions via ChatGPT GitHub App — General Agent Guide

Canonical GitHub copy: `CurveYield2/Contract-Automation/docs/CHATGPT_GITHUB_ACTIONS_VIA_GITHUB_APP.md`

The ChatGPT GitHub app does **not** expose GitHub's direct `workflow_dispatch` / **Run workflow** button. That does **not** mean the agent cannot create or run GitHub Actions.

The normal pattern is:

`ChatGPT GitHub app → create/update GitHub state → GitHub receives event → matching workflow starts automatically → agent reads run/jobs/logs/artifacts through the GitHub app`

Never conclude that GitHub Actions are unavailable merely because a direct `workflow_dispatch` tool is absent.

## Mandatory trigger discovery

Before attempting any Action:

1. Use the GitHub connector app to inspect `.github/workflows/`.
2. Open the intended `.yml` / `.yaml`.
3. Read its `on:` block.
4. Determine the exact trigger event, branch restrictions, path filters, labels, event subtypes, and job-level `if:` conditions.
5. Create that exact GitHub event with the GitHub app.
6. Verify that a workflow run appeared.
7. Inspect the run through completion and retrieve required logs/artifacts.

Do not guess how a workflow is triggered.

## Agent-operable trigger types

### Pull request

```yaml
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]
    paths:
      - "requests/**"
```

Trigger procedure: create branch → create/update matching file → commit → open PR against the required branch. GitHub starts the workflow automatically. Updating the same PR branch creates a `synchronize` event and normally starts it again.

### Push

```yaml
on:
  push:
    branches: [main]
    paths:
      - "queue/**"
```

Trigger by producing the required push with a matching path. Prefer reviewed branch/merge flows where appropriate.

### Issue opened

```yaml
on:
  issues:
    types: [opened]
```

Creating the issue starts the workflow.

### Issue label

```yaml
on:
  issues:
    types: [labeled]
```

A job may additionally require:

```yaml
if: github.event.label.name == 'run-job'
```

Trigger by applying the exact label. This is a useful agent-operable replacement for a manual **Run workflow** button.

### Issue / PR comment

```yaml
on:
  issue_comment:
    types: [created]
```

The workflow may inspect commands such as `/run`, `/test`, `/recheck`, or `/deploy-preview`. Validate commenter authority before permitting sensitive actions.

## Creating a brand-new workflow

When ChatGPT web agents must operate a new workflow autonomously:

1. Choose an agent-operable trigger before writing the workflow.
2. Preferred trigger order: request PR → issue label → controlled push/path change → authorized issue/PR comment.
3. `workflow_dispatch` may also be included for human use, but it should not be the only trigger when ChatGPT web agents need to launch the workflow.
4. Create a dedicated branch.
5. Create `.github/workflows/<workflow-name>.yml`.
6. Use minimum required permissions.
7. Open a PR and review trigger scope, permissions, secrets, and untrusted-input behavior.
8. Merge the workflow into the branch where GitHub recognizes it.
9. Create the configured event using the GitHub app.
10. Verify the resulting run, jobs, logs, and artifacts.

Do not install a duplicate workflow merely because an existing workflow's trigger is not immediately obvious. Inspect the existing workflow first.

## Example: issue-label workflow

```yaml
name: Agent Job

on:
  workflow_dispatch:
  issues:
    types: [labeled]

permissions:
  contents: read
  issues: write

jobs:
  run-job:
    if: github.event.label.name == 'run-agent-job'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run job
        run: echo "Job triggered by issue #${{ github.event.issue.number }}"
```

Human trigger: **Run workflow**.

ChatGPT-agent trigger: apply `run-agent-job` to the intended issue.

## Example: request-PR workflow

```yaml
name: Validate Request

on:
  workflow_dispatch:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]
    paths:
      - "requests/**"

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate request
        run: echo "Validating request"
```

Agent procedure: create branch → add `requests/<job>/request.json` → open PR → GitHub starts the workflow automatically.

## Observe and consume results

After creating the trigger event:

1. Resolve the relevant commit/PR/issue event.
2. Locate the resulting workflow run.
3. Inspect run status.
4. Inspect jobs.
5. Inspect job steps.
6. Read logs when needed.
7. Retrieve workflow artifacts.
8. Record exact run/job/artifact identities required by the audit.

Do not assume the workflow did not run merely because nothing appeared in chat.

## Retry behavior

When an existing run failed and the GitHub app exposes a rerun operation, use the appropriate existing-run retry for transient failures.

Create a new request/event when source, inputs, configuration, or immutable request semantics changed.

## Permissions and secrets

Use least privilege.

Prefer:

```yaml
permissions:
  contents: read
```

Add write permissions only when required.

Never put secrets in workflow YAML, issue bodies, PR bodies, request JSON, committed source, or logs. Use GitHub Actions secrets/variables and do not print secret values.

## Untrusted PR safety

Never execute requester-controlled code with privileged secrets merely because a PR was opened.

For sensitive execution, separate trusted runner/workflow code from requester-controlled request data. Treat requests as data where possible.

## Workflow troubleshooting

If an expected workflow does not start:

`DIAGNOSE → REPAIR → RETRY → VERIFY`

Check:

1. correct repository;
2. correct workflow;
3. workflow exists/enabled on the relevant branch;
4. correct `on:` event;
5. correct target branch;
6. `paths:` / `paths-ignore:` match;
7. required event subtype matches;
8. exact label/command matches;
9. job-level `if:` condition is true;
10. GitHub app operation actually succeeded;
11. a run did not start and immediately fail or skip;
12. permissions/secrets/environment are available for that event.

Inspect the run before assuming trigger failure.

## Workflow-dispatch-only workflows

If a workflow contains only:

```yaml
on:
  workflow_dispatch:
```

the current ChatGPT GitHub app cannot directly press **Run workflow**.

Before asking a human to run it:

1. Confirm no agent-operable trigger already exists.
2. Determine whether adding one is appropriate and authorized.
3. If authorized, modify the workflow through a reviewed PR to add an agent-operable trigger while retaining `workflow_dispatch` for humans.
4. Merge it and use the new event trigger.

Examples:

```yaml
on:
  workflow_dispatch:
  issues:
    types: [labeled]
```

or:

```yaml
on:
  workflow_dispatch:
  pull_request:
    paths:
      - "requests/**"
```

## Final rule

No direct **Run workflow** tool does not mean GitHub Actions cannot be run.

Existing workflow:

`READ WORKFLOW → IDENTIFY on: EVENT → CREATE THAT EVENT WITH GITHUB APP → VERIFY RUN → INSPECT JOBS/LOGS/ARTIFACTS`

New workflow:

`DESIGN AGENT-OPERABLE TRIGGER → CREATE WORKFLOW ON BRANCH → PR/REVIEW → MERGE → CREATE TRIGGER EVENT → VERIFY EXECUTION`

Do not ask the human to manually start an Action until the agent has established that no authorized event-based trigger exists or can appropriately be added.
