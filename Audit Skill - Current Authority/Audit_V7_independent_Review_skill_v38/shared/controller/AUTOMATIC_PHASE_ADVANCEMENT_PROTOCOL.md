# Automatic Phase Advancement Protocol v1

## Rule

Audit V7 v29 has **no per-phase human approval gate**. A phase advances when its machine/durable seal criteria pass. Filing an end-of-phase report is mandatory transparency, not a request for permission.

## Canonical transition

```text
READY
→ ACTIVE / required preflight
→ EVIDENCE_SEALED
→ PHASE_REPORT_SUBMITTED
→ AUTO_ADVANCE_READY
→ next authorized state
```

`AUTO_ADVANCE_READY` requires all mandatory current Phase Contract work, structured filing, source/evidence identity, domain obligations, due `OBL-*` reconciliation, Evidence Invalidation Matrix reconciliation, and report filing to be terminal. A process `FAIL`/typed limitation is not converted to success by automatic advancement; progression is allowed only where the active policy explicitly permits that terminal disposition.

## Same-reviewer transition

When the next phase uses the same reviewer lineage, transition immediately to that phase's `READY`/preflight state and continue executing. Do not stop after the report.

Current same-reviewer flows include Phase 0→1→2→3→4→5, Phase 7→8, and Phase 9→10.

## Fresh-reviewer transition

At a planned fresh-reviewer boundary, no human approval is required. After report/subphase-report seal:

1. create the exact successor handoff/start packet;
2. seal immutable handoff content;
3. generate/file `WAKE_UP_MESSAGE.md`;
4. update controller state to `WAITING_FOR_SUCCESSOR_AGENT`;
5. send the normal end-of-phase/subphase report plus the exact filed wake-up message in the required standalone copy block;
6. stop because the fresh successor must receive the handoff.

Planned fresh boundaries are:

```text
Phase 5 -> Phase 6A
Phase 6A -> Phase 6B
Phase 6B -> Phase 6C
Phase 6C -> Phase 7
Phase 8 -> Phase 9
```

## Human instructions remain authoritative but are not gates

The human may explicitly instruct `STOP_AUDIT` or request specific rework at any time. Such an explicit instruction is a new controller input and must be durably recorded. **Silence, lack of `CONTINUE`, or absence of a human response is never a blocker.**

A human instruction cannot erase evidence, rewrite source identity, convert missing mandatory work to complete, or authorize stale evidence.

## Migration from v28 `WAITING_FOR_HUMAN_RESPONSE`

When adopting v29 for a campaign currently parked at `WAITING_FOR_HUMAN_RESPONSE`:

- if the underlying phase evidence/report is validly sealed and there is no already-recorded explicit `STOP_AUDIT` or rework instruction, translate state to `AUTO_ADVANCE_READY` and continue immediately;
- if it is a fresh-reviewer boundary, create the successor package immediately;
- if a durable explicit stop/rework instruction predates v29 adoption, honor it;
- do not ask the human to send `CONTINUE` merely to migrate state.

## Phase 10

After Phase-10 report filing and successful completeness checks, create the immutable terminal closure manifest automatically and set campaign status `COMPLETE`. No human response digest is required.
