# Phase Status and Security Verdict Policy v1

## Normative separation

Deep Assurance v6 separates **audit-process execution status** from **target security severity**. Finding a defect is successful audit work and must never be serialized as process `FAIL`.

## Phase status vocabulary

Every mandatory phase gate uses exactly one of:

- `PENDING` — required phase work has not yet reached a durable conclusion.
- `PASS` — phase completed successfully and produced no reportable target issue owned by that phase.
- `INFORMATIONAL_ISSUE_FOUND` — phase completed successfully; highest validated issue owned by that phase is Informational.
- `LOW_ISSUE_FOUND` — phase completed successfully; highest validated issue owned by that phase is Low.
- `MEDIUM_ISSUE_FOUND` — phase completed successfully; highest validated issue owned by that phase is Medium.
- `HIGH_ISSUE_FOUND` — phase completed successfully; highest validated issue owned by that phase is High.
- `CRITICAL_ISSUE_FOUND` — phase completed successfully; highest validated issue owned by that phase is Critical.
- `FAIL` — the audit process itself failed to complete the phase correctly because required execution, evidence, state, or mandatory process obligations could not be produced or validated.

The `*_ISSUE_FOUND` states are successful terminal phase states. `FAIL` is not a finding severity.

A target that does not compile, has non-green tests, violates an invariant, or reproduces an exploit does **not** make the audit process fail when the audit successfully detects, validates, and records that target problem. The phase reports the highest validated issue severity instead.

## Highest-severity rule

When a phase owns multiple validated target issues, record exactly the highest severity present. Severity order is:

`CRITICAL > HIGH > MEDIUM > LOW > INFORMATIONAL > PASS`.

Phase 8 records the highest severity among validated findings established by findings validation. Phase 9 records the highest **unresolved** validated severity remaining after remediation review and is the canonical residual-risk gate.

## Security verdict

The final security verdict is independent of process health:

- `securityVerdict: NO_GO` only when one or more validated `HIGH` or `CRITICAL` findings remain `UNRESOLVED` after remediation review.
- Deployment scripts, deployment manifests, environment configuration, and release automation defects do not independently create a security `NO_GO` verdict. These issues must only affect `securityVerdict` when they produce a validated security finding that reaches `HIGH` or `CRITICAL` severity under `SEVERITY_CALIBRATION.md`.
- `securityVerdict: PASS` when no unresolved High or Critical finding remains, including when unresolved Medium, Low, or Informational findings remain.

Medium, Low, and Informational findings remain fully disclosed. They do not require risk acceptance to obtain `PASS`.

`RESOLVED`, `RISK_ACCEPTED`, and `NOT_AN_ISSUE` findings do not create `NO_GO` regardless of historical severity.

## Audit-continuity rule

An error, failed worker, failed quiz, broken poll, recoverable evidence operation, rejected submission, or even a phase-local process `FAIL` **does not stop work that remains independently eligible to continue**. The Orchestrator immediately repairs, reissues, reworks, reassigns, or replaces the affected work while advancing every unaffected assignment that is still permitted by the canonical dependency graph.

A process `FAIL` may prevent final completion if it remains unrepaired, but it is never a command to abandon the rest of the audit. Continue collecting every security-relevant result that can still be obtained. This preserves maximum vulnerability discovery and produces the most complete failure record possible even when final assurance cannot yet be certified.

## Process failure

Any mandatory phase with `FAIL` means the audit process itself did not complete correctly. A process `FAIL`:

1. does not become `NO_GO`;
2. does not permit a final `COMPLETE` audit report;
3. blocks publication, Phase 10 completion, user delivery of a final audit verdict, and terminal campaign evaluation until repaired; and
4. must preserve failure evidence and trigger the authorized repair/replacement path.

If the process failure is genuinely irrecoverable, publish a **process-failure notice/record**, not a final security audit report. Do not fabricate a security verdict from missing audit work.

## Final report serialization

Final `phaseResults[].status` accepts only successful terminal phase states: `PASS` or one of the five `*_ISSUE_FOUND` states. `PENDING` and `FAIL` are forbidden in a final `COMPLETE` report.

The final report remains `completionStatus: COMPLETE` with `securityVerdict: PASS|NO_GO` only after all mandatory process work has completed successfully.
