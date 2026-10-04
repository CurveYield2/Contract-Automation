# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

1. Finish and live-prove the repaired human-only Project wake/recovery browser routine.
2. Replace only the broken browser wake/watch implementation inside the audit process pathway with that proven routine; do not recreate or redesign the audit pipeline.
3. Preserve all current audit/controller authority, validation, phase, Project-continuity, and human-only browser invariants.
4. Initialize the Phase 1 wake for the most recent CurveYield DEX v16 audit campaign.
5. Monitor the audit wake/watch/controller execution for glitches; for each actual glitch use DIAGNOSE -> REPAIR -> RETRY -> VERIFY -> CONTINUE.
6. Continue the existing campaign through its required phases until the audit is complete, without restarting sealed/completed work.

## CURRENT STATE

- Repository: `CurveYield2/Contract-Automation`
- Base: current `main` at `b1dd3ec138883a9585203f15715b6df47540a07c`.
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

**Durable chat URL capture is now implemented and merged. Live recovery successfully opened the saved Project URL directly, with zero sidebar rediscovery, but the existing chat title lookup was too narrowly scoped to a `main/[role=main]` container.**

Merged live run `37164061408` proved:
- exact saved Project URL opened successfully;
- no sidebar Project search/scroll occurred;
- Project identity matched;
- failure was only `Visible Project chat title was not found in the Project chat list`;
- therefore the remaining step is to find the already-visible center-page chat title without assuming a specific semantic container.

Locked UI fact from operator:
- on the Project page the existing chat is in the top-center visible area;
- no scrolling is needed;
- click the visible chat title itself (or its visible subtitle area) to enter it;
- once the durable chat route appears, checkpoint/upload `chatUrl` immediately.


## REMAINING DELTA

1. Add a durable chat-state checkpoint file written immediately when a non-local durable `chatUrl` is observed, before later verification/reload steps can fail.
2. Upload that checkpoint as a GitHub Actions artifact even when a later browser step fails.
3. Restore the latest matching checkpoint at the beginning of later v10 runs when request `chat_url` / `project_url` are blank.
4. Make `action=recover` open a restored durable `chatUrl` directly and visibly verify the original wake there. Do not rediscover the Project through the sidebar.
5. Keep Project-page central chat-list recovery only as a no-chat-URL fallback when an explicit `projectUrl` is already known.
6. Validate in the required repository lanes, merge the production-only browser changes, and live-prove chat URL capture + reuse.
7. After proof, replace only the broken browser implementation in the audit wake/watch pathway with this proven routine.
8. Resume the most recent CurveYield DEX v16 campaign at Phase 1 and continue diagnose -> repair -> retry -> verify -> continue until the audit is complete.


## NEXT ACTION

Broaden only the Project-page chat-title lookup to physically visible center-page text, with zero scrolling, click it humanly, and capture the durable chat URL immediately when the route appears.

## PARKED / OUT OF SCOPE

- PR #505 and PR #506 branches are historical; do not restart them.
- Do not redesign Tailscale.
- Do not change immutable session-state behavior.
- Do not restore rolling browser-state caches.
- Do not add generic Project creation shortcuts.
- Do not add machine-speed or non-human write fallbacks.
- Do not resume general upgrade-launcher redesign. After Project-wake proof, scope moves only to the audit wake/watch pathway and the latest DEX v16 campaign.

## ANTI-DRIFT CHECK

Before every meaningful action ask:

> Which exact current blocker does this action eliminate or verify?

Until Project-wake proof: only diagnose, repair, validate, or retest the exact Project-title recovery blocker. After proof: only transplant the proven browser routine into the audit wake/watch pathway, initialize the latest DEX v16 Phase 1 wake, and diagnose/repair/continue that campaign until completion.
