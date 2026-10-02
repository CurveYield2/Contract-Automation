# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

Implement the merged Upgrade Agent Launcher v2 specifications on top of current Contract-Automation main so the operator can:

1. submit a repository-development task from a minimal private Cloudflare page;
2. have that task admitted into the existing Development Agent Task Manager without a parallel runtime;
3. allow the existing focus-locked Project-backed manager to implement, supervise, recover, and verify the task;
4. require successful tasks to merge their verified implementation into the target repository's main branch before terminal completion;
5. receive exactly the useful final links: Open output and Open ChatGPT Project.

A GitHub-only workflow-dispatch fallback must admit the same task shape without Cloudflare.

## CURRENT MAIN

- Repository: `CurveYield2/Contract-Automation`
- Current main commit checked: `ebd90fc50baaf62e26560a37bfa1b40639857978`
- Repair branch: `upgrade-agent-launcher-live-smoke-repair-v1`

## AUTHORITATIVE SPECIFICATIONS

- `process/development-agent-task-manager/specifications/UPGRADE_AGENT_LAUNCHER_SYSTEM_SPEC_v2.md`
- `process/development-agent-task-manager/specifications/UPGRADE_AGENT_LAUNCHER_CLOUDFLARE_WEB_SPEC_v2.md`
- `process/development-agent-task-manager/specifications/UPGRADE_AGENT_LAUNCHER_GITHUB_FALLBACK_SPEC_v2.md`
- existing `TASK_LOCK_PROTOCOL_v1.md`

## HARD BOUNDARIES

- Reuse `.github/workflows/development-agent-task-manager.yml` as the sole development-agent runtime.
- Do not create a parallel browser driver, watchdog, supervisor, or replacement system.
- Do not alter audit execution wakes, audit reviewer monitors/watchdogs, audit campaign orchestration, audit phase handoffs, or audit methodology.
- Never add GitHub Actions workflows to Audit-Controller.
- Cloudflare performs intake + minimal submitted-task result lookup only.
- Cloudflare never receives ChatGPT credentials/session state.
- No force-push or branch-protection bypass.
- Successful completion requires verified merge into target repository `main`.

## SATISFIED

- Launcher design v2 merged to main.
- Upgrade Agent Execution Authority v1 implemented.
- Deterministic launcher admission module implemented.
- Minimal Cloudflare launcher implemented.
- GitHub fallback launcher implemented.
- Development Agent Task Manager merge-to-main finalization implemented.
- Terminal output and ChatGPT Project metadata implemented.
- Regression tests added.
- V7 Execution Infrastructure Qualification passed.
- Lite Structured Phase Regression v2 passed.
- Implementation PR #492 merged to main.
- Live smoke request was atomically admitted.
- Live smoke passed request intake, target-branch creation, authority/spec validation, browser runtime setup, encrypted session restore, Tailscale connection, visible Chrome/Xvfb, VNC setup, and home-exit routing.
- Live smoke failed only at initial ChatGPT Project creation with retryable Cloudflare challenge HTTP 403 before manager state persistence.
- Exact comparison with the successful audit browser flow identified the browser challenge as retryable.
- Current main already contains commit `54808c01f394f9151297f8b39cfb39de8cdded6b`, which added bounded fresh-runner retries to the Development Agent Task Manager after the failed smoke.
- Therefore fresh-runner retry behavior is already SATISFIED and must not be reimplemented unless live verification disproves it.
- A subsequent live retry reached the visible Add new project control but failed when the Project-name input did not appear; that older run classified the condition as non-retryable PROVIDER_ERROR.
- Current main now also contains commit `1f040559fbfd17828debc26ba093a903c11b5e80`, which classifies transient human Project-create UI failures such as missing Project-name input as retryable.
- That exact second live-smoke failure is therefore also already repaired on current main and must not be reimplemented.

## REMAINING DELTA

1. Add the proven visible-browser backend-health preflight/manual-verification wait to the shared browser runtime without changing the human interaction primitives.
2. Enable a bounded manual-verification wait for Development Agent Task Manager launches while keeping visible Chrome, VNC, and home-exit routing active.
3. Add focused regression coverage for that exact wait path and preserve audit-specific wake instructions unchanged.
4. Re-run `upgrade-launcher-live-smoke-r1`; continue through focus-locked agent completion and mandatory merge-to-main finalization.
5. Close this focus lock only after terminal COMPLETE exposes output + ChatGPT Project links.

## PARKED OBSERVATIONS

- General dashboards are out of scope.
- Active-task control buttons are out of scope.
- Audit-process redesign is out of scope.
- General repository cleanup is out of scope.
- Cloudflare deployment/account provisioning is outside repository code; implementation should be deployment-ready without embedded credentials.

## ACTIVE BLOCKER

All bounded fresh-runner attempts reached ChatGPT through the intended visible/home-exit browser path but encountered the same browser verification gate during Project creation. The proven older home-exit browser keeps the visible session open and waits for normal human verification or natural recovery; the shared current runtime does not yet implement that wait.

## NEXT ACTION

Port only the visible-browser backend-health preflight/manual-verification wait into the shared runtime, enable it for development-agent launches, add focused regression coverage, and retry the same smoke task.

## ANTI-DRIFT CHECK

Before each meaningful action:

`Which REMAINING DELTA item does this action eliminate or verify?`

If none, do not perform it.
