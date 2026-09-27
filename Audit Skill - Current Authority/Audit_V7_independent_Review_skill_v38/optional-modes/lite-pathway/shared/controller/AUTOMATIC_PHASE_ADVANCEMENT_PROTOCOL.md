# Lite Automatic Advancement Protocol

## Rule

Human approval is not required after a completed Lite segment or milestone. Advance immediately when the active Phase Contract's criteria are satisfied and no explicit stop/rework instruction exists.

## Internal segment advancement

- Phase 0 is executed by `web-bootstrap-agent`. It must obtain controller/Phase-Contract completion `PASS`, seal `P0_TO_P1`, enter `WAITING_FOR_SUCCESSOR_AGENT`, and retire. Fresh high-reasoning `reviewer-1` receives Phase 1. The concise Phase-0 completion report is a retirement-control artifact; the single P0_1 audit milestone report is still filed at Phase 1.
- Phase 2 → 3 → 4 → 5 remains in the same `reviewer-2` session.
- Phase 6 → Phase-7 completion marker remains in the same `reviewer-3L` session.
- Phase 8 → conditional Phase 9 → Phase 10 remains in the same `reviewer-4` session.

Internal advancement updates durable state but does not create a separate report, global checkpoint seal, handoff or repeated Source Intelligence verification.

## Milestone advancement

At the end of Phase 0, Phase 1, combined Phase 2–5, and merged Phase 6–7:

1. reconcile all due retained obligations and invalidation triggers;
2. seal the milestone artifacts and one Phase Report;
3. create/seal the exact successor handoff;
4. enter `WAITING_FOR_SUCCESSOR_AGENT`; and
5. stop the outgoing reviewer.

At Phase 10, seal the combined Phase 8–10 evidence and enter a terminal Lite verdict.

## Conditional Phase 9

- remediation exists → execute Phase 9;
- no remediation exists → record `SKIPPED_NO_REMEDIATION` and advance directly to Phase 10.

## Rework

Return only the exact artifact, method or affected dependency that failed an objective acceptance condition. Do not reopen a completed segment for convenience.
