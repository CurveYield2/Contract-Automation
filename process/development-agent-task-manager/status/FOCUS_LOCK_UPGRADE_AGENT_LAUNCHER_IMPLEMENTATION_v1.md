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

**The real Chrome omnibox path is now proven: run `37165935536` used `visible-x11-keyboard` and navigated away from the homepage, but the destination immediately met the strong-cue challenge detector and failed closed. No bypass is permitted. Commit `3a3499cd1b438352667cbd55c90eea75b2b31a1c` adds non-content diagnostics that log only the observed URL/title plus named strong challenge cues before abort, so the next live run can distinguish an actual verification interstitial from any remaining classification edge case.**

Current browser repair state:
- `b1b3a01d192f4e2c72811b565131cbc930ab32db` — visible X11 Chrome omnibox control.
- `c7a1e5702b698d3da444e8e1dfa2d54df8897f51` — workflow installs `xdotool`.
- `3a3499cd1b438352667cbd55c90eea75b2b31a1c` — strong-cue diagnostic before fail-closed abort.
- Regression drift repairs continue in parallel and do not relax any browser invariant.

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

Inspect the live diagnostic run from commit `3a3499cd1b438352667cbd55c90eea75b2b31a1c`. If it proves a genuine verification interstitial, keep aborting and retry only on a fresh runner after cooldown; do not bypass it. If classification is wrong, repair only that classifier. Once the saved Project opens, click the visible center chat title, capture the durable Project-scoped chat URL/artifact, then prove artifact-restored direct saved-chat recovery before audit integration.

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
