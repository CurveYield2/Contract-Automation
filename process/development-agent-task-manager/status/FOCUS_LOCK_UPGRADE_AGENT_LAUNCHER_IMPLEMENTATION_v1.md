# Focus Lock — Upgrade Agent Launcher Implementation v1

## END-STATE INVARIANT

The Upgrade Agent Launcher must use one clean immutable ChatGPT login snapshot per browser run, interact with ChatGPT only through visible human UI, create one managed Project through the normal sidebar Projects control, create the task chat inside that Project, complete the focus-locked task, merge the verified implementation to target main, and expose output + Project links.

## CURRENT STATE

- Repository: `CurveYield2/Contract-Automation`
- Repair branch: `browser-bootstrap-secret-only-v1`
- Rolling encrypted ChatGPT session-state load/save has been removed from:
  - dedicated v10 browser workflow/runtime;
  - Development Agent Task Manager start and supervise browser paths.
- Every run now starts exclusively from `CHATGPT_STORAGE_STATE_B64` and discards run state.
- Visible browser pacing now uses randomized 0.3–1.5 second pauses between normal browser actions.
- Typing now uses randomized 0.2–0.4 second pauses between each character.
- Project creation is visible-UI-only and follows the operator-defined sequence:
  1. open sidebar if closed;
  2. find visible Projects section;
  3. hover Projects title;
  4. click the plus revealed to its right;
  5. type the Project name one character at a time;
  6. click visible Create Project button.
- Project creation no longer watches `/backend-api/projects`, response events, or any other backend/network signal.
- Dedicated v10 request is armed as `project_wake` with Project `HOME_EXIT_PROJECT_WAKE_VERIFY1`.
- Cloudflare challenge remains immediate terminal/non-retryable.
- Ordinary readiness timeout remains 5 minutes.
- No audit wake/monitor/orchestration workflow was modified.

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

1. Pass both repository validation lanes for this branch.
2. Merge this repair to `main`.
3. Let the armed merged-code `project_wake` test run from the untouched bootstrap secret.
4. Verify visible Project creation succeeds using the exact sidebar sequence.
5. Verify the new wake is visibly sent inside that Project.
6. Observe whether Cloudflare appears; if it does, workflow must abort immediately.
7. If Project wake succeeds, apply the verified Project path to the upgrade-manager smoke and complete managed Project continuity through terminal merge/output links.

## ACTIVE BLOCKER

None proven in code. Validation and live Project-wake verification remain.

## NEXT ACTION

Run repository validation on this exact branch. Do not alter scope unless a validation failure or the merged live Project test proves a specific blocker.

## PARKED OBSERVATIONS

- Previous rolling session state is intentionally abandoned.
- Previous no-resend search recovery experiment is superseded for this test.
- Audit execution browser pathways remain out of scope.
- General repository cleanup remains out of scope.

## ANTI-DRIFT CHECK

Before each meaningful action: which REMAINING DELTA item does this eliminate or verify? If none, do not perform it.
