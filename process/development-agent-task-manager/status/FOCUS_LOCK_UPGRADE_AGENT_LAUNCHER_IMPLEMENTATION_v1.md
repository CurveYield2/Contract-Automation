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
- Exact comparison with the successful audit browser flow identified the missing behavior: fresh-runner retries plus manual challenge-wait handling around browser delivery.

## REMAINING DELTA

1. Add only the missing fresh-runner retry/manual-challenge wrapper to the Development Agent Task Manager initial Project-create path, reusing the proven audit-browser behavior.
2. Add/adjust regression coverage for that exact retry behavior.
3. Re-run the same live smoke request path until initial Project creation succeeds and active manager state is persisted.
4. Continue that same smoke task through agent completion and mandatory merge-to-main finalization.
5. Close this focus lock only after the live smoke reaches terminal COMPLETE with output + Project links.



1. Add generic Upgrade Agent Execution Authority v1.
2. Add deterministic shared launcher admission module and tests.
3. Add minimal Cloudflare Worker/static launcher implementation and tests/config/docs.
4. Add GitHub-only launcher fallback workflow using the same admission logic.
5. Extend the Development Agent Task Manager from verified implementation completion through PR creation/reuse, merge into target main, merge verification, and terminal output metadata.
6. Preserve ChatGPT Project URL in terminal completed state.
7. Make terminal completed state expose canonical output URL and merge metadata.
8. Add regression tests for launcher admission, merge finalization, output selection, Project URL preservation, audit isolation and no parallel browser machinery.
9. Run GitHub-side repository qualification/regression tests; diagnose/repair until green.
10. Re-check current main before completion.
11. Open an implementation PR; do not merge it until the implementation is verified.

## PARKED OBSERVATIONS

- General dashboards are out of scope.
- Active-task control buttons are out of scope.
- Audit-process redesign is out of scope.
- General repository cleanup is out of scope.
- Cloudflare deployment/account provisioning is outside repository code; implementation should be deployment-ready without embedded credentials.

## ACTIVE BLOCKER

Initial managed-Project creation receives a retryable Cloudflare challenge HTTP 403. The Development Agent Task Manager currently terminates instead of using the audit browser flow's bounded fresh-runner retry/manual challenge-wait mechanism.

## NEXT ACTION

Inspect only the existing development-manager browser-delivery block and the proven audit fresh-runner retry wrapper, then transplant the smallest equivalent retry mechanism without touching unrelated launcher, audit, or repository infrastructure.

## ANTI-DRIFT CHECK

Before each meaningful action:

`Which REMAINING DELTA item does this action eliminate or verify?`

If none, do not perform it.
