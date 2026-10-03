# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

The Upgrade Agent Launcher must use one clean immutable ChatGPT login snapshot per browser run, interact with ChatGPT only through visible human UI, create one managed Project through the normal sidebar Projects control, create the task chat inside that Project, complete the focus-locked task, merge the verified implementation to target main, and expose output + Project links.

## CURRENT STATE

- Repository: `CurveYield2/Contract-Automation`
- Base: current `main` at `768afef6fb97d1214187d90316bc4f7e8f7ed539` after PR #509 merged.
- PR #508 and PR #509 are merged; their required validation lanes passed.
- Merged live Project-wake run `37154646487` proves:
  - home-exit routing succeeded;
  - immutable bootstrap secret loaded successfully;
  - ChatGPT became visibly ready without a Cloudflare challenge;
  - the Create-project modal name field was found and submitted successfully enough to clear the former modal-input blocker;
  - terminal failure moved to: `Created Project did not become visibly ready with its Project-scoped new-chat box within 60 seconds`.
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

**The browser must bind successful Project creation to the automatic navigation onto the new Project URL, then resolve the Project-scoped new-chat composer on that destination.**

The previous verification depended only on page-content cues. The operator confirms that successful creation automatically changes the browser URL to the new Project URL. The repair must use that navigation as the first success signal, persist the resulting Project URL, then continue visible-UI composer resolution on the Project page.

## REMAINING DELTA

1. For a newly created Project, record the pre-create browser URL, click the visible Create project button, and wait for the browser to navigate to a distinct Project URL.
2. Persist that resulting Project URL immediately in the Project result state.
3. On the destination Project page, locate the Project-specific new-chat box using the visible `New chat in <ProjectName>` cue.
4. For retries, recover/open an existing exact-name Project before attempting creation, and retain the navigated Project URL.
5. Keep all ChatGPT interaction human-visible only: mouse/keyboard/scroll and visible accessible controls; no backend/API/network telemetry, page-context `evaluate()`, synthetic DOM click/fill, or clipboard injection.
6. Add/update regression coverage for Project URL transition capture plus exact-name recovery and Project-specific composer targeting.
7. Run both validation lanes, merge only after both pass, then rerun the exact `HOME_EXIT_PROJECT_WAKE_VERIFY1` Project wake from merged `main`.
8. Verify the wake is visibly sent inside that Project and persists after the existing visible verification flow.

## NEXT ACTION

Create a narrow branch from this focus-lock state and bind Project creation/recovery to the browser's automatic Project-URL navigation. Do not broaden scope.

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
