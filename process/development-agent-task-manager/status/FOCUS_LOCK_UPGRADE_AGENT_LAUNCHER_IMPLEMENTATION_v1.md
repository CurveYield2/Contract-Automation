# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

The Upgrade Agent Launcher must use one clean immutable ChatGPT login snapshot per browser run, interact with ChatGPT only through visible human UI, create one managed Project through the normal sidebar Projects control, create the task chat inside that Project, complete the focus-locked task, merge the verified implementation to target main, and expose output + Project links.

## CURRENT STATE

- Repository: `CurveYield2/Contract-Automation`
- Base: current `main` at `59c2f19547725b933405612fdd376a4990c02e5f`.
- PR #508 through PR #514 are merged; their required validation lanes passed before merge.
- Latest merged live Project-wake run `37157762182` proves:
  - persisted Project URL reuse works and reopened the exact saved Project;
  - Project identity was verified as `g-p-6ac177c98f0c81919e970bb2a69b8583`;
  - the exact wake was typed and visibly sent using the human-pointer path;
  - the rendered Project conversation visibly contained the exact wake before reload;
  - ChatGPT then exposed a visible human-verification/Cloudflare challenge while the conversation still had an optimistic local-chat route;
  - the automation aborted immediately as required, without reload and without resending.
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

**The wake has already been visibly sent. Do not send it again. Recover the created Project chat from a fresh immutable browser run and capture its durable Project-scoped conversation URL.**

A Cloudflare/human-verification challenge appeared only after the visible send, while waiting for the optimistic local route to become durable. Immediate abort was correct. The next action must be read/recovery-only with the unique wake marker.

## REMAINING DELTA

1. Change the canonical v10 request from `project_wake` to `recover`; keep the exact original wake message as the unique search marker.
2. Start from the immutable bootstrap login state; do not send any message.
3. Use the existing visible ChatGPT search flow with human pointer/typing to locate the already-created chat.
4. Accept the durable Project-scoped conversation URL `/g/g-p-.../c/<id>`.
5. Verify the exact original wake is visibly present in that recovered conversation.
6. Preserve the known Project URL separately for later reuse.
7. If human verification appears again, abort immediately without mutation; do not retry by resending.

## NEXT ACTION

Trigger the existing `recover` action against the unique HOME_EXIT_PROJECT_WAKE_VERIFY1 marker. No code change is authorized unless recovery itself exposes a new exact blocker.

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
