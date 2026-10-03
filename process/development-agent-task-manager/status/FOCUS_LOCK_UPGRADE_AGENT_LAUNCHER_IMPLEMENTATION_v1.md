# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

The Upgrade Agent Launcher must use one clean immutable ChatGPT login snapshot per browser run, interact with ChatGPT only through visible human UI, create one managed Project through the normal sidebar Projects control, create the task chat inside that Project, complete the focus-locked task, merge the verified implementation to target main, and expose output + Project links.

## CURRENT STATE

- Repository: `CurveYield2/Contract-Automation`
- Base: current `main` at `452d4056af0004409650897fd21c91f021de6914`.
- PR #508, PR #509, and PR #510 are merged; their required validation lanes passed.
- Latest merged live Project-wake run `37155631970` proves:
  - home-exit routing succeeded;
  - immutable bootstrap secret loaded successfully;
  - ChatGPT became visibly ready without a Cloudflare challenge;
  - the Create-project modal was found, the Project name was typed, and the Create project control was clicked;
  - browser URL did not change afterward, so the click did not actually create the Project.
- Most likely current UI cause: the Create project control is visible while disabled and is being clicked before it becomes enabled after typing the Project name.
- The operator supplied a screenshot of the successful Project landing page. Its reliable human-visible cue is the central composer labeled `New chat in <ProjectName>`, which differs from the homepage composer.
- Retry must first recover/open an already-created Project with the same exact name if one exists, to avoid duplicate Projects.
- New operator fact: after successful Project creation, the browser automatically navigates to that Project's URL. Treat that browser URL transition as the earliest durable Project-creation signal and capture the resulting Project URL immediately.
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

**After typing the Project name, wait for the visible Create project control to become enabled before clicking it.**

The latest live run reached the Create project click but did not navigate away from the homepage. Since successful creation is confirmed to auto-navigate to the Project URL, the click did not take effect. The current locator accepts a visible button even while disabled.

## REMAINING DELTA

1. After human typing finishes, reacquire the visible Create project button and wait a few seconds for it to become enabled.
2. Click only the enabled visible Create project control.
3. Wait a few seconds for automatic Project URL navigation and capture that URL.
4. Use the captured Project URL as the durable Project identity and include it in the browser result state.
5. For retries, recover/open an existing exact-name Project before attempting creation.
6. Keep all ChatGPT interaction human-visible only: mouse/keyboard/scroll and visible accessible controls; no backend/API/network telemetry, page-context `evaluate()`, synthetic DOM click/fill, or clipboard injection.
7. Run both validation lanes, merge only after both pass, then rerun the exact `HOME_EXIT_PROJECT_WAKE_VERIFY1` Project wake from merged `main`.
8. Verify the wake is visibly sent inside that Project and persists.

## NEXT ACTION

Create a narrow branch from this focus-lock state, wait for the visible Create project control to become enabled after typing, then rerun the exact Project wake.

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
