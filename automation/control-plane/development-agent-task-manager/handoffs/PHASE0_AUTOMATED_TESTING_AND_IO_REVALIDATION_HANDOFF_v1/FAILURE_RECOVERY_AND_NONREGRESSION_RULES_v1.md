# Failure Recovery and Non-Regression Rules v1

## Repository/tool access

Use the GitHub connector app.

Do not replace GitHub operations with:

- browser scraping;
- direct raw URL shell access;
- curl/wget;
- local clone assumptions.

If the connector fails, use the live authority Recovery Router.

## Local-environment restriction

Do not compile or download dependencies in the assistant's local environment.

Compilation/dependency installation is allowed in the GitHub execution environment/workflows.

Repository inspection and file editing should remain connector-based.

## Streaming/poll expiry recovery

The prior chat experienced repeated “poll task streaming expired” failures.

Recovery:

1. do not assume work was lost;
2. read the exact GitHub branch/PR/commit/run state;
3. resume from the last durable commit;
4. use bounded workflow-run/job/log reads;
5. avoid one long blocking streaming poll;
6. never restart completed patches merely because the chat tool expired.

## CI failure handling

When CI fails:

\`DIAGNOSE → REPAIR → RETRY → VERIFY → CONTINUE\`

Do not weaken a valid test merely to make CI green.

Classify failures:

- implementation defect;
- authority/schema mismatch;
- stale test asserting intentionally removed behavior;
- environmental/transient failure;
- unrelated existing failure.

If a test asserts old behavior that the approved design intentionally removed, update the test and add an assertion for the new invariant.

## Existing-process-first rule

Before adding infrastructure, search for the admitted existing path.

Especially do not duplicate:

- V7 runner;
- evidence ingestor;
- observer;
- Phase-0 source initialization;
- campaign controller;
- packet/report renderer;
- Source Intelligence generator;
- deploy/config runner;
- watchdog/orchestrator.

## Phase-boundary rules to preserve

- Phase 0: machine-only.
- Phase 5: reviewer designs targeted tests; machines execute at boundary.
- Phase 6: reviewer interprets machine evidence.
- Phase 7: automation-only marker.
- Phase 9: remediation reruns are reviewer-controlled sub-phases.
- All other machine-able work should occur at a phase boundary, not interrupt semantic reviewer work.

## Controller-owned data integrity

Any controller-prefilled or controller-collected value that influences validation or downstream routing must be protected by controller-owned assignment state, not only by a digest stored inside a reviewer-editable form.

When automation adds new read-only fields after initial form creation:

- mark them controller-owned;
- refresh the controller prefill digest;
- update the controller-owned assignment digest;
- revalidate.

## One canonical home

Do not reintroduce duplicate bookkeeping.

Examples:

- domain classification belongs in the controller domain registry;
- formal obligation status belongs in the carried-forward obligation ledger;
- raw Phase-0 testing belongs in Phase-0 testing artifacts;
- final evidence index may aggregate final conclusions by design, but is not an independent source of truth.

## Versioning

Every intentionally versioned new artifact starts at v1.

When editing a delivered handoff/document artifact and returning a new version, increment the whole-number version.

Do not rename live authority references throughout the repo every time the skill package changes; prefer the stable authority folder where the process supports it.
