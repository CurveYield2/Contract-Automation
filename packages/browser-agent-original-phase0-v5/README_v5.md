# Original Phase-0 Browser Known-Good Snapshot v5

## Purpose

This directory preserves the exact browser implementation that successfully created and messaged a real ChatGPT conversation on 2026-09-27.

Historical source commit:

`491d9d57350cd4732bf9c37e9f84d0d871d47398`

Known-good GitHub Actions run:

`36314895770`

Known-good prompt:

`Calculate this basic equation and reply with just the answer: (37 * 14) + 92`

Durable chat created by that run:

`https://chatgpt.com/c/6ab8f9ec-1758-83e8-b798-d60b976f688e`

The successful run used:

- GitHub-hosted Playwright.
- `CHATGPT_STORAGE_STATE_B64` as the bootstrap-secret session source.
- graphical Chrome under Xvfb (`BROWSER_HEADLESS=false`).
- the runtime versions preserved in `runtime-v5/package.json`.
- the browser code preserved byte-for-byte in `browser-agent-wake-v5.mjs`.

The successful log reached `posted:true`, `after.generating:true`, and a durable `https://chatgpt.com/c/...` URL before later workflow bookkeeping failed.

## 2026-10-01 reproduction result

The same historical code, runtime versions, bootstrap secret, headful Chrome, and Xvfb were replayed against both an existing chat and create-fresh mode.

The browser can authenticate sufficiently to render ChatGPT and the target conversation, but ChatGPT write/read APIs are currently rejected by Cloudflare. The decisive network evidence was:

- `/backend-api/f/conversation/prepare` -> HTTP 403.
- conversation read/stream endpoints -> HTTP 403.
- response header `cf-mitigated: challenge`.
- response server `cloudflare`.
- the UI may create a local `You said:` bubble followed by `Unknown error / Retry`; that is not a successful delivery.
- create-fresh falls back to a non-durable `/c/local-chatgpt:...` route and does not enter generation.

The original bootstrap state contains a historical `.chatgpt.com` `__cf_bm` expiry of 2026-09-27 11:13:35 UTC. The known-good run delivered at approximately 11:11:42 UTC. A subsequent historical attempt began exhibiting the browser challenge immediately after that expiry window.

On 2026-10-01, loading ChatGPT on a GitHub runner caused Cloudflare to issue fresh `.chatgpt.com` `cf_clearance` and `__cf_bm` cookies, but backend probes still returned HTTP 403 with `cf-mitigated: challenge`. Therefore merely waiting, reloading, or rotating GitHub-hosted runners is not a valid repair.

## Recovery boundary

Do not rewrite the browser send logic again unless a new defect is independently demonstrated. The September-27 implementation is already proven.

The remaining requirement is an execution/session environment that ChatGPT accepts for authenticated backend requests. Once the backend preflight no longer returns `cf-mitigated: challenge`, the preserved v5 send path is the baseline to retest.

## Folder layout

The restored known-good browser package is intentionally self-contained here:

- `browser-agent-wake-v5.mjs` — exact known-good browser implementation.
- `browser-session-state-v1.mjs` — exact known-good session helper.
- `runtime-v5/package.json` — exact known-good browser runtime manifest.
- `runtime-v5/action.yml` — known-good runtime setup action with only path relocation into this package.

The deleted top-level `tools/browser-agent-runtime/` folder is intentionally not recreated.
