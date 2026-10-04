# Phase-0 Execution Data Contracts v2

Status: producer/consumer implementation contract. Companion: [system specification](PHASE0_AUTOMATED_TESTING_SYSTEM_SPEC_v2.md). Extend the existing Phase-0 simulation evidence family; the seven parallel artifacts proposed by v1 are replaced by the consolidated contracts below. This document is not an executable schema or a sealed campaign artifact.

## 1. Existing products and ownership

Keep the existing canonical roles: deployment/config execution; randomized simulation summary; simulation run index; Medusa config/log/router/corpus; telemetry run summaries/transcripts; Phase-5/6 derived inputs and Phase-6 matrices. Add fields to those owners rather than introduce another evidence tree or second summary.

Upstream build, SBOM, Slither, technical SI, ABI/function index and readiness outputs are immutable referenced inputs. A producer export may be extended to transfer missing full ABIs, bytecode and source maps. Consumers must not rebuild those indexes. Store common prepared metadata in the existing run index by reference; raw run files may use content-addressed shared records to avoid repeating the entire deployment graph thousands of times.

If an incompatible output change requires a new filename/schema version, increment its whole-number version and update every producer, validator, importer, projection and authority reference together. Keep one current operational producer/template. Sealed historical evidence remains immutable. The specific campaign's admitted paths are not renamed by this specification.

## 2. Common identity and input binding

Every run/result carries or references:
- schemaVersion and capabilityContractVersion;
- campaignId and campaignGenerationId;
- sourceArchiveSha256, sourceTreeSha256, archiveCommit/projectPath;
- build artifact manifest digest, per-profile compiler/settings/compilation-unit identities;
- upstreamInputs: each product's repository/path, immutable commit or workflow artifact identity, bytes/digest, producer/tool identity, terminal status and limitations;
- inputBindingMode: PRE_SEAL_PRODUCER_BOUND or ACCEPTED_IMMUTABLE;
- accepted SI/core/Bundle identity when available; never require a future sealed bundle for fresh simulation;
- runnerCommit, qualifiedRunnerIdentity, toolVersions and recipeRegistryDigest;
- generated overlay/config digests, source bytes unchanged attestation;
- stageId/attemptId, actual seed and PRNG version, scheduler decision/corpus references;
- fixtureIdentity described below and normalization/adaptation records.

A digest inferred from a mutable path or a missing null compiler input is not exact evidence. Missing upstream products fail required input validation; missing optional structural facts produce explicit capability gaps. Reused baseline status alone cannot prove upgraded capabilityContractVersion.

PreparedInputView requires joins to original contractId/functionId/artifactId/anchor IDs, basis/confidence and observation/context plans. It is a derived view over existing facts, not another canonical Source Intelligence artifact. Report missing joins, duplicate/ambiguous function IDs and stale/different-profile artifacts. ABI selector, full canonical signature and qualified contract form the execution key.

## 3. Fixture, entity and context records

FixtureIdentity:
- upstream fork origin chain/block/hash and normalized execution chain;
- post-deployment baseline block/hash/timestamp;
- ordered setup/deployment/configuration receipts and content digest;
- source/build/config/adapter digests;
- deployed instance addresses, actual runtime code hashes, immutable/library bindings;
- facade/proxy/implementation/delegate relationships and their evidence;
- ready lifecycle families and unresolved setup/dependency/owner-transfer actions;
- reset/reconstruction instructions expressed through admitted recipes;
- representative state sentinels and verified reset outcomes.

Ephemeral snapshot ID is optional runtime metadata; it cannot be a portable identity. Imported stages retain distinct fixture identities and addresses.

Entity rows use entityId, kind (ACTOR/TOKEN/POOL/POSITION/ROUTER/DEPENDENCY/etc.), actual address/identifier, originating getter/log/receipt/source ref, freshness state and validity conditions. Context rows use contextId, functionId, call path, effective target caller, owner/role basis, value domain, preconditions and expected rejection classifications. Simulated privileged impersonation is explicitly labeled.

## 4. Action and raw telemetry records

Represent one planned main action per record. Keep observation/property/setup subcalls separately associated with it.

Required action fields:
- run/sequence/action indices and stable IDs;
- functionId, qualifiedName, runtimeInstanceId, full canonical signature/selector;
- contextId, actorId, requested sender and observed effective caller;
- declaredMutability, semanticFamily, classificationBasis/confidence;
- typedArguments, actual encodedCalldata or content ref, msgValue;
- prerequisite/fixture/entity refs and planning intent NORMAL/BOUNDARY/EXPECTED_REJECTION;
- state anchors for before and after;
- stages and terminal outcome;
- observation plan/result/delta refs, receipt/log/return/trace/revert refs and limitations.

Stages retain attempted stage, success/failure, measured duration and raw evidence:
ARGUMENT_GENERATION → PREFLIGHT_SIMULATION/ESTIMATION → SUBMISSION → RECEIPT → OBSERVATION.
Optional absent stages remain absent, not successful.

Each action has exactly one executionOutcome:
- NOT_EXECUTED_ENCODING_OR_PLANNING: no target invocation;
- SIMULATED_REJECTION: estimate/preflight returned a protocol rejection, no mined receipt;
- SIMULATION_INFRASTRUCTURE_ERROR: simulation/estimation could not produce a valid outcome;
- SUBMISSION_INFRASTRUCTURE_ERROR: no mined outcome established;
- SUBMITTED_OUTCOME_UNKNOWN: submitted but receipt not available at budget termination;
- MINED_SUCCESS: verified receipt status 1;
- MINED_REVERT: verified receipt status 0.

Count body reachability and semantic transitions separately. Observation failure does not erase the receipt outcome. Medusa in-process execution has its own innerCallOutcome/outerHarnessOutcome fields and is not mislabeled MINED_SUCCESS.

Error records include stage, code, raw bytes/message/ref, decoded custom error/signature/args when matched, emitting contract/frame where known, and classification with evidence:
EXPECTED_PRECONDITION_REJECTION, WRONG_CONTEXT, UNEXPECTED_PROTOCOL_REJECTION, ENCODING_LIMITATION, INFRASTRUCTURE, or UNKNOWN.
Decode against actual known call-frame ABIs; if only a union of error selectors is available, preserve ambiguity. Error name matching alone does not prove expectedness. Unknown errors remain raw evidence.

## 5. Typed observations and deltas

Observation rows:
observationId, entity/function/getter IDs, actual holder/spender/position arguments, caller context, asset/quantity/unit/decimals basis, state/block anchor, required/optional status, execution result, value or UNKNOWN, raw ref and error.

Snapshot completeness is COMPLETE, PARTIAL or UNAVAILABLE relative to the declared observation plan. All absent/failed required reads are listed. Numeric strings preserve full precision; tuple/array outputs retain typed member paths.

Delta rows bind two valid readings of the same quantity, entity, units and comparable state. Otherwise delta is UNKNOWN with reason. Never discard a failed read and infer zero. Storage/state observations and events are separate sources of effect evidence.

Native fee record: raw sender balance delta, value, charged transaction fee components, fee calculation basis and feeAdjustedDelta. If fee components are unavailable, feeAdjustedDelta is UNKNOWN. Native value/internal movement must not be counted twice. Keep token balance, allowance, supply, share, debt, position and configuration effects separate.

Record positiveTransition witnesses by recipe/family/context, touched entities, actual state/log evidence, applicable check refs and observation completeness. A pending-ownership event witnesses an authority request, not economic movement. A correct zero-value/no-op transaction witnesses execution only.

## 6. Medusa registry and coverage contract

Mode is DISCOVERY_ONLY, CHECKED_DISCOVERY, or DISCOVERY_WITH_ORACLE_GAPS. Configuration records enabled testing modes, prefixes, stopOnNoTests, coverage feedback, canonical target signatures and every unsupported context.

Each property row:
propertyId, generated function signature, category, recipe/version/applicability basis, precondition, scoped entities/units, required observations, expected relation/tolerance, discoveredByEngine, executionEvidenceRefs, preconditionWitnessRefs, result and limitation.
Result values: CHECKED_NO_DEVIATION_OBSERVED, DEVIATION_OBSERVED, UNEXERCISED, OBSERVATION_GAP, ORACLE_GAP, ENGINE_FAILURE.

Engine test counts, target properties, standards probes and harness self-checks are distinct. Raw tool summary counts do not become an invented invocation total. Invocation/evaluation counters may be UNKNOWN if the pinned interface lacks them; a claim that an eligible property was exercised still requires native execution/replay evidence and a qualifying state witness.

Coverage dimensions: attempted real functions/contexts; target-body reachability; successful transitions; target source/branch/EVM coverage; harness/setup coverage; known function-transition edges; state signatures; untested/gap rows.
Each metric states provider, source-map/code binding, denominator, supported/unsupported/unknown status and corpus-selection use. Do not present a combined branch count as a target-only percentage.

Corpus entries contain complete serialized typed sequences, actor/value/context, baseline/reconstruction digest, tool/recipe identities, exact action order, coverage contribution, check/signal refs and raw artifacts. A replay/minimization result preserves original and reduced sequences, attempt evidence and semantic equivalence limits. A new fixture cannot silently reuse an old corpus.

## 7. Run summary and quality assessment

Telemetry outcome counters must reconcile exactly with transcript rows. Require:
plannedActions = terminal executionOutcome records + explicitly unresolved records;
MINED_SUCCESS + MINED_REVERT <= submittedActions;
positiveEconomicTransitions <= MINED_SUCCESS;
target successful inner calls <= target inner attempts;
checkedApplicableTargetProperties <= discoveredTargetProperties.

Also report setup/read/property counts outside the main-action denominator, mutating selection share, observed economic/authority/other/no-op effects, per-context error histograms, body/transition witnesses, observation failure counts and reset outcomes.

Use independent assessments:
- executionStatus: COMPLETED / INCOMPLETE / ENGINE_FAILED / INFRASTRUCTURE_BLOCKED;
- checkStatus: CHECKED / NO_PROPERTY_ASSURANCE / PARTIAL / CHECK_DEVIATIONS_OBSERVED;
- reachabilityStatus: REACHABLE / PARTIAL / REACHABILITY_GAP / NO_APPLICABLE_LIFECYCLE;
- observationStatus: COMPLETE / PARTIAL / UNAVAILABLE;
- coverageGuidanceStatus: ACTIVE / UNAVAILABLE;
- limitations, neutral signal refs and exact policy acceptance.

COMPLETED means mechanics finished. It is not "secure", complete economic assurance or controller acceptance. A deviation can coexist with completed execution. A high expected-negative rejection rate can coexist with good positive reachability. An eligible required check with zero tests must fail that capability gate.

Policy values are runner-owned, versioned and emitted before execution. Preserve >100,000 Medusa tool calls and four 1,200-attempt telemetry shards where the admitted authority requires them. Include bounded calibration/rejection-region limits and explicit minimum positive witnesses for each claimed-supported lifecycle/check family. Suggested calibration defaults: up to 32 attempts per context and two evidence-backed alternate recipes; exceeding the finite bound returns a typed gap. No target-specific success-percentage rule.

Performance fields: wall-clock/CPU/peak memory, RPC calls by method and action stage, retries/timeouts, read batching/cache hit counts, transcript/raw bytes, corpus size, coverage progress/plateau and useful transitions per minute. Publish actual observations; no fabricated estimated speedup.

## 8. Consumer migration and acceptance rules

Reuse the existing projector for Phase-5/6 inputs/matrices and the existing readiness/limitation surfaces for Phase 1/final consumers. Preserve machine-only ownership and IDs. Consumers receive summaries and refs, not duplicated raw data; controller-prefilled values remain protected.

Upgrade workflow completeness checks, finalizer checks, completed-stage import validation and projections together. A v1 imported discovery result retains its v1 acceptance basis and weaker limitations. It can supply retained discovery history but cannot satisfy a required v2 property/reachability gate. Tool/recipe/fixture/ABI/context changes invalidate only the affected stage evidence, preserving valid upstream build/Slither/SI products.

Missing raw refs, mismatched counts/digests/generation, path traversal, unknown-outcome relabeling, zero checks claimed as checked, omitted supported surfaces, fabricated observations, secret leakage and premature finding/severity labels fail validation. Recipe/semantic gaps are explicit limitations routed according to the governing authority; they are never repaired by assertions invented from names.
