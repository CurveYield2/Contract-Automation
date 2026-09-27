# Lite Automatic Advancement Protocol

## Rule

Human approval is not required after a completed Lite segment or milestone. Advance immediately when the active Phase Contract's criteria are satisfied and no explicit stop/rework instruction exists.

## Internal segment advancement

- Phase 0 is executed by `web-bootstrap-agent`. It must first complete the Phase-0 contract, freeze the pre-validation Web Bootstrap Completion Report, and create/validate the complete `P0_TO_P1` package including the standardized Phase-1 `WAKE_UP_MESSAGE.md`. Only then may it submit the completion companion, obtain machine-generated controller/Phase-Contract `PASS`, obtain retirement-gate `PASS`, enter `WAITING_FOR_SUCCESSOR_AGENT`, and retire. Fresh high-reasoning `reviewer-1` receives Phase 1. The concise Phase-0 completion report is a retirement-control artifact; the single P0_1 audit milestone report is still filed at Phase 1.
- Phase 2 → 3 → 4 → 5 remains in the same `reviewer-2` session.
- Phase 6 → Phase-7 completion marker remains in the same `reviewer-3L` session.
- Phase 8 → conditional Phase 9 → Phase 10 remains in the same `reviewer-4` session.

Internal advancement updates durable state but does not create a separate report, global checkpoint seal, handoff or repeated Source Intelligence verification.

## Milestone advancement

At the end of Phase 1, combined Phase 2–5, and merged Phase 6–7:

1. reconcile all due retained obligations and invalidation triggers;
2. seal the milestone artifacts and one Phase Report;
3. create/seal the exact successor handoff, including the standardized wake message;
4. satisfy the applicable controller retirement checks;
5. enter `WAITING_FOR_SUCCESSOR_AGENT`; and
6. stop the outgoing reviewer.

### Phase-0 retirement order

Phase 0 is intentionally ordered differently to avoid self-referential completion validation:

1. reconcile Phase-0 obligations/invalidation and finish every Phase-0 contract step;
2. freeze the pre-validation Web Bootstrap Completion Report;
3. create and validate `P0_TO_P1/SUCCESSOR_HANDOFF.json`, `START_HERE_SUCCESSOR.md`, and the standardized Phase-1 `WAKE_UP_MESSAGE.md`;
4. submit the bound `audit-phase-completion-report-v1` companion;
5. require generated `PHASE_COMPLETION_VALIDATION_v1.json` with `status: PASS`;
6. require the retirement gate to verify completion-validation PASS, automation-completion PASS, and handoff-validation PASS;
7. enter `WAITING_FOR_SUCCESSOR_AGENT`; and
8. stop the web-bootstrap agent.

At Phase 10, seal the combined Phase 8–10 evidence and enter a terminal Lite verdict.

## Conditional Phase 9

- remediation exists → execute Phase 9;
- no remediation exists → record `SKIPPED_NO_REMEDIATION` and advance directly to Phase 10.

## Rework

Return only the exact artifact, method or affected dependency that failed an objective acceptance condition. Do not reopen a completed segment for convenience.
