# Current State v1

## Canonical live files

Workflow:
`.github/workflows/browser-agent-home-exit-v10.yml`

Browser implementation:
`packages/browser-agent-original-phase0-v10/browser-agent-wake-v10.mjs`

Session-state helper:
`packages/browser-agent-original-phase0-v10/browser-session-state-v1.mjs`

Runtime:
`packages/browser-agent-original-phase0-v10/runtime-v10/`

Current request trigger:
`process/browser-agent-home-exit-v10/current-request-v10.json`

## Current request file

At handoff creation, the request file is armed with VERIFY8, not VERIFY4:

- action: `wake`
- mode: `resume_existing`
- target chat: `https://chatgpt.com/c/6abe90a0-fd68-83e8-8026-8af0171605fc`
- marker: `HOME_EXIT_PLAYWRIGHT_WAKE_v10_VERIFY8`
- home exit node: `100.112.238.56`
- interactive view: true

Do not treat that request payload as the known-good baseline. It is merely the most recent test input.

## Definitive human-confirmed baseline

VERIFY4 request commit:
`49a31f8ab51e0de4480a2d3e2ab20e4180b1d27d`

VERIFY4 run:
`36942207641`

Observed in run log before post-send challenge:

- `HOME_EXIT_EGRESS_ACTIVE=true`
- backend preflight healthy
- composer contained exact VERIFY4 wake
- real POST observed to `/backend-api/f/conversation/prepare`
- body contained the wake marker

Human confirmation:

The user saw the exact VERIFY4 wake arrive in the target ChatGPT conversation and confirmed it remained correctly stored.

## Earlier infrastructure successes

Observe run:
`36939405263`

This proved the home-exit path could:

- join Tailscale;
- activate user's exit-node egress;
- reach ChatGPT backend without a Cloudflare challenge;
- run Playwright successfully.

Earlier wake run:
`36939586494`

This run returned HTTP 200 from `conversation/prepare`, but its verifier was later judged too weak because the message was not visibly present in the current chat. Treat it as transport evidence only, not definitive durable-delivery evidence.

## Current workflow characteristics

- `concurrency.cancel-in-progress: true`
- push trigger watches only the v10 current-request JSON
- workflow_dispatch is still available
- home exit selection is hard-bounded with shell `timeout`
- direct-vs-home egress is compared via hashed public IP, without printing either IP
- VNC binds to runner's Tailscale IP
- exit node is disabled in an `always()` cleanup step
- Chrome is launched with `--disable-quic`
- only GitHub Playwright provider remains

## Required secrets

- `TAILSCALE_AUTHKEY` — confirmed usable; Tailscale action emits only a deprecation warning.
- `CHATGPT_STORAGE_STATE_B64` — confirmed usable bootstrap session.
- `CHATGPT_SESSION_STATE_KEY_B64` — optional; may be blank. The helper derives a key from bootstrap state when needed.

Do not ask the user to paste any secret into chat.

## Tailscale notes

The auth-key input is deprecated by Tailscale in favor of OAuth, but the user explicitly requested the auth-key version and it works.

Do not migrate back to OAuth unless the user asks.

The user's Windows PC must remain awake and online in Tailscale when a browser run uses it as the exit node.
