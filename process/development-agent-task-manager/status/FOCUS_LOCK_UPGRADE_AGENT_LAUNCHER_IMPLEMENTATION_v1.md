# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

The Upgrade Agent Launcher must admit a development task into the existing Development Agent Task Manager, create and preserve one ChatGPT Project for managed continuity, keep all ChatGPT interaction human-visible, complete the focus-locked task, verify it, merge it into the target repository main branch, and expose the output + ChatGPT Project links.

## CURRENT STATE

- Repository: `CurveYield2/Contract-Automation`
- Repair branch: `browser-challenge-fast-fail-durable-route-v1`
- Launcher implementation is merged.
- Shared browser visible-only verification is merged.
- VERIFY4 proved human-style create-fresh send succeeds and the wake becomes visibly rendered.
- VERIFY4 also proved reloading an optimistic `local-chatgpt:` route can trigger a Cloudflare challenge.
- Current repair waits for a durable server `/c/<id>` route before reload.
- Visible Cloudflare/human-verification challenge now aborts immediately and is non-retryable.
- Ordinary visible-browser readiness timeout is 5 minutes.
- Project-operation Cloudflare challenge is non-retryable.
- No audit wake/monitor/orchestration workflow is being modified.

## SATISFIED

- Human-only ChatGPT input and verification guards are present.
- No direct ChatGPT backend/API verification reads are used by v10 or shared wake runtime.
- No request/response network telemetry is used as delivery proof.
- No synthetic DOM/form/force write fallback is used.
- Post-Send verification failures are non-retryable to prevent duplicate sends.
- Project sidebar discovery is repaired.
- Tailscale home-exit routing has been proven functional in finalized runs.
- Fresh chat can be created and the wake can be visibly rendered.

## REMAINING DELTA

1. Pass both repository validation lanes for the fast-fail + durable-route repair.
2. Merge this repair to `main`.
3. Run the dedicated v10 create-fresh test on merged code and verify:
   - challenge aborts immediately if it appears;
   - otherwise the optimistic route transitions to a durable `/c/<id>` before reload;
   - the visible wake survives the normal human-style reload.
4. If v10 succeeds, rerun `upgrade-launcher-live-smoke-r1` on the merged shared runtime.
5. Verify managed Project persistence, focus-locked agent completion, mandatory merge-to-main finalization, and terminal output + Project links.

## ACTIVE BLOCKER

None proven in code. The repair requires CI and live verification.

## NEXT ACTION

Run repository validation on this exact branch. Do not change scope unless a failing check proves a specific blocker.

## PARKED OBSERVATIONS

- General dashboards and repository cleanup are out of scope.
- Audit execution process redesign is out of scope.
- GitHub live step-status lag is not evidence of a routing failure by itself.

## ANTI-DRIFT CHECK

Before each meaningful action: which REMAINING DELTA item does this eliminate or verify? If none, do not perform it.
