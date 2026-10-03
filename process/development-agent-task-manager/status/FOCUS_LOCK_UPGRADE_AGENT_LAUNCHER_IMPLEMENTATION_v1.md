# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

The Upgrade Agent Launcher must use one clean immutable ChatGPT login snapshot per browser run, interact with ChatGPT only through visible human UI, create one managed Project through the normal sidebar Projects control, create the task chat inside that Project, complete the focus-locked task, merge the verified implementation to target main, and expose output + Project links.

## CURRENT STATE

- Repository: `CurveYield2/Contract-Automation`
- Repair branch: `browser-project-sidebar-scroll-v1`
- Fresh bootstrap-secret-only state is merged and verified to load cleanly without Cloudflare.
- First Project-wake run `37152260428` reached ChatGPT successfully, used the immutable secret, and failed only because the sidebar helper assumed a missing Projects title meant the sidebar was closed.
- Current repair distinguishes an already-open sidebar from a closed one.
- If Projects is below the fold, the browser now moves into the visible left sidebar and human-scrolls:
  - randomized upward wheel motion first;
  - then randomized downward wheel motion;
  - 0.3–1.5 second human pauses between scroll actions.
- Once Projects appears, the exact sequence remains: hover Projects -> click revealed plus -> type name 0.2–0.4s per character -> click Create Project.
- Same Project-wake request is re-armed for a fresh merged-code retry.

## SATISFIED

- Human-only ChatGPT send verification remains enforced.
- No direct ChatGPT backend/API verification reads exist in v10/shared wake runtimes.
- No request/response telemetry is used as delivery proof.
- No rolling automated browser state can contaminate later runs.
- Fresh secret state is the single browser authentication baseline.
- Exact Project creation sequence is implemented without generic fallback.
- Randomized human pacing ranges are encoded and regression guarded.
- Post-Send verification failures remain non-retryable.
- Tailscale home-exit routing remains unchanged.

## REMAINING DELTA

1. Pass both repository validation lanes for this sidebar-scroll repair.
2. Merge this repair to `main`.
3. Run the re-armed fresh-secret `project_wake`.
4. Verify the browser finds Projects via normal sidebar opening/scrolling, creates `HOME_EXIT_PROJECT_WAKE_VERIFY1`, and sends the wake inside that Project.
5. Observe whether Cloudflare appears; if it does, abort immediately.
6. If Project wake succeeds, resume the upgrade-manager smoke on the verified Project path.

## ACTIVE BLOCKER

No code blocker proven. The previous failure was narrow: Projects was not visible and no explicit sidebar-open button existed, so the routine failed instead of treating the sidebar as already open and scrolling it.

## NEXT ACTION

Run repository validation on this exact branch. Do not alter scope unless a validation failure or the merged live Project test proves a specific blocker.

## PARKED OBSERVATIONS

- Previous rolling session state is intentionally abandoned.
- Previous no-resend search recovery experiment is superseded for this test.
- Audit execution browser pathways remain out of scope.
- General repository cleanup remains out of scope.

## ANTI-DRIFT CHECK

Before each meaningful action: which REMAINING DELTA item does this eliminate or verify? If none, do not perform it.
