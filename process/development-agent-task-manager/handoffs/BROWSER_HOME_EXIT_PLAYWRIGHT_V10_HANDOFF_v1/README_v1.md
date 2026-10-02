# Browser Home-Exit Playwright v10 Handoff v1

## Purpose

This handoff preserves the exact state of the browser-automation recovery campaign that restored reliable ChatGPT browser wake delivery through GitHub-hosted Playwright by routing browser-phase internet traffic through the user's normal home network with Tailscale.

The successor must **continue from this state**. Do not restart from the old Browserless/Browserbase experiments, do not replace Playwright, and do not reintroduce deleted v1/v5/v7/v8/v9 browser packages.

## Human-confirmed success

The decisive success is **VERIFY4**.

Target conversation:

`https://chatgpt.com/c/6abe90a0-fd68-83e8-8026-8af0171605fc`

Wake text:

`[HOME_EXIT_PLAYWRIGHT_WAKE_v10_VERIFY4] Assistant: when you personally receive this as a new user message in this exact conversation, reply exactly HOME_EXIT_PLAYWRIGHT_WAKE_PERSONALLY_SEEN_v10_VERIFY4`

Request commit:

`49a31f8ab51e0de4480a2d3e2ab20e4180b1d27d`

Actions run:

`36942207641`

The user explicitly confirmed in the live ChatGPT conversation that the VERIFY4 wake message appeared and was **correctly stored in chat**.

This is stronger evidence than the final Actions conclusion. The Actions run later became `cancelled` because the post-send verification/reload path hit Cloudflare challenges after the message had already been submitted. Do not interpret that run conclusion as evidence that delivery failed.

## Current implementation

Current browser package:

`packages/browser-agent-original-phase0-v10/`

Current workflow:

`.github/workflows/browser-agent-home-exit-v10.yml`

Current connector-trigger request:

`process/browser-agent-home-exit-v10/current-request-v10.json`

Authentication:

- Tailscale GitHub Action auth-key flow.
- Required GitHub secret: `TAILSCALE_AUTHKEY`.
- ChatGPT bootstrap state secret: `CHATGPT_STORAGE_STATE_B64`.
- Optional encrypted rolling state key: `CHATGPT_SESSION_STATE_KEY_B64`.

Home exit node used in this campaign:

`100.112.238.56`

## Working architecture

GitHub-hosted Ubuntu runner
→ Tailscale joins user's tailnet
→ runner selects user's Windows PC as exit node
→ Chrome/Playwright traffic exits through user's normal home internet
→ ChatGPT

Chrome remains on the GitHub runner. The Windows PC does **not** run Playwright, GitHub Runner, or the audit automation.

Optional human visibility is provided by x11vnc bound to the GitHub runner's private Tailscale IP. The workflow prints:

`TAILSCALE_VNC=<runner-tailnet-ip>:5900`

The user can connect from the Windows PC if a normal ChatGPT/Cloudflare human challenge needs manual completion.

## Why the home-exit design exists

The original GitHub-hosted Playwright implementation had previously worked repeatedly. Later GitHub/Azure browser egress began receiving Cloudflare `cf-mitigated: challenge` responses.

Routing browser-phase traffic through the user's normal network restored healthy ChatGPT backend access. Successful observe runs showed:

- `/backend-api/models` → HTTP 200
- `/backend-api/conversations?...` → HTTP 200
- `cf-mitigated` absent
- home exit-node egress verified different from GitHub runner egress

## Critical lesson from VERIFY4

A wake can be durably accepted by ChatGPT even if **post-send browser verification immediately triggers Cloudflare**.

VERIFY4 sequence:

1. Home exit routing activated.
2. Pre-send backend health was good: HTTP 200 / no Cloudflare challenge.
3. Exact wake text was present in composer.
4. Real POST containing VERIFY4 marker was observed to:
   `https://chatgpt.com/backend-api/f/conversation/prepare`
5. The user later confirmed the wake appeared and remained stored in this chat.
6. The verifier then reloaded/re-probed backend endpoints and received HTTP 403 + `cf-mitigated: challenge`.
7. The run was eventually cancelled.

Therefore:

**Do not require a post-send page reload + fresh backend health check as a prerequisite for declaring the actual send operation successful.** That verification path can create a false negative after a real durable send.

A better verifier should separate:

- SEND_ACCEPTED / WRITE_OBSERVED
- DURABILITY_CONFIRMED
- POST_SEND_BROWSER_HEALTH

Post-send browser health is useful telemetry but must not retroactively invalidate an already-persisted wake.

## Current main has additional hardening after VERIFY4

The current v10 script now includes:

- backend preflight health checking;
- exact marker tracking;
- real write-request observation;
- multiple send strategies;
- idle/busy detection;
- Tailscale exit-node switch timeouts;
- private VNC support;
- connector-trigger request file;
- encrypted session-state support.

These improvements are useful, but several later VERIFY5–VERIFY8 experiments failed for reasons that do **not** erase VERIFY4's success. See `FAILURE_TIMELINE_v1.md`.

## Triggering runs without user CLI

The workflow watches:

`process/browser-agent-home-exit-v10/current-request-v10.json`

A GitHub connector agent can update that file to launch the workflow. This was added specifically so the user does not need to run `gh workflow run` manually.

The workflow also retains `workflow_dispatch` for manual use.

## Successor priorities

1. Preserve the home-exit architecture and auth-key flow.
2. Preserve the exact working send mechanics that produced VERIFY4.
3. Refactor verification so post-send Cloudflare does not turn a real durable send into a false failure.
4. Avoid repeatedly waking this already-overlong test chat unless necessary.
5. Prefer a new test conversation for future verification if the current chat's generation state interferes with idle detection.
6. Keep only one live browser package version in the repo.
7. Do not bring Browserless/Browserbase back; they were never part of the working deployment.
8. Do not require the user's PC to run Playwright or a self-hosted GitHub runner.

## Files in this handoff

- `README_v1.md` — start here.
- `CURRENT_STATE_v1.md` — exact current files, settings, and known-good evidence.
- `FAILURE_TIMELINE_v1.md` — what failed and what each failure actually means.
- `SUCCESSOR_ACTIONS_v1.md` — concrete continuation instructions.
- `HANDOFF_STATE_v1.json` — machine-readable durable state.
- `SUCCESSOR_WAKE_MESSAGE_v1.md` — concise message for the next agent.
