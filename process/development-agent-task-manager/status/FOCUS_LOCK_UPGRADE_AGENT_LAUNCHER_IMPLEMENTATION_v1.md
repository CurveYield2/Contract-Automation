# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

The Upgrade Agent Launcher must use one clean immutable ChatGPT login snapshot per browser run, interact with ChatGPT only through visible human UI, create one managed Project through the normal sidebar Projects control, create the task chat inside that Project, complete the focus-locked task, merge the verified implementation to target main, and expose output + Project links.

## CURRENT STATE

- Repository: `CurveYield2/Contract-Automation`
- Repair branch: `browser-project-name-field-v1`
- Fresh bootstrap-secret-only state remains the only browser session source.
- Project-wake run `37152694131` successfully reached ChatGPT, found Projects through human sidebar scrolling, hovered Projects, and clicked the revealed plus.
- Current failure is narrow: the current Project popup does not expose its textbox under a `role="dialog"` ancestor.
- Current repair anchors the popup to the visible `Create Project` control, walks its visible ancestor region, and selects the visible textbox there while excluding the main message composer.
- No backend/network reads were added.
- Exact human pacing remains 0.3–1.5 seconds between actions and 0.2–0.4 seconds per typed character.
- Same Project-wake request is re-armed.

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

No transport, session, sidebar, or Cloudflare blocker is currently proven. The only proven blocker is visible Project-name textbox discovery in the current popup markup.

## NEXT ACTION

Pass validation, merge this popup locator repair, and rerun the same fresh-secret Project wake. Do not change any other browser behavior unless the merged run proves a new specific blocker.



Run repository validation on this exact branch. Do not alter scope unless a validation failure or the merged live Project test proves a specific blocker.

## PARKED OBSERVATIONS

- Previous rolling session state is intentionally abandoned.
- Previous no-resend search recovery experiment is superseded for this test.
- Audit execution browser pathways remain out of scope.
- General repository cleanup remains out of scope.

## ANTI-DRIFT CHECK

Before each meaningful action: which REMAINING DELTA item does this eliminate or verify? If none, do not perform it.
