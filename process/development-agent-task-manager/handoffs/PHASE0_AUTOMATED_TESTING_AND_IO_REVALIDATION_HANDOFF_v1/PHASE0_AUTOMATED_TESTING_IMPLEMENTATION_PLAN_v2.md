# Phase-0 Automated Testing Implementation Plan v2

Use [system v2](PHASE0_AUTOMATED_TESTING_SYSTEM_SPEC_v2.md), [data contracts v2](PHASE0_EXECUTION_DATA_CONTRACTS_v2.md) and [acceptance v2](TEST_AND_ACCEPTANCE_PLAN_v2.md). This plan specifies one bounded repair path. It does not launch an agent, permit a campaign restart, or authorize production merge/advance.

## 1. Live re-anchor and reuse

Read root/local AGENTS.md and [current live state](CURRENT_LIVE_STATE_v2.md). Refresh main and authority before coding. At this handoff the primary engine is packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs; the separate audit-harnesses/phase0-simulation-testing-v1/engine-v1.mjs is an earlier isolated path. Inspect differences before choosing a reuse seam. Preserve its useful fixes; do not copy the older engine wholesale over production.

Inspect existing upstream producer products first: build/source identity, full build artifacts, SBOM, Slither, technical SI/function index and readiness. The initial implementation task is a thin consumer/join, not new indexing. Repair an upstream artifact export only if the current products lack full ABI/bytecode/source maps needed downstream. Never default to repeating compilation, Slither or inventory generation.

Use one implementation branch/PR and the normal development task lock when that process launches the implementer. Satisfied preexisting work stays closed. Start from the draft specification branch or carry its exact documents into the single repair branch; do not maintain competing implementations.

## 2. Ordered code increments

1. Implement upstream input binding and the shared prepared view over canonical IDs, runtime instances, ABI types, contexts/entities and recipes. Add A01–A12 tests. Introduce the smallest helper module(s) in the existing package only where they serve both programs.
2. Correct telemetry classification, stages, receipts, observations and deterministic bounded calibration/ready-action scheduling. Establish positive fixture transitions and A22–A30 before spending the full shard budget.
3. Correct Medusa typed dispatch/caller/context, recipe-generated checks, anti-vacuity witnesses and coverage separation. Reuse existing skeleton/config/parser mechanisms; prove A13–A21 with the pinned engine.
4. Update existing evidence reducers/projector/importer/finalizer and capability-version rules. Preserve legacy evidence as discovery-only. Add A31–A34.
5. Run held-out fixtures, then unchanged DEX packet qualification in isolation and full resource/performance measurements. No edits to target production contracts.
6. Synchronize only authority/interfaces needed to declare and consume the new outputs/gates. Run affected cross-repository regressions/qualification. Produce reviewable implementation PR(s), exact verification references and a finite remaining-gap list.

If a real module is already correct, reuse it. Do not reimplement the qualified compiler, Anvil identity proxy, staged source extractor, ABI normalization, script resolver, batched read helper, evidence ingestor, browser system or controller for convenience.

## 3. Concrete code touch map

| Owner | Existing path/function | Intended delta |
|---|---|---|
| Shared/producer | src/lite-phase0-intelligence-v1.mjs; existing build/SI artifact exporter | Export missing reusable execution artifacts only; no new analysis pass |
| Shared | src/phase0-randomized-simulation-v1.mjs: artifactAccessor, targetObjects, mutableFunctions, randomValue, script/fixture discovery | Consume indexed facts; typed entity/context/codec/classification and exact fixture binding |
| Medusa | same file: solidityType, medusaWrappers, renderMedusaRouter, runMedusa | Recursive types, preserved context, checks, honest counters and coverage |
| Telemetry | same file: probePlan, snapshot, deltas, errorInfo, pickFn, buildBurstSchedule, runTelemetry | Adequate state, lifecycle scheduling, stage/effect classification and performance |
| Reuse | src/analysis.mjs; harness-skeletons-v2/medusa; existing native fuzz helpers | Use compatible parsers/templates; no wholesale Phase-6 campaign import |
| Import | src/phase0-completed-stages-v1.mjs | Capability-version acceptance and legacy limitations |
| Projection | scripts/write-phase0-simulation-outputs-v1.mjs | New quality/properties/effect fields in existing consumers |
| Gate | scripts/lite-phase0-finalize-v1.mjs; current randomized/rebind/bootstrap workflow checks | Shared validation; raw retention before acceptance |
| Tests | test/phase0-randomized-simulation-v1.test.mjs; existing Medusa/importer/consumer tests | Behavioral acceptance fixtures and exact counter tests |
| Authority | current Phase-0 card/contract and changed output/consumer declarations | Paired minimal amendment before stronger rules become mandatory |

Paths beginning src/test are under packages/github-native-sim/. Version production files only when their contract actually changes and update references atomically; never create retry siblings.

## 4. Execution and merge boundaries

User scope for this turn is specifications. No workflow or deployment run is part of authoring them. The implementer must receive the handoff through the selected development process; this document is not an auto-dispatch request.

Future implementation qualification is on GitHub only, using the existing runner-managed Anvil lane. Check current active runs first and run sequentially. Retain failed attempt evidence, make a relevant repair, retry once through the existing path and verify. Unchanged repeated failure is not permission to create another workflow or broaden scope.

When authority and automation must change together, use paired reviewable PRs and the existing paired qualification/rebind protocol. This handoff grants no additional merge permission. Before production activation, verify admitted qualified runner pins and authority synchronization. Do not use a docs-only commit as an executable qualification claim.

## 5. Reviewed campaign disposition

Phase-1 semantic candidate and quality report are already in Audit-Controller draft PR #113. Program changes do not adopt or reseal that candidate. Any later execution refresh for r3 requires the authority's typed rework/rebind and preserved old receipt lineage. Only changed stages need new evidence; valid upstream Slither/build/SI facts are reused.

Do not invoke boundary validation against the waiting Phase-2 assignment, wake a successor, edit controller-owned receipts/prefills or restart sealed phases during infrastructure qualification. Keep campaign-data adoption and universal program qualification as separate explicit end states.

Stop when the bounded implementation acceptance is verified and reviewable results are filed. Park unrelated browser/watchdog, repository hygiene and all-phase redesign issues. An unresolved semantic recipe gap is disclosed; an implementation defect preventing an advertised supported case must be repaired.
