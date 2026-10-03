# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

The Upgrade Agent Launcher must use one clean immutable ChatGPT login snapshot per browser run, interact with ChatGPT only through visible human UI, create one managed Project through the normal sidebar Projects control, create the task chat inside that Project, complete the focus-locked task, merge the verified implementation to target main, and expose output + Project links.

## CURRENT STATE

- Repository: `CurveYield2/Contract-Automation`
- Base: current `main` at `7e9e322d58227f96de611f430e2076d37377f934`.
- PR #508 through PR #514 are merged; their required validation lanes passed before merge.
- Recovery-only run `37158898640` proves:
  - fresh immutable browser state loads normally without a Cloudflare challenge;
  - no wake resend occurs in recovery mode;
  - sidebar Search can be opened and a query can be entered, but no matching global search result was found;
  - global/sidebar Search is unnecessary for Project recovery.
- Operator-confirmed Project UI model:
  - open the exact Project URL directly;
  - the Project page has its own top input/composer;
  - the Project's chats are visibly listed underneath that top area;
  - a sidebar may exist, but recovery does not need it.
- Operator supplied the exact Project URL to use: `https://chatgpt.com/g/g-p-6ac173c6f6648191969a8988d6b2d51a/project`.
- Durable Project URL for this test is now operator-confirmed as `https://chatgpt.com/g/g-p-6ac173c6f6648191969a8988d6b2d51a/project`.
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

**Recovery is using the wrong UI model. It must recover from inside the Project page's own visible chat list, not global/sidebar Search.**

The Project URL is known. Open it directly, then use the visible list of Project chats underneath the Project page's top input/composer. Do not resend the wake.

## REMAINING DELTA

1. Keep the canonical request in `recover` mode.
2. Replace the test request's persisted Project URL with the exact operator-supplied URL.
3. For recovery, navigate directly to that Project URL before any homepage/global-search flow.
4. On the visible Project page, ignore the sidebar and enumerate only the visible Project chat entries underneath the Project page's top input/composer.
5. Open the matching Project chat with the existing human pointer primitive. Prefer an exact/contains match on the unique wake marker/title when visible.
6. Accept the durable Project-scoped `/g/g-p-.../c/<id>` route and verify the exact wake visibly exists.
7. Do not send any message. Abort immediately if a human-verification challenge appears.

## NEXT ACTION

Create a narrow branch from current main that removes global/sidebar Search from recovery and instead opens the exact Project URL and selects the existing chat from the visible Project chat list underneath the Project page's top input/composer.

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
