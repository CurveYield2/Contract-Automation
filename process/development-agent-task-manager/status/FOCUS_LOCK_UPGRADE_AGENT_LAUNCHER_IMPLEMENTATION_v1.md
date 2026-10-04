# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

1. Finish and live-prove the repaired human-only Project wake/recovery browser routine.
2. Replace only the broken browser wake/watch implementation inside the audit process pathway with that proven routine; do not recreate or redesign the audit pipeline.
3. Preserve all current audit/controller authority, validation, phase, Project-continuity, and human-only browser invariants.
4. Initialize the Phase 1 wake for the most recent CurveYield DEX v16 audit campaign.
5. Monitor the audit wake/watch/controller execution for glitches; for each actual glitch use DIAGNOSE -> REPAIR -> RETRY -> VERIFY -> CONTINUE.
6. Continue the existing campaign through its required phases until the audit is complete, without restarting sealed/completed work.

## CURRENT STATE

- Active browser lane is now **Manual-Only Home-Exit Browser v11**.
- Canonical workflow: `.github/workflows/browser-agent-home-exit-v11.yml`.
- Canonical browser script: `packages/browser-agent-manual-only-v11/browser-agent-manual-v11.mjs`.
- Canonical request: `process/browser-agent-home-exit-v11/current-request-v11.json`.
- v10 executable workflow is intentionally disabled and rejects execution because it used automated ChatGPT DOM/page reads.
- v11 launches authenticated headed Chrome on `about:blank`, exposes it over private Tailscale VNC, and then performs **zero ChatGPT automation**:
  - no ChatGPT DOM reads;
  - no title/url reads;
  - no locators;
  - no automated ChatGPT navigation;
  - no automated ChatGPT clicking;
  - no automated ChatGPT typing;
  - no automated Cloudflare interaction.
- All ChatGPT actions are performed by the human operator through VNC.
- Fresh live request:
  - Project: `HOME_EXIT_PROJECT_WAKE_VERIFY2`
  - Chat: `VERIFY PROJECT WAKE SIGNAL 2`
  - Wake: `[HOME_EXIT_PROJECT_WAKE_VERIFY2] Assistant: when you personally receive this as a new user message inside this new Project, reply exactly HOME_EXIT_PROJECT_WAKE_PERSONALLY_SEEN_VERIFY2`
- Live v11 run: `37167404285`.

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

**Automated Project/chat recovery is intentionally removed from the active lane. The remaining browser step is human operation through the private VNC session: navigate to ChatGPT manually, complete any Cloudflare verification manually, create a brand-new Project and a brand-new chat, and send the supplied wake manually.**

There is no remaining machine-side Project-URL recovery attempt in v11. The old v10 workflow is disabled.

## REMAINING DELTA

1. Human operator connects to the active v11 runner VNC address.
2. In the visible Chrome window, manually navigate to ChatGPT.
3. If Cloudflare appears, manually complete the verification and wait for the normal page.
4. Manually create Project `HOME_EXIT_PROJECT_WAKE_VERIFY2`.
5. Manually create chat `VERIFY PROJECT WAKE SIGNAL 2` inside that Project.
6. Manually send the exact VERIFY2 wake.
7. Human confirms the wake arrived in the new Project chat.
8. Only after that proof, decide how the audit wake/watch path should operate under the new zero-ChatGPT-machine-read rule. Automatic browser wake/watch cannot be transplanted unchanged because that would violate the new rule.

## NEXT ACTION

Use the currently running v11 private VNC session to perform the fresh Project/chat creation and wake manually. Do not re-enable v10 or any ChatGPT DOM/page-read automation.

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
