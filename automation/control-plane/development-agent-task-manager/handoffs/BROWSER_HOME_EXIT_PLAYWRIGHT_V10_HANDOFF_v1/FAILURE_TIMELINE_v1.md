# Failure Timeline v1

This file exists to prevent successor agents from repeating the same false diagnoses.

## Historical dead ends before v10

### Browserless / Browserbase

The old browser source contained fallback-provider code, but those providers were never installed/configured as part of the working system.

Do not treat them as the original working architecture.

### Self-hosted GitHub runner / local Chrome

A temporary v6 idea moved Chrome onto the user's PC. The user rejected this because it would be inconvenient.

That path was deleted.

The required architecture is GitHub-hosted Playwright with only network egress routed through the user's PC.

### SSH/SOCKS home proxy

A temporary v7 design used OpenSSH + SOCKS. Windows OpenSSH installation was cumbersome and unnecessary.

That path was replaced by direct Tailscale exit-node routing and deleted.

## v10 run history

### 36938964767 — failure

Root cause: workflow referenced stale filename `browser-agent-wake-v8.mjs` inside the v10 folder.

Fixed.

### 36939405263 — success

Observe/authentication infrastructure run succeeded.

Proved home-exit route and backend health.

### 36939586494 — green but not durable proof

Transport returned HTTP 200 and workflow marked posted, but user did not see the wake.

This exposed a false-positive verifier.

Lesson: HTTP 200 from a prepare endpoint alone is not durable-delivery proof.

### 36941257082 — failure

Stricter verifier required a real conversation write; no real POST was observed.

This correctly rejected the previous false-positive behavior.

### 36941704919 — cancelled / VERIFY3

A real POST containing VERIFY3 was observed to `/backend-api/f/conversation/prepare`.

Immediately after send, Cloudflare challenges appeared during the post-send verification path.

The run was later cancelled by concurrency/new work.

### 36942207641 — cancelled / VERIFY4 — **HUMAN-CONFIRMED SUCCESS**

Request commit:
`49a31f8ab51e0de4480a2d3e2ab20e4180b1d27d`

Run log showed:

- home exit active;
- pre-send backend health 200;
- exact VERIFY4 composer content;
- real POST containing marker to `/backend-api/f/conversation/prepare`.

The user then confirmed the VERIFY4 wake was visible and durably stored in this exact ChatGPT conversation.

After send, backend re-probes returned 403 `cf-mitigated: challenge` and the run eventually became cancelled.

**This is the key proof that post-send challenge does not mean the wake failed.**

### 36942638429 — VERIFY5 failure

Part of continued verifier hardening. Do not use as evidence that home-exit delivery stopped working.

### 36943082698 — VERIFY6 failure

Preflight healthy; composer/send mechanics were being hardened. Failure occurred during continued send/verification experimentation.

### 36943370247 — VERIFY7 failure

The page was actively generating (Stop button visible). Multiple send strategies did not emit a real marker-bearing write.

This motivated explicit idle waiting.

### 36943660174 — VERIFY8 failure

Current script waited about 179 seconds until the chat became idle.

Then it observed a real POST containing VERIFY8 to:
`https://chatgpt.com/backend-api/f/conversation`

The corresponding prepare response returned:

- HTTP 403
- `cf-mitigated: challenge`

This shows Cloudflare can still challenge a write even when the preflight was healthy. It does not invalidate VERIFY4.

## Main remaining reliability problem

Cloudflare behavior can change between:

1. healthy preflight, and
2. actual message submission.

The user's home egress greatly improved the situation and enabled at least one confirmed durable wake, but it does not guarantee every write will avoid a challenge.

Manual VNC exists specifically for normal human verification when needed.

## Important verifier design rule

Do not let post-send verification cause destructive false negatives.

Recommended state model:

- `PRE_SEND_HEALTHY`
- `WRITE_REQUEST_OBSERVED`
- `WRITE_RESPONSE_ACCEPTED`
- `DURABILITY_OBSERVED_IN_DOM`
- `POST_SEND_HEALTH_DEGRADED` (telemetry only)
- `HUMAN_CONFIRMED`

A later Cloudflare challenge should be represented separately, not overwrite a successful send.
