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
- Current main commit checked: `147af0885915eef9c6e4eb8a59f747265bf6b82d`
- Upgrade Agent Launcher implementation merged.
- Shared development-agent ChatGPT visible-only verification merged by PR #502 at merge commit `8caf39065cc64e40d9cbe56a0f002384d4f2c250`.
- Dedicated v10 create-fresh VERIFY4 request currently exercising merged behavior.
- Current dedicated browser run: `37145638325`.

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
- All ChatGPT interaction and verification must use visible human browser behavior only:
  - no direct ChatGPT backend/API reads;
  - no request/response network telemetry as proof;
  - no synthetic DOM/form/force writes;
  - no page-context clipboard injection.

## SATISFIED

- Launcher design v2 and launcher implementation are merged.
- Cloudflare intake, GitHub fallback admission, merge finalization, output metadata, and Project continuity are implemented.
- V7 Execution Infrastructure Qualification and Lite Structured Phase Regression passed for the launcher implementation.
- Saved ChatGPT authenticated state is confirmed in live runs.
- Project sidebar recovery follows the current visible UI path: `Chat sidebar options -> Organize sidebar -> Show -> Projects`.
- Project sidebar repair PR #497 is merged.
- Original v10 browser verification was repaired to visible-browser-only behavior and merged.
- Shared development-agent browser runtime was repaired to visible-browser-only behavior.
- Shared-runtime duplicate-safety is preserved: every post-Send verification failure is non-retryable.
- PR #502 passed both repository validation suites and is merged.
- Static guards now prohibit backend/network ChatGPT verification and synthetic ChatGPT writes in both v10 and the shared runtime.
- Tailscale home-exit routing has been proven successful in finalized runs; apparent long-lived `Route browser phase...` states can be GitHub Actions status lag while Playwright is already running.

## REMAINING DELTA

1. Let dedicated v10 run `37145638325` reach a finalized Playwright result without retriggering it.
2. Verify `create_fresh` produces a visible new chat, captures its chat route, performs a normal human-style reload, and still visibly contains VERIFY4 using no machine backend/network reads.
3. If VERIFY4 succeeds, return to the existing `upgrade-launcher-live-smoke-r1` task and rerun it on merged shared-runtime code.
4. Verify the Development Agent Task Manager creates/persists the managed ChatGPT Project, runs the focus-locked agent, validates its completion receipt, merges the implementation to target `main`, and writes terminal completed state.
5. Close this focus lock only after terminal COMPLETE exposes both the output link and ChatGPT Project link.

## PARKED OBSERVATIONS

- General dashboards are out of scope.
- Active-task control buttons are out of scope.
- Audit-process redesign is out of scope.
- General repository cleanup is out of scope.
- Cloudflare deployment/account provisioning is outside repository code; implementation should be deployment-ready without embedded credentials.
- GitHub Actions live step-state lag is an observation only; do not redesign routing based solely on a stale in-progress label.

## ACTIVE BLOCKER

No code blocker is presently proven.

The only unresolved item is the terminal result of dedicated v10 create-fresh VERIFY4 run `37145638325`. Its live GitHub step state may lag behind the runner's actual progress, so it must not be retriggered solely because `Route browser phase through home exit node` appears in progress.

## NEXT ACTION

Wait for run `37145638325` to finalize. Inspect its completed Playwright log and classify only the exact terminal result. Do not change browser, Tailscale, Project, launcher, or audit code unless that finalized result proves a specific unsatisfied blocker.

## ANTI-DRIFT CHECK

Before each meaningful action:

`Which REMAINING DELTA item does this action eliminate or verify?`

If none, do not perform it.
