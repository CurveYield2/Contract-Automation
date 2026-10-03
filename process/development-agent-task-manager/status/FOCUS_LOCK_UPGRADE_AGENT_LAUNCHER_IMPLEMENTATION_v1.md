# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

The Upgrade Agent Launcher must use one clean immutable ChatGPT login snapshot per browser run, interact with ChatGPT only through visible human UI, create one managed Project through the normal sidebar Projects control, create the task chat inside that Project, complete the focus-locked task, merge the verified implementation to target main, and expose output + Project links.

## CURRENT STATE

- Repository: `CurveYield2/Contract-Automation`
- Base: current `main` at `90a76470592eb6aa72469f8572676cc4193b4736`.
- PR #508 through PR #512 are merged; the final PR #512 head passed both required validation lanes before merge.
- Latest merged live Project-wake run `37156888925` proves:
  - home-exit routing succeeded;
  - immutable bootstrap secret loaded successfully;
  - ChatGPT became visibly ready without a Cloudflare challenge;
  - the previously created Project remains visible by exact name;
  - route support for Project-scoped chats is merged;
  - retry failed only because clicking the existing sidebar Project entry did not navigate.
- Durable Project URL already captured from the successful creation run: `https://chatgpt.com/g/g-p-6ac177c98f0c81919e970bb2a69b8583/project`.
- Project chats use a Project-scoped durable route of the form `https://chatgpt.com/g/g-p-.../c/<id>`.
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

**Retries must reuse the already captured durable Project URL instead of depending on clicking the sidebar Project entry by name.**

Project creation is already proven successful and its exact Project URL is known. The sidebar-name recovery click is unnecessary and failed to navigate in run `37156888925`. The system should persist and reuse the exact Project URL for future opens.

## REMAINING DELTA

1. Add optional persisted `project_url` to the v10 request/workflow input path.
2. On `project_wake`, if a valid persisted Project URL is supplied, open that exact Project URL before any sidebar-name recovery or new Project creation.
3. Persist the known test Project URL in `current-request-v10.json`.
4. Preserve the existing first-creation path for requests with no saved Project URL.
5. Keep Project-scoped conversation route support from PR #512 unchanged.
6. Preserve `.continuity.project.url` persistence in the Development Agent Task Manager for managed Project tasks.
7. Add regression coverage for saved-Project-URL reuse and no duplicate creation.
8. Run both validation lanes, merge only after both pass, then rerun the exact Project wake.
9. Verify the exact wake remains visibly present after human-style reload and the returned `chatUrl` is the Project-scoped conversation URL.

## NEXT ACTION

Create a narrow branch from this lock state, wire persisted `project_url` into the v10 request, and reuse the exact saved Project URL before any sidebar-name recovery.

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
