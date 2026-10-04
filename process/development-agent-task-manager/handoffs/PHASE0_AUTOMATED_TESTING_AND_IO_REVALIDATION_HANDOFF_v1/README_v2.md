# Phase-0 Medusa and Telemetry Upgrade Handoff v2

Date: 2026-10-04. Status: specifications complete; implementation and execution qualification pending. This is the current bounded handoff for repairing the two existing automated programs. It reuses this established folder and supersedes its v1 system/data/implementation/acceptance documents. The folder name remains a stable location. Superseded v1 bytes are preserved in the paired [archive proposal](https://github.com/CurveYield2/archive/pull/1); only current v2 documents remain at the replaced active paths.

## Read order

1. [Current live state](CURRENT_LIVE_STATE_v2.md) — verified source/code/evidence identities.
2. [System specification](PHASE0_AUTOMATED_TESTING_SYSTEM_SPEC_v2.md) — shared upstream-data consumers, Program A Medusa and Program B telemetry.
3. [Execution data contracts](PHASE0_EXECUTION_DATA_CONTRACTS_v2.md) — inputs, outcomes, observations, checks and consumer migration.
4. [Test and acceptance plan](TEST_AND_ACCEPTANCE_PLAN_v2.md) — A01–A34, held-out packets, DEX regression and performance.
5. [Implementation plan](PHASE0_AUTOMATED_TESTING_IMPLEMENTATION_PLAN_v2.md) — ordered smallest changes and concrete file/function map.
6. [Source map](SOURCE_MAP_AND_REFERENCE_FILES_v2.md) and [handoff state](HANDOFF_STATE_v2.json) — exact resume/navigation references.

Audit methodology remains [current Audit-Controller authority](https://github.com/CurveYield2/Audit-Controller/tree/main/Audit%20Skill%20-%20Current%20Authority). At this snapshot it is Audit_Litemode_v10.3. These specifications are engineering requirements, not a replacement skill or a new campaign assignment.

## Current task and boundary

Implement universal, fully automated consumers of the existing build, ABI/function index, Slither, Source Intelligence and readiness workflows. Add missing qualified property checking, valid caller/fixture contexts, meaningful transitions, correct telemetry classifications and adequate accounting observations. Every packet receives the same pipeline and truthful applicability/gap handling; no manual packet-specific edits are required to operate it.

The reviewed campaign is the regression packet, not a special branch in program logic. Preserve accepted evidence and the existing Phase-1 correction candidate in Audit-Controller PR #113. No campaign advancement or successor wake is authorized by these documents.

The broader all-phase I/O playbook/matrix already in this folder remain supporting material for a separately authorized broader review. They are not the controlling scope of this handoff. Current integration work checks only changed interfaces and required existing regressions. Reuse already-correct code and data; do not restart previous authority repairs.

## Completion

For this documentation task: the specs are filed, internally checked and exact remote bytes verified in a docs-only draft PR. No implementation/testing success is claimed.

For the successor implementation: A01–A34 and declared supported families are verified; unsupported semantics are disclosed; GitHub qualification and affected producer/consumer checks pass; exact results are reviewable. The [successor brief](SUCCESSOR_WAKE_MESSAGE_v2.md) is a manual development handoff, not a dispatch request or audit wake file.
