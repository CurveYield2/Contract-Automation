# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

The Upgrade Agent Launcher must use one clean immutable ChatGPT login snapshot per browser run, interact with ChatGPT only through visible human UI, create one managed Project through the normal sidebar Projects control, create the task chat inside that Project, complete the focus-locked task, merge the verified implementation to target main, and expose output + Project links.

## CURRENT STATE

- Repository: `CurveYield2/Contract-Automation`
- Base: current `main` at `cb844a5ed5d9abe51a4a9db051ab12407aa7e0fa`.
- PR #508 through PR #513 are merged; their required validation lanes passed before merge.
- Latest merged live Project-wake run `37157337293` proves:
  - home-exit routing and immutable bootstrap session both succeeded;
  - saved `project_url` is passed through the v10 request/workflow correctly;
  - ChatGPT homepage became visibly ready without Cloudflare challenge;
  - direct open of the persisted Project URL did not remain on the validator's exact `/project` pathname;
  - failure occurred before any wake was sent, so no duplicate message was created.
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

**Saved Project URL reuse is wired correctly, but the post-navigation validator is too strict about the exact Project collection pathname.**

The persisted identity remains the same `g-p-...` Project. ChatGPT may canonicalize the collection page to the Project root rather than retaining the literal `/project` suffix. Accept only safe Project collection routes for that same `g-p-` identity, while continuing to reject homepage and conversation routes.

## REMAINING DELTA

1. Keep persisted `project_url` request/workflow wiring from PR #513 unchanged.
2. Broaden saved Project collection validation from only `/g/g-p-.../project` to the safe same-Project collection forms `/g/g-p-...` and `/g/g-p-.../project`.
3. Continue rejecting homepage, root `/c/` chats, and Project-scoped `/c/` conversation routes as Project collection URLs.
4. Preserve exact `g-p-` Project identity when reusing the saved URL.
5. Add regression coverage for canonicalized Project-root acceptance and conversation-route rejection.
6. Run both validation lanes, merge only after both pass, then rerun the exact Project wake.
7. Verify the exact wake remains visibly present after human-style reload and the returned `chatUrl` is the Project-scoped conversation URL.

## NEXT ACTION

Create a narrow branch from this lock state and relax only saved-Project collection route validation for safe canonicalized `g-p-` Project roots.

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
