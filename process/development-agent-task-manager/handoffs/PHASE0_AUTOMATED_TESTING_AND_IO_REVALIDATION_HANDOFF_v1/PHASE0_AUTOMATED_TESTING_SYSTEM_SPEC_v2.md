# Phase-0 Automated Testing System Specification v2

Date: 2026-10-04. Status: implementation specification; programs are not yet repaired. Scope: the shared automated preparation layer, Medusa and ABI telemetry in the existing Phase-0 execution path. Use this document with [data contracts](PHASE0_EXECUTION_DATA_CONTRACTS_v2.md), [acceptance tests](TEST_AND_ACCEPTANCE_PLAN_v2.md) and [implementation plan](PHASE0_AUTOMATED_TESTING_IMPLEMENTATION_PLAN_v2.md).

## 1. Required outcome and applicability

One admitted source ZIP must trigger the same deterministic pipeline for every packet: consume the existing source/build and contract/script indexes, establish a fixture, resolve callable contexts, generate typed actions and applicable checks, execute, retain results and project compact evidence. Phase 0 remains machine-only. No AI agent, manual packet-specific harness, extra human input, campaign-name branch or hardcoded DEX address may be required to operate the pipeline.

"Any packet" means every packet receives an automatic, truthful disposition. Execution support is for EVM-compatible compiled artifacts and safely admitted deployment frameworks. Non-EVM code, missing dependencies and semantics that cannot be established automatically receive explicit unsupported/gap records. ABI shape alone cannot establish arbitrary economic invariants. Do not claim universal security assurance or invent a generic rule such as every vault's assets always equal deposits.

Automation may instantiate qualified reusable recipes from packet evidence. Recipe selection and parameters must be derived mechanically from exact artifacts, interfaces, recognized implementation identities, existing executable tests and deployment/configuration outputs. Unknown semantics remain an automatic ORACLE_GAP; this must not trigger repeated speculative repairs. Protocol-specific semantic test design remains in the later authority-defined reviewer phase.

All execution is confined to the existing runner-managed Anvil simulation boundary. Preserve canonical Ethereum normalization for packets declaring other EVM chains and report those original chain identities. This is discovery under a normalized fixture, not validation of the production deployment chain.

## 2. Evidence-backed defects

At Contract-Automation commit 87664a72c125bb83827f114087fb6e38f99b6750, the primary implementation is packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs; the older isolated engine is a reuse/reference path, not the production entrypoint.

| Defect | Current code location | Required correction |
|---|---|---|
| Property/assertion checks disabled; zero tests allowed | runMedusa, lines 625 and 655 | Distinct discovery and qualified check modes; mode-aware acceptance |
| All inner calls see the wrapper as caller | renderMedusaRouter, lines 601–610 | Preserve and verify target-level caller/value/context semantics |
| Tuple inputs omitted; other functions removed to create weighting | solidityType/medusaWrappers, lines 574–599 | Recursive ABI support and fair scheduling with no silent omission |
| transferOwnership counted as accounting by prefix | ACCOUNTING_MUTATION_RE, line 18; mutableFunctions, line 421 | Separate mutability, semantic action family and verified transition effect |
| Fixed arrays longer than four shortened | randomValue, line 446 | Exact declared fixed length or explicit bounded-resource limitation |
| Arbitrary addresses used as pools/tokens/receivers | randomValue, lines 444–454 | Evidence-backed typed entity pools and fixture-aware arguments |
| Most rejection occurs before submission | runTelemetry, lines 558–561 | Separate generation, simulation/estimation, submission and mined outcomes |
| Missing reads omitted from numeric deltas | probePlan/snapshot/deltas, lines 456–487 | Typed observation completeness; missing is not zero or unchanged |
| PASS measures quantity alone | runTelemetry line 569; runMedusa line 655 | Independent execution, reachability, property and observation assessments |
| Existing-stage import preserves old quantity-only PASS | phase0-completed-stages-v1.mjs | Versioned compatibility rules; old evidence cannot satisfy stronger checks |

The reviewed r3 evidence records 138,521 Medusa calls with zero tests, and 4,800 telemetry attempts: 133 successes and 4,667 estimateGas rejections. Of the successes, 119 were ownership-transfer requests, ten initialization-hook calls and four empty multicalls. All recorded numeric deltas were native.sender gas expenditure. These are limitations of that retained evidence, not proof that every rejected call is a contract defect.

## 3. Shared preparation contract

### 3.0 Existing intelligence is the mandatory input, not work to repeat

Both programs must consume the upstream Phase-0 products before planning calls. Create a thin joined preparation view over those products; do not rerun Slither, ABI/function indexing, static source discovery or full Source Intelligence generation inside either program.

| Existing producer/output | Fields consumed | Use in both programs |
|---|---|---|
| BUILD_AND_SOURCE_IDENTITY_v1.json and exact build artifacts | source/archive identity, projectPath, compilerProfiles, compilation units, actual ABI/bytecode/link references/AST/source maps when retained | Typed encoding, exact deployment, runtime/coverage mapping and build reuse |
| SOURCE_INTELLIGENCE_AUTOMATED_v1.json | functions.functionId/contractId/signature/selector/stateMutability/payable; compilerArtifacts.methodIdentifiers; contracts and sourceFiles | Canonical callable IDs, context variants and ABI reconciliation |
| Same technical SI | callGraph, privilegeCandidates, externalInterfaces, valueFlowCandidates, storageLayout, sourceAnchors, protocolTopology | Evidence-backed candidate relationships, actor/context resolution and observation planning |
| SLITHER_v1.json | terminal/componentStatus, detectors.check/elements/source mapping/confidence, exact export identity | Neutral priority hints, correlated function/state relationships and known limitation regions |
| PROJECT_READINESS_AUTOMATED_v1.json | deploymentAndConfiguration, testingAndToolingReadiness, bytecodeAndGasEvidence | Scripts/configuration, existing test/harness recipes, constructor/dependency inventory and resource bounds |
| SBOM_v1.json and lock/build dependency identities | resolved library/compiler/package versions | Qualified recipe recognition and supply-chain/source binding |
| Deployment execution and available runtime overlay | deployed instances, setup receipts, actual owner/role/pool/asset bindings, adaptations and unresolved actions | Fixture and valid contexts; static candidates alone do not prove live permissions |
| Canonical core/Bundle Index/overlays, when already admitted | accepted revisions/digests and limitations | Reuse and rework provenance; no duplicated index |

Fresh Phase 0 currently generates technical SI before simulation and seals/projects the canonical core afterward. Do not make the simulation depend on a future sealed Bundle Index or on its own deployment results already existing. Consume exact producer-bound pre-seal intelligence for a fresh run; use accepted immutable identities for reuse/rework. Final projection binds the preparation view to the admitted bundle without regenerating existing facts.

The existing technical SI exposes ABI digests, method IDs and function signatures; these are not substitutes for full ABI components or executable bytecode. Reuse complete build artifacts from the upstream workflow where available. If they are not exported across the job boundary, extend that existing producer's artifact transfer with a verified ABI/bytecode/source-map bundle and content manifest. That is a bounded missing-output repair, not authorization to repeat all build/intelligence analysis. Exact rebuilding in GitHub is a recorded last-resort recovery, never the default second build.

Each inferred edge retains its original basis, confidence, source anchors and limitations. Slither candidates can prioritize ready known actions and observations; they cannot become findings, proven access policies or arbitrary generated economic invariants. Cross-index mismatches fail identity/inventory validation rather than being hidden by a new index.

S-01 Exact identity. Bind campaign/generation, archive digest, exact available producer-bound or accepted build/SI revisions as applicable, compiler profiles and dependencies, runner/recipe versions, source and overlay digests. Do not flatten multiple compiler profiles or silently omit optional build branches. Each executable instance needs actual runtime code identity, linked libraries, immutable parameters and proxy/implementation relationships where discoverable. Preserve discovery uncertainty rather than accepting a name/prefix match as exact code identity.

S-02 One callable inventory. Reconcile accepted structural surfaces with compiled external/public ABI functions, receive/fallback, constructor and script entries. Internal/private functions are source context, not externally callable inventory. Distinguish abstract/interface/non-instantiated rows. Every external surface has one or more context variants and a disposition: READY, CONTEXT_REQUIRED, FIXTURE_GAP, ABI_RESOURCE_LIMIT, UNSUPPORTED, or NOT_EXTERNALLY_CALLABLE. No function disappears because of type complexity or weight.

S-03 Fixture graph. Prefer exact safe package deployment/test fixtures, then admitted source-known deployment/configuration plans, then existing compiled-artifact fallback. Constructor arguments, registrations, token relationships, allowances, actor funding and initialization order require evidence-backed bindings. Never insert arbitrary constructor addresses or fabricated oracle values to make the graph deploy. Report dependencies missing on normalized Ethereum as normalized-environment gaps. Runtime fallback deployment does not prove the supplied scripts passed.

S-04 Script admission. Reuse framework adapters for Foundry, Hardhat and mechanically admitted Node entrypoints. A variable named RPC_URL is not sufficient proof that all writes use the simulation RPC. Verify actual provider chain and redirectability, enforce the runner's execution boundary, and give source scripts only the minimal environment and ephemeral simulation signer. Never expose production credentials, upstream RPC secrets or GitHub credentials to packet code. Bound processes, filesystem outputs and network use through existing runner isolation. Dependency installation, build and scripts run in GitHub only.

Frozen packet bytes must remain unchanged. Where an existing adapter creates a transformed script copy, record original/adapter/transformed digests and the exact normalization; classify it as ADAPTED_SCRIPT, never exact script execution. Prefer framework/environment binding without rewriting. Token substitution, chain overrides and mock dependencies are separately labeled. Each discovered script has its own executed/unsupported/failed disposition, observed deployed graph and unresolved initialization/handoff actions. Exit zero and "some contracts exist" are insufficient for completed handoff.

S-05 Actor/context table. Record actual owner, pendingOwner, admin/roles, ordinary simulation accounts, intended receiver and contract-caller variants. A modifier/name is a candidate, not proven authority. Resolve through matched source and runtime reads/receipts. Unsupported reads or contract owners remain typed gaps. Impersonation is permitted only as declared simulated-authority context, never proof that an ordinary account has authority. A wrapper acting as caller, direct caller, delegate context and protocol-mediated callback are distinct contexts.

Route delegate-only methods through their actual facade/proxy and callbacks through supported protocol flows. Direct-context rejection may be a useful negative observation but does not cover the valid context. Do not bypass production checks, write arbitrary target storage or spoof a dependency to manufacture lifecycle success. Caller/value/context witnesses must be visible in qualification traces.

S-06 Recursive ABI codec. Use normalized ethers ParamType/canonical sighash helpers already present. Support tuples, tuple arrays, nested arrays, fixed arrays, integer widths, signed minima/maxima, bytesN, dynamic bytes and strings. Keep exact fixed-array lengths. Dynamic-depth/size/total-calldata limits are explicit and resource-based; over-budget cases are not silently truncated. Preserve payable/value constraints and represent integers as decimal strings in artifacts.

Prefer recursive generated Solidity structs/arrays or a qualified typed-dispatch encoding adapter for Medusa. In either case, every decoded call maps to a real known function and full canonical signature. Never permit unrestricted arbitrary-calldata calls to satisfy ABI coverage. Overload and selector collision identities include qualified contract and signature.

S-07 Reusable recipe boundary. A trusted versioned recipe owns applicability predicates, parameter derivation, fixture preconditions, real actions, observations, checks and resource bounds. One registry in the owning package serves both programs; no parallel per-campaign framework. Packet-supplied configuration/tests are evidence to inspect and admit, not trusted arbitrary executable instructions. Recognition must tolerate renamed entrypoints when behavior is identified and must reject lookalike interfaces with insufficient basis.

S-08 State lifecycle. Establish a reconstructible baseline with fork origin block/hash, post-deployment baseline block/hash, timestamp, fixture/configuration digest and ordered setup receipts. Snapshot IDs are ephemeral conveniences, not portable fixture identities. Verify reset success and representative state sentinels before a shard or replay. Keep seed, PRNG version and actual scheduled decisions; multiworker Medusa runs require serialized sequences for replay rather than a claim that a global seed gives identical scheduling.

## 4. Program A: automated Medusa upgrade

M-01 Preserve discovery. Retain coverage-guided broad ABI exploration and the authority's >100,000-call baseline for routable targets. The observed CLI count is a tool-level counter, not an automatically verified count of distinct successful production transitions. Record wrapper, dispatch, inner-target, fixture and property-call counters separately when measurable; unknown counters stay unknown. No-op wrappers, property evaluations, setup and duplicate wrapper copies must not inflate target-call coverage.

M-02 Add qualified checking. Select applicable packet-declared executable properties and trusted interface/implementation recipes automatically. Generate audit-only checks from those recipes. Reuse the existing Medusa property skeleton and parser/configuration helpers after verifying compatibility with pinned Medusa 1.5.1. Do not import unrelated Phase-6 campaigns or their completion rules.

Checking mode must enable propertyTesting, assertionTesting and stopOnNoTests; retain coverageEnabled. Prefixes must match generated no-argument bool property functions. A discovery mode with checks disabled must explicitly state NO_PROPERTY_ASSURANCE. Enabled assertion testing alone does not prove economic properties were checked.

M-03 Property registry and anti-vacuity. Each property requires an ID, category (TARGET_BEHAVIOR, STANDARD_PROBE or HARNESS_SELF_CHECK), evidence basis, scope, units, precondition, observation plan, expected relation and unsupported variants. Separate discovered tests from actual applicable checks and from properties that never reached a qualifying state.

A harness counter identity such as successes + reverts = attempts is useful instrumentation, not target-security assurance. A property returning true because nothing happened, missing reads were replaced by zero, or every precondition was false cannot qualify. Require a precondition witness after a successful relevant target transition and evidence that the checker executed in that state. A false/true capability-control pair on owned qualification fixtures must prove the runner discovers, executes and reports checks. Such control fixtures never count as target tests.

M-04 Defensible automatic checks. Start with qualified standards/known implementation behavior, applicable source-declared properties, and safe state-transition relations derived from exact receipts and typed observations. Do not impose fixed-supply or universal balance conservation on tokens supporting burns, fees, rebases or external yield. Do not infer correct vault pricing from totalAssets alone. Recipe arithmetic uses explicit units, allowed mutations and source-bound tolerances. Unknown relations produce ORACLE_GAP.

M-05 Typed actions and context. Share S-01–S-08 with telemetry. Preserve actual target caller; merely configuring Medusa senderAddresses affects callers of the harness, not inner calls. If caller-preserving instrumentation is necessary, reuse verified engine capabilities and qualify the resulting trace. Unavailable caller semantics block that context; no guessed cheatcode or unrestricted privilege bypass.

M-06 Feedback and weights. Keep all admitted surfaces represented. Use deterministic schedules/dispatch weights with minimum per-context exploration and corpus retention for new target coverage, known transition edges or distinctive outcomes. Weighting by duplicate wrappers must not erase other functions. Report achieved call weight from actual dispatches, not wrapper population. Count target code separately from harness/setup/vendor code; retain compiler source-map identities and unavailable-metric reasons.

M-07 Reverts and checks. Low-level false results remain explicit target outcomes. Expected input/access/context rejection is not automatically a property failure. Selected panics and check deviations produce neutral machine signals. Do not catch and discard assertion failures or change every revert to assert(false). Preserve tool-native failed sequences and raw revert/coverage reports.

M-08 Acceptance. Discovery completion, check completion, property outcomes, meaningful reachability and applicability are separate fields. A supported required check lane with zero discovered/exercised target checks is not accepted as check completion. If recipes genuinely cannot establish target properties, report ORACLE_GAP/NO_PROPERTY_ASSURANCE automatically; do not create a constant-true replacement. A discovered deviation is retained as a neutral signal, not silently converted to infrastructure failure or a validated finding.

## 5. Program B: automated ABI telemetry upgrade

T-01 Classify three different facts. Record declared mutability, semantic action family and observed effect independently. Families include ECONOMIC, AUTHORITY_CONFIG, OTHER_MUTATION, VIEW, SETUP and UNKNOWN. Existing prefix regexes may nominate families, never establish them. transferOwnership is AUTHORITY_CONFIG. Empty multicall is a successful no-op. Mint/burn need distinguished token/share/admin meanings. Unknown custom accounting remains UNKNOWN with source/trace evidence, not guessed ECONOMIC.

Keep the authority's approximately 80% accounting/state-changing action target, with explicit denominators. This is an action-selection budget; report attempted mutations and committed transitions separately. Do not claim 80% successful economic activity from selected names. Property/read/setup calls are separate denominators. Where no economic recipe applies, the process still runs available mutations and reports the gap.

T-02 Reachable typed actions. Build normal action inputs from the shared entity/fixture graph: actual registered pools, assets, initialized positions, owners, receivers, supported routers, balances, allowances and discovered identifiers. Use valid lifecycle templates only when mechanically recognized. ABI-valid alone does not imply semantically valid. Preserve a separately labeled boundary/rejection sample; do not eliminate expected rejection tests to improve the success rate.

T-03 Protect useful fixture states. Owner/configuration transitions must use their own resettable fixture variant or a bounded configuration phase so repeated pending-owner changes cannot dominate the economic lane. Record setup separately. Each applicable lifecycle family needs a retained positive witness that reaches its target body and performs its declared transition. Expected rejections need a different witness. Never call a known delegate-only implementation directly as a substitute for its valid facade.

T-04 Adapt without loops. Before a long shard, perform bounded context/recipe calibration. Group rejections by function/context/stage/error. On repetitive precondition/context failures, select a verified alternative context or a supported setup recipe; retain the first examples and aggregate every remaining attempt. Do not guess permissions or force target state. After a bounded unchanged failure region, mark it REACHABILITY_GAP and spend remaining budget on ready contexts. The same wrong-context region cannot consume all four shards indefinitely.

Cross-contract bursts remain interleaved and may revisit contracts as in the existing scheduler. State-dependent ready actions update between bursts. Deterministic scheduling respects minimum exploration per supported family, resource budgets and actual feedback. At least one test must demonstrate that a new successful transition changes subsequent eligible action selection.

T-05 Preserve execution stages. Every record distinguishes ABI generation, preflight/estimate simulation, submission, receipt and observation. An estimateGas rejection is a simulated rejection with no mined receipt. A status-zero receipt is a mined reverted transaction. RPC timeouts, encoding errors, unresolved observations and protocol rejections are separate classes. Receipt status must be inspected directly; a returned transaction hash is not success.

Do not globally bypass gas estimation just to produce mined failures. When a declared recipe intentionally exercises a reverting transaction, any explicit gas limit is bounded and labeled. Record actual fees for mined success and mined revert; retain receipt/log/return/revert data where available.

T-06 Read adequate state. Shared observation plans derive token contracts, holders, spenders, position IDs and relevant vault/pool/debt/share/reward getters from source/runtime relationships. Native balances alone are inadequate for token accounting. Observe ERC20 balances/allowances, supply/shares and protocol quantities only where applicable and resolvable. Nested return structures need typed decoding and units. Views through the wrong facade and views using random addresses remain failed observations.

Read pre/post values against exact state anchors; serialize mutating actions. Batch/cache only reads known to share a state and appropriate caller context. A failed observation is UNKNOWN, never zero or unchanged. The plan records required/optional fields, completeness, missing reasons and observation-call outcomes.

T-07 Deltas and useful effect. Report raw native sender delta, charged transaction fee and fee-adjusted native movement separately; include value/internal transfers without double counting. Record token/share/debt/position/configuration deltas with identity and units. Zero movement can be correct; absence of observations cannot establish zero movement. Event-only evidence is distinct from state evidence. A governance event establishes a governance transition, not a payout.

T-08 Completeness and performance. Preserve the current four 1,200-attempt shard baseline while reporting eligible families, positive witnesses, expected-negative outcomes, no-ops, mined economic transitions, state-change-only governance effects and gaps. A high rejection rate alone is not a failure threshold. Reject a meaningful-lifecycle claim when all relevant attempts stop before the expected body.

Reuse the existing batched snapshot improvement. Cache ABI/interfaces and invariant metadata once; bound read concurrency; adapt observation plans to touched entities; avoid scanning every target's native balance after each action unless required by the plan. Retain raw records incrementally with periodic flush and summary reduction, deduplicating large common metadata by content-addressed reference. Measure RPC calls, gas-estimation/receipt/read time, bytes, peak resources and successful relevant transitions per minute.

## 6. Integration, recovery and completion

Minimum progress policy is per supported recipe/family/context: require at least one positive target-body transition witness and, for a claimed exercised check, a qualifying-state/check-execution witness. Calibration is bounded as specified by data contracts (default 32 attempts per context and at most two evidence-backed alternatives). Weight budgets must not permit configuration/no-op traffic to displace those required positive witnesses. Full exploration is still resource-bounded; no fixed success percentage is used.

Use the existing workflow, runner, evidence projector, finalizer and completed-stage importer. Data contracts v2 define additive fields and versioned acceptance; do not create another workflow family, ingestor, controller, AI Phase-0 launcher or per-packet service.

Strengthened check/reachability gates require a synchronized authority contract, validator and producer change before activation. This specification does not itself change admitted authority or sealed campaign requirements. Keep original accepted evidence byte-for-byte. Old evidence may remain DISCOVERY_ONLY/LEGACY_LIMITED; it cannot be relabeled as the upgraded check lane.

Record independent Medusa and telemetry fixture origins separately when imported from distinct runs. Generate downstream views directly from verified summaries; carry property absence, reachability and observation gaps to Phase 1 and the existing Phase-5/6 consumers and final limitation view. Do not require agents to manually reparse thousands of records.

Required execution failure triggers bounded diagnose/repair/retry, retaining every attempt. Method/recipe gaps are terminal typed limitations after mechanical alternatives are exhausted, not a reason to invent semantics. On a failed check engine, complete independent available observations where fixture integrity is intact; apply final acceptance only after raw evidence is safely retained.

Implementation completion is the finite acceptance matrix passing for the shared layer and both programs, including held-out packet generality, exact artifact binding, current CI/qualification and synchronized changed interfaces. Source security conclusions remain later semantic work. Scope excludes repository-wide cleanup, unrelated browser/watchdog repair and automatic advancement of the reviewed r3 campaign.
