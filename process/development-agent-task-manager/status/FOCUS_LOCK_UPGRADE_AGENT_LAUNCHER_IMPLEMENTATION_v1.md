# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

The Upgrade Agent Launcher must use one clean immutable ChatGPT login snapshot per browser run, interact with ChatGPT only through visible human UI, create one managed Project through the normal sidebar Projects control, create the task chat inside that Project, complete the focus-locked task, merge the verified implementation to target main, and expose output + Project links.

## CURRENT STATE

- Repository: `CurveYield2/Contract-Automation`
- Base: current `main` at `788b5da91f944575b94ec982fab76d7c40ffc41f` after PR #508 merged and canonical qualification refresh.
- PR #508 is merged and both validation lanes passed.
- Merged live Project-wake run `37154646487` proves:
  - home-exit routing succeeded;
  - immutable bootstrap secret loaded successfully;
  - ChatGPT became visibly ready without a Cloudflare challenge;
  - the Create-project modal name field was found and submitted successfully enough to clear the former modal-input blocker;
  - terminal failure moved to: `Created Project did not become visibly ready with its Project-scoped new-chat box within 60 seconds`.
- The operator supplied a screenshot of the successful Project landing page. Its reliable human-visible cue is the central composer labeled `New chat in <ProjectName>`, which differs from the homepage composer.
- Retry must first recover/open an already-created Project with the same exact name if one exists, to avoid duplicate Projects.
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

**The browser now clears Project creation but fails to recognize the resulting Project landing page / Project-scoped new-chat composer.**

Current verification wrongly requires the Project name to be visible inside a `main/[role=main]` subtree before accepting the composer. The operator screenshot shows the strongest visible cue is the Project-specific composer text `New chat in <ProjectName>`.

## REMAINING DELTA

1. Add visible-UI recovery for an existing exact-name Project before attempting creation, so retries never create duplicates.
2. Identify the Project landing page using the visible `New chat in <ProjectName>` composer cue rather than requiring the Project title inside `main/[role=main]`.
3. Keep all ChatGPT interaction human-visible only: mouse/keyboard/scroll and visible accessible controls; no backend/API/network telemetry, no page-context `evaluate()`, no synthetic DOM click/fill, no clipboard injection.
4. Add/update regression coverage for exact-name Project recovery and the Project-specific composer cue.
5. Run both validation lanes.
6. Merge only after both pass.
7. Re-run the exact `HOME_EXIT_PROJECT_WAKE_VERIFY1` Project wake from merged `main`.
8. Verify the wake is visibly sent inside that Project and persists after the existing visible verification flow.
9. Persist/share the Project URL when the existing share-link stage is reached.

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
