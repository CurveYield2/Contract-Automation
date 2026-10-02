# Successor Actions v1

## Immediate continuation

1. Read `README_v1.md` and `FAILURE_TIMELINE_v1.md` before modifying code.
2. Treat VERIFY4 as the known human-confirmed working delivery.
3. Inspect current v10 code before changing anything; it contains later hardening beyond VERIFY4.
4. Do not trigger a new wake merely to prove that a wake can happen. That is already proven.

## Recommended technical repair

Refactor `postWithBackendVerification()` so the send result and post-send browser-health result are separate.

Suggested behavior:

1. Require a marker-bearing POST/PUT/PATCH from the actual composer.
2. Capture its response.
3. If the write response is 2xx, mark `writeAccepted=true`.
4. Check the current DOM for the exact wake as a user message without forcing an immediate reload.
5. If visible, mark `domPersisted=true`.
6. Optionally perform a delayed non-destructive durability check.
7. If post-send backend probes become Cloudflare-challenged, record `postSendChallenge=true` but do not automatically erase `writeAccepted` or `domPersisted`.
8. A page reload should not be mandatory for success because VERIFY4 proves that reload/re-probe can trigger a false-negative challenge after a real durable send.

## Chat-busy behavior

The current chat is extremely long and can remain generating for minutes.

Current code includes `waitForChatIdle()`.

Prefer future functional testing against a new dedicated test chat rather than repeatedly waking the nearly exhausted conversation used in this campaign.

If testing this chat is unavoidable:

- wait for idle before filling/sending;
- do not trigger overlapping runs;
- preserve `concurrency.cancel-in-progress: true`.

## Cloudflare manual path

If a write returns 403 with `cf-mitigated: challenge`:

1. Keep `interactive_view=true`.
2. Capture the printed `TAILSCALE_VNC=<runner-ip>:5900`.
3. Have the user connect from the Windows PC with a VNC viewer.
4. Let the user complete normal human verification in the live Chrome window.
5. Then retry the write in the same browser session if possible.

Avoid asking the user to operate GitHub CLI. The request-file trigger exists so the agent can launch runs itself.

## Do not regress these decisions

- GitHub-hosted Playwright remains the executor.
- User's PC is only a Tailscale exit node.
- Use auth-key flow because user explicitly requested it.
- No Browserless.
- No Browserbase.
- No local/self-hosted GitHub runner.
- No OpenSSH/SOCKS requirement.
- Keep one live browser package version only.
- Never claim success from a local UI bubble alone.
- Never claim success from prepare HTTP 200 alone unless durable user-message evidence also exists.

## Repo-cleanliness note

Separately from browser work, the user asked for Contract-Automation cleanup.

Completed during this conversation:

- removed stray root Medusa progress files;
- consolidated them into the isolated simulation harness as `PHASE0_MEDUSA_PROGRESS_UPDATE_v3.md`;
- removed obsolete browser package versions.

Root `package.json` / `package-lock.json` were deliberately **not** moved because current V7 qualification/regression workflows still depend on root-relative npm behavior. A deeper repo-structure branch/workflow existed for that migration and should be handled as a separate controlled refactor, not mixed into browser recovery.
