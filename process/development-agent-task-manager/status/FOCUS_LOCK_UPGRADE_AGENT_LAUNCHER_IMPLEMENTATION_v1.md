# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

The Upgrade Agent Launcher must admit a development task into the existing Development Agent Task Manager, create and preserve one ChatGPT Project for managed continuity, keep all ChatGPT interaction human-visible, complete the focus-locked task, verify it, merge it into the target repository main branch, and expose the output + ChatGPT Project links.

## CURRENT STATE

- Repository: `CurveYield2/Contract-Automation`
- Fast-fail/durable-route repair merged by PR #503 at `70110bed210c7780b555f359f567dbb99d8f4d2a`.
- Merged-code v10 run `37149537619` exercised the new behavior.
- Tailscale/home-exit routing succeeded.
- ChatGPT loaded normally and the wake was entered/sent through visible human-style controls.
- The wake became visibly rendered on an optimistic `local-chatgpt:` route.
- 157 ms later the visible page entered a Cloudflare/human-verification challenge.
- The browser aborted immediately, as required. It did not reload, did not wait for challenge clearance, and did not retry.
- Ordinary non-challenge readiness timeout is 5 minutes.
- A `local-chatgpt:` route is never reloaded; the verifier waits for a real durable `/c/<id>` first.

## SATISFIED

- Human-only ChatGPT input and verification guards are merged.
- No direct ChatGPT backend/API verification reads are used by v10 or the shared wake runtime.
- No request/response network telemetry is used as delivery proof.
- No synthetic DOM/form/force write fallback is used.
- Browser challenge is terminal/non-retryable in v10, shared runtime, and Project operations.
- Challenge causes immediate workflow failure instead of any timeout wait.
- Ordinary readiness timeout is 5 minutes.
- Optimistic local chat routes are not persistence-reloaded.
- Project sidebar discovery is repaired.
- Tailscale home-exit routing is verified functional.
- Fresh chat send reaches visible rendered-message state.

## REMAINING DELTA

1. Add a read-only recovery mode to the existing v10 browser workflow using only visible human UI: Filter chats and work -> type the unique wake marker -> open the matching saved chat -> verify the exact message is visible -> capture the durable chat URL.
2. Run recovery for the challenged merged VERIFY4 send without resending.
3. If recovery succeeds, apply the same no-resend recovery primitive to the shared Development Agent Task Manager challenge-after-send path.
4. Rerun `upgrade-launcher-live-smoke-r1`.
5. Verify managed Project persistence, focus-locked completion, mandatory merge-to-main, and terminal output + Project links.

## ACTIVE BLOCKER

Create-fresh sends can become visibly rendered and then immediately trigger Cloudflare before the temporary `local-chatgpt:` route transitions to a durable URL. The original human-confirmed VERIFY4 proves this post-Send challenge does not necessarily mean the send failed.

## NEXT ACTION

Implement and test visible-UI-only recovery in the existing v10 workflow. Do not resend the wake and do not use backend/API/network reads.

## PARKED OBSERVATIONS

- General dashboards and repository cleanup are out of scope.
- Audit execution process redesign is out of scope.
- GitHub live step-status lag is not evidence of routing failure by itself.

## ANTI-DRIFT CHECK

Before each meaningful action: which REMAINING DELTA item does this eliminate or verify? If none, do not perform it.
