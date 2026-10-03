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
- Current main checked after sidebar repair merge and smoke retrigger.
- Sidebar repair merge commit: `77bdce5bea75ff2868394aaaa7cb2708f9a87a15`
- Smoke retrigger commit: `0ae6e4fde7a08c78c864ba95fc55b708416dc130`

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

- Launcher design v2, launcher implementation, merge finalization, output metadata and Project continuity are merged.
- V7 Execution Infrastructure Qualification and Lite Structured Phase Regression passed for the launcher implementation.
- Saved ChatGPT bootstrap state is confirmed in live runs.
- Backend-health/manual-verification wait is merged and regression-tested.
- Live smoke proved ChatGPT backend verification can clear and return healthy 200 responses.
- Live smoke terminal UI diagnostics identified the current sidebar layout: visible `Chat sidebar options` with Projects hidden.
- Project sidebar recovery was repaired to follow the visible human path: `Chat sidebar options -> Organize sidebar -> Show -> Projects`.
- Project sidebar repair PR #497 passed both GitHub validation suites.
- Project sidebar repair PR #497 was merged to main at `77bdce5bea75ff2868394aaaa7cb2708f9a87a15`.
- The same `upgrade-launcher-live-smoke-r1` request was retriggered without changing its specification, target branch, or end-state.

## REMAINING DELTA

1. Obtain one healthy smoke runner through the existing home-exit routing step; do not modify browser/Project code for a runner-level routing stall.
2. Verify the merged sidebar repair creates the managed ChatGPT Project and persists active manager state.
3. Continue the same smoke through focus-locked agent completion and mandatory merge-to-main finalization.
4. Close this focus lock only after terminal COMPLETE exposes output + ChatGPT Project links.



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

Current smoke run `37087636054` is stalled before browser execution in `Route browser phase through home exit node`. Tailscale connection and visible VNC setup succeeded, but the routing step has exceeded its normal internal bounded duration. This run has not exercised the newly merged Project sidebar repair yet.

## NEXT ACTION

Treat the current run as a runner/infrastructure instance until it either fails or recovers. Do not change Project/browser code. Once the run terminates, use the existing retry path/fresh runner to exercise the same smoke task.

## ANTI-DRIFT CHECK

Before each meaningful action:

`Which REMAINING DELTA item does this action eliminate or verify?`

If none, do not perform it.
