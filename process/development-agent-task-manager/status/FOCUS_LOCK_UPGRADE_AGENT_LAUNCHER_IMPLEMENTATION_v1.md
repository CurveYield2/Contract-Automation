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
- Base: current `main` at `ff468b253f70098d1a9bae572840ba58e24909b9`.
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

**Run `37166240111` conclusively proved the exact saved Project route is being entered through the visible X11 Chrome omnibox, but Cloudflare is currently presenting a real verification interstitial: observed URL remained the exact Project URL, title was `Just a moment...`, and evidence was `just-a-moment-title`. The worker immediately aborted as required. This gate must not be bypassed. Browser qualification for the current implementation passes in V7 run `37166251924`; remaining Lite failure is the unrelated pre-existing audit-harness literal-\\n syntax corruption.**

Current browser implementation is code-complete for the known navigation defect. The only live-proof blocker is the external verification interstitial on the Project deep link.

## REMAINING DELTA

1. Diagnose why the known persisted Project URL redirected to `https://chatgpt.com/` in merged live run `37164591468`; do not reintroduce sidebar Project discovery.
2. Preserve the merged center-page chat-title logic and zero-scroll invariant.
3. Re-run recovery until the known Project URL opens successfully, then click the visible `VERIFY PROJECT WAKE SIGNAL` title in the top-center Project content.
4. The moment the Project-scoped durable chat route appears, verify `durable-chat-state-captured` is logged and the Actions artifact `browser-agent-home-exit-v10-chat-state-v1` is actually created.
5. On the following run, prove the artifact restores `chatUrl` and recovery opens that chat URL directly, bypassing Project discovery entirely.
6. Once direct chat URL reuse is live-proven, replace only the broken browser wake/watch implementation in the audit process pathway with this proven routine.
7. Locate the most recent CurveYield DEX v16 audit campaign in `CurveYield2/Audit-Controller`, recover its exact current state, and initialize Phase 1 without restarting completed/sealed work.
8. Monitor and repair each audit wake/watch/phase-transition glitch using DIAGNOSE -> REPAIR -> RETRY -> VERIFY -> CONTINUE until the audit is complete.


## NEXT ACTION

After cooldown, retry the exact current merged recovery on a fresh runner with no code relaxation. If Cloudflare again presents `Just a moment...`, abort and retry only after another cooldown; do not bypass verification. When one clean run reaches the Project, finish center-title recovery, durable chat URL/artifact capture, then immediately prove artifact-restored direct-chat recovery. After those live proofs, transplant only this browser implementation into the existing audit wake/watch path and resume DEX v16 Phase 1.

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
