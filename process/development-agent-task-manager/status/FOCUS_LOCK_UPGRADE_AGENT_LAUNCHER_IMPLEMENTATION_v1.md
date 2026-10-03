# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

The Upgrade Agent Launcher must use one clean immutable ChatGPT login snapshot per browser run, interact with ChatGPT only through visible human UI, create one managed Project through the normal sidebar Projects control, create the task chat inside that Project, complete the focus-locked task, merge the verified implementation to target main, and expose output + Project links.

## CURRENT STATE

- Repository: `CurveYield2/Contract-Automation`
- Base: current `main` at `fe681ffc2fea791acd0a1b01b0c8bd41b5c21936`.
- PR #508 through PR #511 are merged; the final PR #511 head passed both required validation lanes before merge.
- Latest merged live Project-wake run `37156159975` proves:
  - home-exit routing succeeded;
  - immutable bootstrap secret loaded successfully;
  - ChatGPT became visibly ready without a Cloudflare challenge;
  - Project creation succeeded;
  - browser automatically navigated to and captured Project URL `https://chatgpt.com/g/g-p-6ac177c98f0c81919e970bb2a69b8583/project`;
  - the exact wake was typed and visibly sent with the human-pointer path;
  - terminal failure occurred only afterward because chat-route verification recognizes only root `https://chatgpt.com/c/<id>` URLs.
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

**The post-send verification parser rejects valid Project-scoped chat URLs.**

Project creation and the human send are now working. The remaining blocker is route recognition: `chatRouteInfo`, recovery selectors, resume validation, and manager validators assume only `/c/<id>`; Project chats use `/g/g-p-.../c/<id>`.

## REMAINING DELTA

1. Extend visible chat-route recognition to accept both root `/c/<id>` and Project-scoped `/g/g-p-.../c/<id>` routes.
2. Keep local optimistic `local-chatgpt:` handling unchanged.
3. Extend visible recovery/search link matching to Project-scoped chat links.
4. Extend browser resume/verification and workflow validators that currently hard-require `https://chatgpt.com/c/`.
5. Preserve captured `projectUrl`; the Development Agent Task Manager already persists it to `.continuity.project.url` in durable manager state for future replacement/open operations.
6. Add regression coverage for both root and Project-scoped durable chat URLs.
7. Run both validation lanes, merge only after both pass, then rerun the exact Project wake.
8. Verify the exact wake remains visibly present after human-style reload and the returned `chatUrl` is the Project-scoped conversation URL.

## NEXT ACTION

Create a narrow branch from this lock state and update route recognition/validation only for valid Project-scoped conversation URLs.

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
