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

1. Compare merged run `37149537619` against the last human-confirmed successful v10 run `36942207641` and identify the smallest behavioral/environmental difference before the first Cloudflare challenge.
2. Repair only that proven difference if it is in repository-controlled behavior.
3. Re-run dedicated v10 create-fresh verification.
4. Only after v10 succeeds, rerun `upgrade-launcher-live-smoke-r1`.
5. Verify managed Project persistence, focus-locked completion, mandatory merge-to-main, and terminal output + Project links.

## ACTIVE BLOCKER

Cloudflare challenge appears immediately after the visible fresh-chat send becomes rendered, before the optimistic chat route transitions to a durable server-backed URL.

## NEXT ACTION

Compare the exact successful and failing v10 logs around browser startup, session source, send strategy, post-Send route transition, and first challenge detection. Do not change code until that comparison proves a specific delta.

## PARKED OBSERVATIONS

- General dashboards and repository cleanup are out of scope.
- Audit execution process redesign is out of scope.
- GitHub live step-status lag is not evidence of routing failure by itself.

## ANTI-DRIFT CHECK

Before each meaningful action: which REMAINING DELTA item does this eliminate or verify? If none, do not perform it.
