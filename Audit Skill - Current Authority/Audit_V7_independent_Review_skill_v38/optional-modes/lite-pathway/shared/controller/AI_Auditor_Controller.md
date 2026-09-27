# Lite Audit Controller

This controller is authoritative only for an explicitly activated audit under the isolated Lite pathway. It must never modify, reinterpret or replace the standard Full controller.

## Topology

Exactly one worker is active at a time:

| Worker | Scope | Model / reasoning | Boundary after completion |
|---|---|---|---|
| `web-bootstrap-agent` | Phase 0 mechanical/bootstrap only | ChatGPT web chat + GitHub connector | `P0_TO_P1` |
| `reviewer-1` | Phase 1 semantic/risk analysis | `gpt-5.6-terra`, `high` | `P1_TO_P2` |
| `reviewer-2` | Combined Phases 2–5 | `gpt-5.6-sol`, `high` | `P5_TO_P6` |
| `reviewer-3L` | Merged Lite Phases 6–7 | `gpt-5.6-sol`, `high` | `P67_TO_P8` |
| `reviewer-4` | Combined Phases 8–10 | `gpt-5.6-sol`, `high` | none |

There is no Phase-6 reviewer fan-out, separate Phase-7 reviewer, Phase-8-to-9 handoff or `reviewer-5` in Lite mode. Phase 9 is an internal conditional segment for `reviewer-4`.

## Controller admission

Before work, bind the exact campaign ID/generation, controller branch/workspace path, source repository/commit/digest, supplied source ZIP, supplied skill ZIP, selected `use lite mode` instruction and current authorized worker. A mutable path is never an evidence identity.

When an orchestrator is appointed, every worker deployment must receive local readable copies of the exact supplied skill ZIP and source ZIP plus the exact campaign link and `workspacePath`. The orchestrator reviews only the four milestone packets defined in `LITE_ORCHESTRATOR_MODE.md`.

## Milestone states

The durable path is:

1. `LITE_P0_BOOTSTRAP_ACTIVE` → Phase-0 completion validation `PASS` → `WAITING_FOR_SUCCESSOR_AGENT` via `P0_TO_P1`; then fresh `reviewer-1` enters `LITE_P0_1_ACTIVE` for Phase 1 and seals the P0_1 milestone via `P1_TO_P2`.
2. `LITE_P2_5_ACTIVE` → internal segments 2, 3, 4, 5 with live state → one combined Phase-5 seal → `WAITING_FOR_SUCCESSOR_AGENT` via `P5_TO_P6`.
3. `LITE_P6_7_ACTIVE` → retained merged execution → one merged seal/Phase-7 marker → `WAITING_FOR_SUCCESSOR_AGENT` via `P67_TO_P8`.
4. `LITE_P8_10_ACTIVE` → Phase-8 validation → Phase 9 only if remediation exists → Phase-10 combined final seal → terminal Lite verdict.

Only milestones file reports and checkpoint global controls. Internal segments advance automatically without duplicate reports or seals.

## Source Intelligence and no-repeat controls

- Phase 0 `web-bootstrap-agent` owns neutral Source Intelligence creation and initial acceptance. Phase 1 consumes it for semantic analysis.
- `reviewer-2` verifies accepted identities once at combined Phase-2–5 entry.
- Later Lite work reuses them unless a material source/build/dependency/configuration/toolchain change triggers invalidation or rebind.
- Sealed prior work is consumed, not recreated. Rework is limited to the exact failed acceptance condition and affected dependencies.

## Merged Lite Phase 6–7 enforcement

Authorize only:

- exact build admission;
- complete deploy/configuration simulation;
- candidate-specific deterministic simulation; and
- basic bounded targeted fuzzing.

Full-only broad/random/stateful/chaos/Medusa/mutation/differential/corpus/known-attack/coverage-closure campaigns are out of Lite scope. Their omission is disclosed, not treated as successful evidence or a Lite process failure.

## Phase 8–10 routing

`reviewer-4` validates every material candidate. If no remediation exists, mark Phase 9 `SKIPPED_NO_REMEDIATION` and continue to Phase 10. If remediation exists, verify only each claimed fix and directly affected surface. Any new material candidate returns to the affected Phase-8 validation step. Phase 10 always issues a concise Lite evidence index/report and must not claim Full assurance.

## Full upgrade

An explicit Full-upgrade command exits this controller and invokes `LITE_TO_FULL_UPGRADE.md`. Preserve Phases 0–5 and all still-valid Lite evidence; resume standard Full Phase 6/7 work as a delta. Phase 8/9 reopen only on the defined new-candidate/evidence triggers, and standard Phase 10 always reopens.
