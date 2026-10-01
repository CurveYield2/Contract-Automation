# Original Phase-0 Browser Deployment v1

This folder isolates the pre-rewrite browser automation used by the original Phase-0 controller path.

## Frozen baseline

Source commit: `c2b9a732ff686f621c8d97a5d564bc8d2ed1b75f`.

That commit is the immediate parent of `71a57a10c86409ae53bf1405443232b961ad04d9`, which introduced rolling encrypted browser-session persistence. The isolated v1 therefore retains the earlier direct-login design: GitHub Playwright consumes `CHATGPT_STORAGE_STATE_B64` directly, with Browserless and Browserbase only as fallback providers.

The browser logic supports the two original modes only:

- `create_fresh`: open ordinary ChatGPT, post the supplied wake message, capture the resulting chat URL.
- `resume_existing`: open the supplied `chatgpt.com/c/...` URL and post/observe there.

The companion watchdog retains the original activity-aware behavior and can poke an idle existing chat with the configured message.

## What is deliberately not in this isolated deployment

No rolling encrypted session cache, browser routine engine, ChatGPT Project creation, chat renaming, reviewer replacement/repair workflow, reasoning-slider automation, durable-URL repair logic, or later browser recovery layers are imported here.

## Runnable workflows

- `.github/workflows/browser-agent-original-phase0-wake-v1.yml`
- `.github/workflows/browser-agent-original-phase0-watchdog-v1.yml`

They use only the code/runtime under this package plus the isolated state namespace:

- `process/browser-agent-original-phase0-v1/registrations/`
- `process/browser-agent-original-phase0-v1/watchdog/`

The current production browser workflows are intentionally untouched. This v1 is separated so it can be tested or rewired independently without inheriting the later browser stack.

## Historical controller wiring

The original controller model did not need a browser orchestrator. It read a campaign registration and directly dispatched `browser-agent-wake.yml`; the wake then armed the watchdog. This isolated pair preserves that deployment model, with only names and repository paths changed to keep its code and state separate.

See `ORIGIN_MANIFEST_v1.json` for exact historical blob identities and the intentionally excluded later layers.
