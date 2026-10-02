# Upgrade Agent Launcher — Cloudflare Web Specification v1

## 1. Goal

Provide a small private web page that makes launching and monitoring focus-locked development agents feel like submitting a job rather than manually authoring repository control files.

The page is convenience. GitHub remains authority.

## 2. Recommended product surface

One Cloudflare Worker with static assets and JSON API routes.

Suggested routes:

- `GET /` — launcher/dashboard
- `GET /api/tasks` — active/recent managed tasks
- `POST /api/tasks` — create a task
- `GET /api/tasks/:managerId` — detailed status
- `POST /api/tasks/:managerId/sweep` — optional immediate manager sweep
- `POST /api/tasks/:managerId/pull-request` — optional human-triggered PR creation after completion
- `GET /health` — no-secret health response

No route may directly automate ChatGPT.

## 3. Main page

### New Upgrade Task

Fields shown by default:

- Task name
- What should the agent accomplish? — large textarea
- Target repository
- Launch button

Below an **Advanced** disclosure:

- Base ref
- Target branch
- Authority path
- Acceptance criteria
- Initial assignment
- Continuity mode

Defaults should make the common case require no advanced changes.

### Active Tasks

Each task card/row should show:

- name;
- state;
- repository + branch;
- generation;
- last decision;
- remaining-delta summary;
- active blocker if any;
- last GitHub update.

Primary actions:

- View details
- Open Project
- Open branch

### Task details

Show:

- full human request;
- selected authority;
- specification path;
- request path;
- branch and current head;
- current Project/chat links when available;
- SATISFIED items;
- REMAINING DELTA;
- ACTIVE BLOCKER;
- NEXT ACTION;
- generation/replacement history;
- completion receipt when complete.

## 4. UX behavior

Launching must be a deliberate action.

Flow:

1. user completes form;
2. client performs local validation;
3. POST to Worker;
4. Worker performs server validation and collision checks;
5. Worker creates one atomic Git commit;
6. UI shows `LAUNCH REQUEST ADMITTED` with manager ID and commit;
7. page polls GitHub-backed status until the manager becomes ACTIVE;
8. once active, show Project/chat links and focus-lock status.

Do not show success merely because the HTTP request returned 200. Show separate states for:

- validating;
- GitHub commit admitted;
- manager starting;
- active;
- complete;
- failed.

## 5. Access protection

Require Cloudflare Access for all non-health routes.

The Worker should verify the Access JWT or rely on a bound Access policy plus identity headers according to the deployment setup.

API responses should set:

- `Cache-Control: no-store`;
- restrictive CORS / same-origin policy;
- CSP for the HTML surface;
- `X-Content-Type-Options: nosniff`;
- appropriate frame restrictions.

No third-party analytics in v1.

## 6. GitHub credential model

Preferred Worker secrets:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_INSTALLATION_ID`

Configuration:

- `GITHUB_OWNER=CurveYield2`
- `CONTROL_REPO=Contract-Automation`
- target repository allowlist.

The Worker should mint short-lived installation tokens server-side.

Never serialize a GitHub token into HTML, JavaScript, API responses, browser storage or logs.

## 7. POST /api/tasks

Example request body:

```json
{
  "taskName": "Repair development task-manager status reporting",
  "instruction": "Make the status page show the exact remaining focus-lock delta without changing audit execution behavior.",
  "targetRepository": "CurveYield2/Contract-Automation",
  "baseRef": "main",
  "continuityMode": "managed_project",
  "authorityPath": "process/development-agent-task-manager/UPGRADE_AGENT_EXECUTION_AUTHORITY_v1.md",
  "acceptanceCriteria": [
    "Existing audit wakes are unchanged",
    "Regression tests pass"
  ],
  "initialAssignment": ""
}
```

Server behavior:

1. authenticate;
2. validate lengths/types;
3. validate repository allowlist;
4. normalize task slug;
5. allocate manager revision;
6. allocate target branch;
7. verify authority path exists on current `main`;
8. generate specification bytes;
9. generate manager request bytes;
10. create atomic Git commit;
11. return manager ID, commit SHA, paths and expected branch.

The Worker must not create the target branch itself. The existing manager owns target-branch resolution/creation.

## 8. Input constraints

Suggested limits:

- task name: 1–120 characters;
- instruction: 1–30,000 characters;
- initial assignment: 0–10,000 characters;
- acceptance criteria: up to 30 entries;
- repo/branch/path fields: conservative GitHub-safe lengths.

Reject HTML/script content only where needed for display safety; preserve ordinary technical text, code snippets and Markdown in the generated specification.

Output rendering must escape untrusted text.

## 9. Specification generation

The Worker uses a deterministic Markdown template.

Do not call an LLM to paraphrase or expand the task.

The exact submitted instruction must appear verbatim.

This prevents the launcher itself from introducing task drift before the development agent even starts.

## 10. Status polling

Recommended default:

- every 10 seconds while STARTING;
- every 30 seconds while ACTIVE;
- manual refresh always available;
- stop polling after COMPLETE.

Status API should aggressively avoid GitHub rate waste by fetching only the small known state files and target lock file.

Do not scrape GitHub HTML.

## 11. Project/chat links

The active manager state may contain private Project/chat URLs.

UI rules:

- show only to Access-authenticated users;
- never send to analytics;
- never place in page title;
- never include in unauthenticated health output;
- mask in application logs;
- use `rel="noreferrer"` where appropriate.

## 12. Visual design

The UI should be utilitarian and dense rather than decorative.

Recommended layout:

- top: **Upgrade Agent Launcher**
- left/top panel: New Task
- main panel: Active Tasks
- secondary tab: Completed Tasks
- task detail drawer/page for focus-lock state and links.

Use clear state badges:

- STARTING
- ACTIVE
- BLOCKED
- COMPLETE
- FAILED

Do not invent an agent-health score.

## 13. Cloudflare deployment

Preferred: Cloudflare Workers Git integration / Workers Builds from the repository path.

The repo should contain deployment configuration but no secrets.

Production hostname may be any operator-owned Cloudflare zone or workers.dev route.

Cloudflare Access should be configured outside the repository.

## 14. Testing

At minimum implement:

- pure tests for slug/revision generation;
- request validation tests;
- deterministic specification rendering tests;
- atomic commit payload tests;
- duplicate-active rejection tests;
- target-repository allowlist tests;
- authority-path existence tests;
- status parser tests for ACTIVE/COMPLETE/task-lock states;
- redaction tests for Project URLs and secrets;
- integration test using mocked GitHub API;
- one GitHub-side smoke test that admits a harmless standalone development-manager request without touching audit execution state.

## 15. Non-goals

- no browser automation inside Cloudflare;
- no ChatGPT login/session state in Cloudflare;
- no direct audit campaign control;
- no automatic merging;
- no user database;
- no separate persistent task database;
- no generic CI dashboard.
