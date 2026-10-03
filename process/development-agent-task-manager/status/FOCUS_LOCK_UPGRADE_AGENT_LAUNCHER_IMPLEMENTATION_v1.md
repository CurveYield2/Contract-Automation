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
- Base: current `main` at `5b73c30a477f3bf0af707a94bbd097ace8c0dd4d`.
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

**Merged live run `37162936420` revealed that the exact Project title selector is correct, but the selected title was not actually on-screen when chosen.**

Critical evidence:
- selector matched `HOME_EXIT_PROJECT_WAKE_VERIFY1`;
- logged title box before click preparation: `x=42, y=-522, width=261, height=20`;
- Playwright `isVisible()` treated that off-viewport element as visible;
- the click helper then used programmatic `scrollIntoViewIfNeeded()`, after which gestures fired around `y=373`;
- real double-click semantics were confirmed (`clickCountSequence:[1,2]`) but URL still did not navigate;
- no Cloudflare challenge and no wake resend occurred.

The exact title selector and user-directed click sequence remain locked. The next repair changes only human-visible viewport handling: Projects/title must be physically on-screen before selection, sidebar movement must use human mouse-wheel scrolling, and Project recovery must not use `scrollIntoViewIfNeeded()`.


## REMAINING DELTA

1. Validate the current gesture-sequence candidate in the required repository lanes. The unrelated `run-v5.mjs` / `run-v6.mjs` syntax defect may be normalized only in a validation-only branch and must not be merged with browser work.
2. Merge the production browser candidate only after the browser candidate itself is proven green.
3. Run the merged recovery workflow and prove:
   - correct existing Project opens;
   - Project URL is captured;
   - existing `VERIFY PROJECT WAKE SIGNAL` chat opens from the Project page;
   - exact original wake is visibly present;
   - no wake is resent.
4. Inspect the audit process wake/watch pathway and replace only its broken browser implementation with the proven routine. Preserve controller/orchestrator/audit semantics.
5. Run end-to-end audit-path validation for a Phase 1 wake.
6. Locate the most recent CurveYield DEX v16 audit campaign in `CurveYield2/Audit-Controller`; recover its exact current durable state and do not restart sealed/completed phases.
7. Initialize Phase 1 wake for that campaign using the current authority skill and required controller validation/campaign/Project links.
8. Monitor every wake/watch/phase transition. Repair each concrete glitch, restart only the failed step, and continue until the audit reaches its defined completion state.

## NEXT ACTION

Finish validation + merged live proof for the current Project-title gesture sequence. Immediately after success, transplant the proven browser routine into the audit wake/watch pathway and begin the latest DEX v16 campaign Phase 1 wake.


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
