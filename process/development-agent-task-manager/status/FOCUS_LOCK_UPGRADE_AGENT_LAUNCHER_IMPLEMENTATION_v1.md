# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

The Upgrade Agent Launcher must use one clean immutable ChatGPT login snapshot per browser run, interact with ChatGPT only through visible human UI, create one managed Project through the normal sidebar Projects control, create the task chat inside that Project, complete the focus-locked task, merge the verified implementation to target main, and expose output + Project links.

## CURRENT STATE

- Repository: `CurveYield2/Contract-Automation`
- Base: current `main` after PR #506 and handoff commit `41d04a4c2bb89e7cc9b0cf8d56e196f4d37b7fd6`.
- Narrow repair branch to use: `browser-project-name-control-v1`.
- PR #505 (`browser-bootstrap-secret-only-v1`) is merged and complete.
- PR #506 (`browser-project-sidebar-scroll-v1`) is merged and complete.
- Latest merged Project-wake run `37152694131` proves:
  - home-exit routing succeeded;
  - immutable bootstrap secret loaded successfully;
  - initial ChatGPT load succeeded without a Cloudflare challenge;
  - the sidebar/Projects flow advanced past the previous blocker;
  - the terminal failure is now exactly: `Project-name input was not found in the visible Project dialog`.
- The same Project-wake request remains the canonical comparable test:
  - Project: `HOME_EXIT_PROJECT_WAKE_VERIFY1`
  - wake: `[HOME_EXIT_PROJECT_WAKE_VERIFY1] Assistant: when you personally receive this as a new user message inside this new Project, reply exactly HOME_EXIT_PROJECT_WAKE_PERSONALLY_SEEN_VERIFY1`

## SATISFIED

- Human-only ChatGPT interaction remains enforced.
- No direct ChatGPT backend/API reads or writes are allowed.
- No request/response telemetry is used as delivery proof.
- No rolling automated browser state can contaminate later runs.
- Fresh immutable secret state is the single browser authentication baseline.
- Exact Project creation begins through sidebar Projects -> hover -> revealed plus.
- Sidebar-open/already-open handling is repaired.
- Human sidebar scrolling to Projects is repaired.
- Randomized visible-action pacing remains 0.3–1.5 seconds.
- Randomized per-character typing remains 0.2–0.4 seconds.
- Cloudflare/human-verification appearance is an immediate abort.
- Tailscale/home-exit routing is out of scope unless a finalized run proves it failed.

## ACTIVE BLOCKER

**The browser reaches the Project-create UI but cannot identify the visible Project-name editing control after clicking the hover-revealed Projects plus.**

Current code assumes the editing control is an `input` inside `[role="dialog"]`. The live UI did not match that assumption.

## REMAINING DELTA

1. Reproduce/inspect only the visible/local UI immediately after the Projects plus click.
2. Identify the actual visible Project-name editing control without backend/API or network telemetry.
3. Update only the Project-name locator/interaction needed for the current UI.
4. Add/update regression coverage for the current control without generic or non-human fallbacks.
5. Run both repository validation lanes:
   - Lite Structured Phase Regression v2
   - V7 Execution Infrastructure Qualification
6. Merge the narrow repair to `main` only after both pass.
7. Let the re-armed merged-code `project_wake` run.
8. Verify creation of `HOME_EXIT_PROJECT_WAKE_VERIFY1`, creation/use of a chat inside it, and visible sending of the exact wake.
9. Persist the Project URL when the existing Project share-link step is reached.
10. Only after Project wake succeeds may the parked full upgrade-agent launcher smoke resume.

## NEXT ACTION

Create `browser-project-name-control-v1` from this re-anchored current main state, then diagnose the visible Project-name control. Do not broaden scope.

## PARKED / OUT OF SCOPE

- PR #505 and PR #506 branches are historical; do not restart them.
- Do not redesign Tailscale.
- Do not change immutable session-state behavior.
- Do not change audit wake/monitor/orchestration pathways.
- Do not restore rolling browser-state caches.
- Do not add generic Project creation shortcuts.
- Do not add machine-speed or non-human write fallbacks.
- Do not resume general upgrade-launcher redesign until this Project-wake experiment succeeds.

## ANTI-DRIFT CHECK

Before every meaningful action ask:

> Which exact current blocker does this action eliminate or verify?

If it does not diagnose, repair, validate, or retest the Project-name-control blocker, do not perform it.
