# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

The Upgrade Agent Launcher must use one clean immutable ChatGPT login snapshot per browser run, interact with ChatGPT only through visible human UI, create one managed Project through the normal sidebar Projects control, create the task chat inside that Project, complete the focus-locked task, merge the verified implementation to target main, and expose output + Project links.

## CURRENT STATE

- Repository: `CurveYield2/Contract-Automation`
- Base: current `main` at `c750ee95d8768c7b564174304d637cb6579b152c`.
- PR #508 through PR #514 are merged; their required validation lanes passed before merge.
- Recovery-only run `37158111510` proves:
  - fresh immutable browser state loads normally without a Cloudflare challenge;
  - no wake resend occurs in recovery mode;
  - the current blocker is only the stale chat-search UI locator: after opening the search/filter surface, no old-style `input` or `searchbox` was found.
- Current ChatGPT UI behavior is to open Search chats with the normal Ctrl+K/Cmd+K shortcut and present a visible editor labeled/placeholdered `Search chats...`.
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

**Recovery uses a stale search-popup locator. Use the current human keyboard shortcut (Ctrl+K/Cmd+K) and current visible `Search chats...` editor.**

No message mutation is allowed: the wake was already sent in run `37157762182`.

## REMAINING DELTA

1. Keep the canonical request in `recover` mode.
2. Open ChatGPT Search chats with the human keyboard shortcut Ctrl+K (Meta+K fallback only where applicable).
3. Locate the visible `Search chats...` editor across current textbox/input/textarea/contenteditable/combobox shapes.
4. Type only the unique wake marker with the existing human typing primitive.
5. Click the matching visible result with the human pointer primitive.
6. Accept the durable Project-scoped `/g/g-p-.../c/<id>` conversation route and verify the exact wake visibly exists.
7. Do not send any message. Abort immediately if a human-verification challenge appears.

## NEXT ACTION

Create a narrow branch that updates only recovery Search chats opening/field targeting, validate, merge, and rerun the existing recovery request.

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
