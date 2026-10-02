# Upgrade Agent Launcher System Specification v1

## 1. Purpose

Build a very small front door for the existing Development Agent Task Manager.

The operator should be able to describe a repository upgrade in ordinary language, select a target repository, and press **Launch**. The launcher converts that intake into the exact durable specification/request files already understood by the existing manager.

The launcher is not an agent runtime. It does not browse ChatGPT, supervise workers, create replacement agents, or decide completion. Those responsibilities remain exclusively with the Development Agent Task Manager.

## 2. Primary architecture

```
Cloudflare Launcher UI
        |
        | authenticated task intake / status
        v
Cloudflare Worker API
        |
        | GitHub App installation token
        v
CurveYield2/Contract-Automation main
        |
        | one atomic commit:
        | - generated task specification
        | - exactly one manager request JSON
        v
existing development-agent-task-manager.yml
        |
        v
focus-locked managed ChatGPT Project + worker chats
```

GitHub is the durable authority.

Cloudflare holds no canonical task state. If Cloudflare is unavailable after launch, the existing manager continues normally because all admitted state lives in GitHub.

## 3. Recommended deployment

Use one Cloudflare Worker application with static assets rather than introducing a separate frontend framework.

Recommended repository location:

`process/development-agent-task-manager/launcher/cloudflare/`

Recommended implementation shape:

```
launcher/
  cloudflare/
    README_v1.md
    wrangler_v1.jsonc
    src/
      worker_v1.js
    public/
      index_v1.html
      app_v1.js
      styles_v1.css
```

Keep the frontend dependency-light. React/Vite or another framework is not required for v1.

Cloudflare Workers Builds / Git integration is preferred so deployment does not require a new GitHub Actions deployment workflow.

## 4. Authentication and authorization

The entire launcher must be protected by Cloudflare Access.

The Worker must reject API access unless the request contains a valid Access identity.

Do not expose GitHub credentials to the browser.

Preferred GitHub authentication:

1. dedicated GitHub App installed only on the required CurveYield2 repositories;
2. GitHub App credentials stored only as Cloudflare Worker secrets;
3. Worker creates short-lived installation tokens when needed.

Required GitHub App permissions for v1:

- Contract-Automation contents: read/write;
- target repository contents: read;
- Actions: write only if the optional **Sweep now** control is enabled;
- Pull requests: write only if the optional human-triggered **Create PR** control is enabled.

A fine-grained PAT stored as a Worker secret may be supported as an operator fallback, but it must never be sent to client JavaScript.

## 5. Launcher inputs

### Required simple inputs

- **Task name**
- **What should be changed?** — multiline plain-language instruction
- **Target repository**

Default target repository:

`CurveYield2/Contract-Automation`

Allowed target repositories must come from an explicit server-side allowlist.

At minimum support:

- `CurveYield2/Contract-Automation`
- `CurveYield2/Audit-Controller`

### Defaulted inputs

- Base ref: `main`
- Continuity: `managed_project`
- Human merge required: true
- Authority: generic Upgrade Agent Execution Authority
- Target branch: automatically generated

### Advanced inputs

- exact authority/supporting-skill path;
- base ref override;
- target branch override;
- extra acceptance criteria;
- initial assignment text;
- continuity override to `standalone`.

The UI must describe `standalone` as a tiny-task exception. `managed_project` remains the default.

## 6. Generic execution authority

Implementation must add one stable development authority file:

`process/development-agent-task-manager/UPGRADE_AGENT_EXECUTION_AUTHORITY_v1.md`

It is the default `skillPath` for launcher-created requests.

Its scope is repository development/upgrade behavior only. It should reference the existing task-lock protocol rather than duplicate it.

At minimum it must require:

- live `main` inspection before edits;
- current authority inspection;
- existing-process-first behavior;
- one repair branch;
- no reopening satisfied work without live contradictory evidence;
- no unrelated cleanup;
- testing/verification before completion;
- human approval before merging unless the originating task explicitly authorizes merge;
- no GitHub Actions workflows in Audit-Controller;
- no propagation of the development task lock into audit execution agents.

Task-specific authority may override the default by selecting another existing authority path.

## 7. Generated task specification

For each launcher submission, create:

`process/development-agent-task-manager/specifications/<SAFE_MANAGER_ID>_SPEC_v1.md`

The specification must preserve the user's task text verbatim under **Human Requested End-State**.

It must also include:

- manager ID;
- target repository;
- target branch;
- base ref;
- selected authority;
- continuity mode;
- explicit non-goals supplied by the user;
- acceptance criteria supplied by the user;
- launcher rule that the task lock, current live repository and selected authority govern execution.

The launcher must not attempt to rewrite the user's request into a more ambitious project.

It may normalize metadata and provide headings, but the original task instruction remains authoritative.

## 8. Generated manager request

Create exactly one:

`process/development-agent-task-manager/requests/<SAFE_MANAGER_ID>_v1.json`

using the existing schema:

`curveyield-development-agent-task-request-v1`

Fields:

- `schemaVersion = curveyield-development-agent-task-request-v1`
- `status = READY`
- `managerId`
- generated `specificationPath`
- selected/default `skillPath`
- `authorityRef = main`
- `targetRepository`
- `targetBranch`
- `baseRef`
- `continuityMode`
- optional `initialAssignment`

No launcher-specific execution fields should be added to the manager request unless the existing manager actually needs them.

## 9. Atomic Git admission

The generated specification and request must land in **one atomic commit** on Contract-Automation `main`.

Do not create the request first and the specification second.

The Worker should use GitHub's Git-data API:

1. read current `main` ref;
2. create blobs for specification and request;
3. create a tree based on current `main`;
4. create one commit;
5. fast-forward `refs/heads/main` without force.

The triggering commit must contain exactly one changed manager-request JSON file.

If `main` moves before ref update:

- refetch current `main`;
- reconstruct the tree against the new head;
- retry a bounded number of times;
- never force-push.

## 10. Naming and collision rules

Manager IDs must satisfy the existing schema.

Default:

`upgrade-<task-slug>-rN`

Target branch default:

`upgrade/<task-slug>-rN`

Revision `rN` is selected by checking existing request, active, completed and target-branch names.

Never reuse an active manager ID.

Never silently attach a new task to an existing development Project.

## 11. Status model

The launcher status API reads GitHub; it does not maintain a parallel database.

For a manager ID, inspect:

- `process/development-agent-task-manager/active/<SAFE_ID>.json`
- `process/development-agent-task-manager/completed/<SAFE_ID>.json`
- target branch head;
- task-lock state path from manager state;
- optional completion receipt;
- optional PR state.

Display at minimum:

- task name / manager ID;
- ACTIVE or COMPLETE;
- target repository / branch;
- continuity mode;
- generation number;
- replacement count;
- last manager decision;
- current branch head;
- task-lock SATISFIED count;
- REMAINING DELTA;
- ACTIVE BLOCKER;
- NEXT ACTION.

Project/chat URLs may be shown only inside the Access-protected UI. Do not put them into client console logs or analytics.

## 12. User controls

### v1 controls

- Launch task
- Refresh status
- Open target branch
- Open current ChatGPT Project/chat when available
- Sweep now — optional; dispatches the existing manager with `operation=sweep`
- Create pull request — optional and only after completion; must require an explicit human click

### Explicitly not v1

- automatic merge;
- direct browser pokes from Cloudflare;
- deleting Projects;
- killing agents by manipulating ChatGPT directly;
- editing audit campaign state.

## 13. Failure behavior

### Invalid form

Reject before GitHub write and identify the invalid field.

### Duplicate active manager

Return the existing task as a conflict. Do not spawn another manager.

### Branch already exists

If it belongs to the same inactive task revision, surface it for operator review. Otherwise allocate the next `rN`.

### GitHub write race

Rebase the atomic commit attempt against current `main` and retry boundedly.

### Manager start fails

Show the GitHub request commit and manager workflow failure. Do not create another request automatically.

### Cloudflare unavailable

No effect on already-running manager tasks.

### Browser/agent failure

Cloudflare takes no recovery action. Existing manager supervision owns recovery.

## 14. Audit boundary

The launcher may create development tasks whose target repository is Audit-Controller.

That does not make them audit execution agents.

The launcher and default authority must prohibit:

- adding Actions workflows to Audit-Controller;
- changing audit reviewer wake policy as a side effect of unrelated development;
- injecting task-lock text into audit campaign workers;
- using the launcher as an alternative audit orchestrator.

## 15. Completion / merge policy

The launcher's definition of COMPLETE comes from the existing manager's completed state, not from a chat message.

Completion does not equal merge.

Default flow:

`COMPLETE -> human reviews branch/PR -> human chooses whether to merge`

An optional **Create PR** button may create a PR from the completed target branch to its base ref.

No launcher v1 feature may merge that PR automatically.

## 16. Implementation acceptance criteria

Launcher v1 passes only if:

1. one normal form submission creates one atomic Git commit containing a generated v1 specification and exactly one v1 request;
2. the existing manager starts from that request without a parallel dispatcher;
3. `managed_project` is the default;
4. a duplicate active manager cannot be created;
5. status comes entirely from GitHub durable state;
6. Cloudflare secrets never reach browser JavaScript;
7. Cloudflare outage does not affect active manager execution;
8. a target of Audit-Controller creates no workflow there;
9. no audit execution wake/monitor/orchestration file needs modification;
10. all new launcher files are versioned;
11. repository tests and launcher-specific tests pass;
12. the user can accomplish the normal launch using only task name, task instruction and target repository.
