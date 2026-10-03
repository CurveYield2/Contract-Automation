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
- Current main commit checked: `988c9d13e979f99720f90a63ac6ebf4830db641d`
- Repair branch: `upgrade-agent-launcher-project-control-repair-v1`

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
- Fresh-runner retry support merged.
- Retryable Project UI failure classification merged.
- Visible-browser backend-health/manual-verification wait merged in PR #496.
- Live smoke proved backend verification can clear: later retries returned healthy 200 responses for ChatGPT backend preflight.
- Live smoke then failed only because the current sidebar recovery did not expose the Project creation control.
- Terminal diagnostics showed visible `Recents` and `Chat sidebar options`, but no visible `Projects` or `New project`.
- Current recovery already knows how to use `Organize sidebar` and a `Projects` option once visible, but it does not open `Chat sidebar options` first.

## REMAINING DELTA

1. Extend only `exposeProjectsInSidebar` so it can open the visible `Chat sidebar options` control, then follow the existing human UI path through `Organize sidebar` and `Show` when present.
2. Preserve the existing human pointer interaction primitives; do not add DOM-click, force-click, direct backend, or alternate browser paths.
3. Add focused regression coverage for the sidebar-options navigation.
4. Re-run `upgrade-launcher-live-smoke-r1`; if Project creation succeeds, continue the same smoke through agent completion and mandatory merge-to-main finalization.
5. Close this focus lock only after terminal COMPLETE exposes output + ChatGPT Project links.



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

Current ChatGPT web UI exposes `Chat sidebar options` but the Project recovery path only searches directly for `Organize sidebar`. Because it never opens the sidebar-options menu, it fails with `PROJECT_CREATE_CONTROL_MISSING` even after backend health is restored.

## NEXT ACTION

Patch only the sidebar recovery path to open `Chat sidebar options`, then `Organize sidebar`, then `Show` when present, and reuse the existing Projects toggle + human Project creation logic.

## ANTI-DRIFT CHECK

Before each meaningful action:

`Which REMAINING DELTA item does this action eliminate or verify?`

If none, do not perform it.
