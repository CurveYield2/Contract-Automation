# Original Phase-0 Browser Deployment v1

This is the isolated copy of the **original simple Phase-0 browser automation**, before the later browser orchestration/recovery stack was layered on top.

## Historical baseline

Frozen source commit: `9cb832ec7864a65da02352c95c1cb23d9c1a4d3f`.

That commit is the point where the existing audit controller's browser registration was bound to the Phase-0 `P0_BOOTSTRAP` boundary. At this point the deployment model was still simple:

1. the controller reads a campaign browser registration;
2. it directly dispatches the wake workflow;
3. the wake uses `CHATGPT_STORAGE_STATE_B64` directly on GitHub-hosted Playwright;
4. `create_fresh` creates/posts to a normal ChatGPT conversation and stores the resulting chat URL;
5. `resume_existing` opens the stored `chatgpt.com/c/...` URL;
6. the wake arms the watchdog;
7. the watchdog observes that same conversation and sends the configured idle message only when it is stalled.

There is no browser orchestrator between the controller and the browser wake in this baseline.

## Deliberately excluded later layers

This isolated v1 does **not** include the later interphase mechanical worker, cached/isolated browser runtime, rolling encrypted session cache, browser routine engine, ChatGPT Project creation, chat renaming, reviewer repair/replacement workflow, reasoning slider automation, durable-URL repair logic, temporary-chat repair, or the later session-source/bootstrap-recovery stack.

## Isolated runnable workflows

- `.github/workflows/browser-agent-original-phase0-wake-v1.yml`
- `.github/workflows/browser-agent-original-phase0-watchdog-v1.yml`

They use:

- `packages/browser-agent-original-phase0-v1/browser-agent-wake-v1.mjs`
- `process/browser-agent-original-phase0-v1/registrations/`
- `process/browser-agent-original-phase0-v1/watchdog/`

The isolated workflows install their original browser dependencies inside the GitHub runner exactly as the historical workflow did. Nothing is downloaded or compiled in the local ChatGPT environment.

## Separation rule

The current browser-agent/orchestrator/reviewer-repair files are untouched and are **not dependencies** of this copy. The only functional edits to the historical source are workflow/file names and repository state paths required to keep this v1 isolated from the later implementation.

See `ORIGIN_MANIFEST_v1.json` for exact historical blob identities.
