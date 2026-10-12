# Baseline Attribution and Complete Inventory v1 — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Implement the checkboxes sequentially; checkpoint after each task.

**Goal:** Explain where benchmark detection failed and create a deterministic denominator that includes every in-scope source declaration and review context.
**Architecture:** Read existing sealed evidence for attribution; extend Source Intelligence with an AST-first review inventory without replacing existing ABI-facing outputs.
**Tech Stack:** Node.js ESM, existing canonical JSON helper, admitted compiler outputs, GitHub-only verification.
**Spec:** 00_BUILD_CONTRACT_v1.md. Its global constraints and identity envelope apply.

## Global constraints

Do not reconstruct missing benchmark truth from the user's abbreviated table. Do not execute benchmark defects or change frozen contracts. No local compilation/dependency download. New runtime outputs live inside existing campaign work/evidence ownership, never repository root. All proposed new paths below are implementation targets, not claims that files already exist.

## Review focus

- Missing truth cases: Task 1 rejects qualification eligibility without inventing rows.
- Stale/incomplete compiler units: Task 2 emits blocking omissions.
- UTF-8 offsets, overloads and identical contract names: Task 2 uses byte anchors and qualified identities.
- Oversized contracts and inheritance: Task 3 splits declarations without dropping effective contexts.
- Unresolved dynamic edges and exclusions: Tasks 2–3 preserve required manual obligations.

## Stage 1 / Task 1 — Frozen benchmark attribution

**Files**
- Create scripts/lib/lite-benchmark-attribution-v1.mjs.
- Create scripts/tests/lite-benchmark-attribution-v1.test.mjs.
- Create protocol/schemas/curveyield-benchmark-attribution-v1.schema.json.
- Store campaign outputs at work/qualification/BASELINE_ATTRIBUTION_v1.json and controller-rendered work/qualification/BASELINE_ATTRIBUTION_v1.md.
- Do not store confidential answer keys in public Contract-Automation. Resolve the benchmark owner's restricted evidence location through existing campaign references.

**Interface**
buildAttributionV1({identity, declaredCaseCount, truthManifest, evidenceIndex}) -> {schemaVersion:"curveyield-benchmark-attribution-v1", ...identity, payload:{declaredCaseCount, receivedCaseCount, rows, missingCaseIds, qualificationEligible}}.
identity is the shared envelope identity. truthManifest contains owner-confirmed caseId, source binding, anchor, security property, validated severity and validationEvidenceRefs; absence of any field is a truth limitation.
Each row is {caseId, truthStatus, firstFailure, downstreamFailures, checkpoints, findingRefs, attributionEvidenceRefs}. truthStatus is VALIDATED|UNVALIDATED|MISSING.
firstFailure is NOT_INVENTORIED|NOT_ASSIGNED|NO_SUBSTANTIVE_REVIEW|INCORRECT_SAFE_CONCLUSION|CANDIDATE_DROPPED|TEST_NOT_BOUND|EXECUTION_INADEQUATE|INTERPRETATION_ERROR|REPORT_OMISSION|DETECTED|UNKNOWN.
checkpoints contains INVENTORY, ASSIGNMENT, REVIEW, CANDIDATE, TEST_DESIGN, EXECUTION, INTERPRETATION, REPORT; each has status PASS|FAIL|UNKNOWN|NOT_REQUIRED and evidenceRefs.

- [ ] Locate the exact benchmark campaign and source identity from durable controller state; capture final review artifacts and the owner-confirmed answer-key reference at immutable commits. Record evidence identity, not just URLs.
- [ ] Write failing tests: declaredCaseCount=30 with 17 received cases yields receivedCaseCount=17, qualificationEligible=false and explicit missing count; it must not produce 13 invented cases. An unvalidated severity stays unvalidated.
- [ ] Write tests: present inventory plus absent assignment -> NOT_ASSIGNED; missing review evidence -> UNKNOWN rather than NO_SUBSTANTIVE_REVIEW; a generic completed row demonstrably lacking source reasoning -> NO_SUBSTANTIVE_REVIEW; an earlier UNKNOWN prevents a later observed failure being called the proven first failure.
- [ ] Implement ordered checkpoint attribution. A failed checkpoint is the firstFailure only if every earlier required checkpoint has PASS evidence. Otherwise firstFailure=UNKNOWN and retain observed failures in downstreamFailures. DETECTED requires a final source/property-matched finding, not a shared title.
- [ ] Render per-stage counts, per-contract detection counts and unknowns. Do not claim that concentrated findings alone prove unread contracts.
- [ ] Verify on GitHub with node --test scripts/tests/lite-benchmark-attribution-v1.test.mjs. Expected: every fixture passes; no source execution occurs.
- [ ] Commit the reusable attribution code and publish the baseline report link. If truth/evidence remains unavailable, commit the explicit incomplete attribution and continue Stage 2; Stage 5 stays blocked on complete truth.

**Acceptance:** Every received case has evidence-backed attribution or UNKNOWN. Denominators distinguish declared/received/validated/scorable cases. No misleading 100% metric can result from silently excluding missing cases.

## Stage 2 / Task 2 — AST-first declaration and context inventory

**Files**
- Modify packages/github-native-sim/src/source-intelligence-technical-v1.mjs.
- Create packages/github-native-sim/src/review-inventory-v1.mjs.
- Create packages/github-native-sim/test/review-inventory-v1.test.mjs.
- Extend packages/github-native-sim/test/source-intelligence-technical-v1.test.mjs.
- Modify docs/V7_SOURCE_INTELLIGENCE_OUTPUT_CONTRACT_v1.md at implementation time using the user's versioning/archive requirements.
- Create protocol/schemas/curveyield-review-inventory-v1.schema.json.

**Interfaces**
buildReviewInventoryV1({identity, sourceFiles, compilationUnits, admittedScope}) -> envelope with schemaVersion "curveyield-review-inventory-v1".
payload = {sourceUnits, declarations, contexts, edges, exclusions, limitations, complete}.
sourceUnits = [{sourceId,path,fileSha256,language,inScope,astStatus}].
declarations = [{symbolId,sourceId,qualifiedContainer,kind,name,canonicalSignature,visibility,implemented,anchor,astRefs,abiSignatures}].
kind = CONTRACT|FUNCTION|CONSTRUCTOR|MODIFIER|FALLBACK|RECEIVE|FREE_FUNCTION|STATE_INITIALIZER|ASSEMBLY_BLOCK|EVENT|ERROR|TYPE|CONSTANT.
contexts = [{contextId,symbolId,effectiveContractId,contextKind,dependencySymbolIds}].
contextKind = DECLARATION|INHERITED_IMPLEMENTATION|OVERRIDE_DISPATCH|GENERATED_GETTER.
edges = [{edgeId,fromContextId,toSymbolId:null|string,kind,anchor,resolution,manualObligationId:null|string}].
resolution = RESOLVED|DYNAMIC|UNRESOLVED.
limitations = [{code,sourceIds,symbolIds,blocking,reason}].
The inventory digest is artifactDigest from the common contract; downstream envelope inventoryDigest equals it.

- [ ] Write AST fixtures with one public and one internal function, one private helper, constructor, modifier, fallback, receive, free function, storage initializer, overloaded function, inherited override, generated getter, assembly block and interface-only declaration. Assert each expected kind appears, with no synthetic executable body for interface declarations.
- [ ] Add same-named contracts in different paths, duplicate compilation units, UTF-8 characters before a function and absent AST fixtures. Assert distinct qualified contracts; deduplicated identical declaration; correct byte slice; complete=false for missing in-scope AST.
- [ ] Enumerate declarations from admitted ASTs BEFORE attaching ABI entries. Build the node-to-symbol mapping across all units before resolving edges. Keep legacy functions output intact for existing consumers; add reviewInventory and reviewInventoryDigest as explicitly versioned extension fields, with matching producer/consumer schema updates.
- [ ] Define symbolId = "SYM-" + full SHA256(canonicalJSON({fileSha256,path,qualifiedContainer,kind,canonicalSignature,byteStart,byteLength})). Normalize source paths to relative POSIX form; reject absolute paths, traversal, conflicting duplicate paths and unknown source IDs.
- [ ] Define contextId analogously from symbolId, effectiveContractId and contextKind. Analyze a base body once as a declaration, but include each inherited/override dispatch context; context-specific authorization/storage interpretation must remain reviewable.
- [ ] Associate ABI selectors/getters to declarations only with compiler mapping/signature evidence. Ambiguous overload matches become limitations; never select the first same-name/arity function and call it exact.
- [ ] Include calls inside internal/private functions, modifiers, constructors, free functions and initializers. For assembly/dynamic dispatch preserve the source anchor and required manualObligationId; absence of a resolvable target is not absence of a dependency.
- [ ] Verify AST source-byte ranges against exact admitted file bytes. Derive display lines from bytes; never use JavaScript UTF-16 offsets as Solidity byte positions.
- [ ] Compare admitted source manifest to compiler source units. A security-relevant in-scope source omitted from compilation sets complete=false. An excluded dependency requires source digest, exclusion reason, boundary assumptions and separate human-review acceptance; generated/vendor labels alone do not exclude it.
- [ ] Unsupported languages remain explicitly incomplete unless an approved exact-source declaration inventory adapter exists. Do not advertise ABI fallback as full review coverage.
- [ ] Keep machine inventory neutral: it identifies declarations and candidate surfaces, not security correctness.
- [ ] Run node --test packages/github-native-sim/test/review-inventory-v1.test.mjs packages/github-native-sim/test/source-intelligence-technical-v1.test.mjs on GitHub. Fixtures consume stored AST JSON; they do not require local compilation.
- [ ] Commit and provide inventory counts by kind and completeness failures. Stop Stage 3 admission when complete=false.

**Acceptance:** All fixture declarations and invocation contexts exist; changing input enumeration order leaves digest unchanged; changing any admitted source byte changes source binding; no internal/private logic disappears because it lacks ABI exposure.

## Stage 2 / Task 3 — Deterministic bounded assignment planner

**Files**
- Create scripts/lib/lite-discovery-assignments-v1.mjs.
- Create scripts/tests/lite-discovery-assignments-v1.test.mjs.
- Create protocol/schemas/curveyield-discovery-assignment-v1.schema.json.
- Integration owner: scripts/lite-phase-packet-controller-v1.mjs; do not activate routing until Task 5 in companion 02.

**Interface**
planDiscoveryAssignmentsV1({identity, inventory, requirements, topology, config}) -> {assignments, integrationObligations, assignmentPlanDigest}.
config is controller-owned with exact defaults {maxContracts:3,maxExecutableContexts:40,maxPrimarySourceBytes:60000,maxContextSourceBytes:120000}.
assignment = envelope with schemaVersion "curveyield-discovery-assignment-v1" and payload {assignmentId,lane,primaryContextIds,contextOnlySymbolIds,sourceRefs,requirementIds,integrationObligationIds,limits,status}.
lane is A or B for independent source passes; INTEGRATION assignments are created separately after both seals.
status initially READY. All IDs are controller-generated from admitted inventory digest, lane and sorted context set.

- [ ] Write tests for 30 contracts, 41 contexts in one contract, reversed input order, one declaration exceeding 60000 bytes and a dependency closure exceeding 120000 bytes.
- [ ] Sort eligible effective contracts by normalized path/name, then contexts by byte position and contextId. Greedily fill at most 3 contracts / 40 executable contexts / 60000 primary source bytes per assignment; any limit reaching its boundary starts the next assignment.
- [ ] Count unique source-byte ranges once within each assignment. Non-executable declarations remain mapped to primary contexts or explicit declaration-review items; they cannot disappear from the denominator.
- [ ] Split large contracts at whole declaration boundaries. Retain full contract, base declarations, referenced modifiers and dependency bodies as context references. Never truncate a declaration or dependency silently.
- [ ] If a single declaration exceeds a limit, return ASSIGNMENT_OVERSIZE with the symbol and measured size. Controller creates a narrowly scoped exception request requiring a recorded plan; reviewer cannot self-increase limits.
- [ ] Include complete system topology, assets, actors, trust boundaries and requirements as compact context in every packet. Context references are readable source references, not prior reviewer conclusions.
- [ ] Create the same primary-context partition in lanes A and B with different assignment/session identities. Each required context must occur exactly once as primary per lane. Duplicate/missing primaries reject the plan.
- [ ] Create integration obligations for every cross-contract edge, unresolved target, value-flow boundary, upgrade/role handoff and shared accounting invariant present in accepted topology. Each obligation names owner contexts and source refs. This is structural integration scope, not a finding.
- [ ] Write tests asserting 100% set equality between required contexts and the union of primary contexts separately for A and B; no assignment exceeds limits without an explicit blocked exception. Changing limits changes plan identity.
- [ ] Run node --test scripts/tests/lite-discovery-assignments-v1.test.mjs on GitHub; commit assignment planner and report exact partition statistics.

**Acceptance:** A contract-count summary alone cannot pass. The exact primary-context sets reconcile; dependencies and oversized work are visible; lane B sees no lane A analysis.

## Stage delivery and resume

Deliver Stage 1 attribution even when its truth manifest is incomplete; label it accordingly. Deliver Stage 2 inventory/planner separately after verified tests. Resume at companion 02 Task 4 only after Stage 2 completeness and partition checks pass. Stage 1 missing evidence blocks qualification, not development of source coverage.
