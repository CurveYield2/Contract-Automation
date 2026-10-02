# Phase-0 Execution Data Contracts v1

## Principle

Phase-0 testing artifacts must be versioned, source-bound, deterministic, and consumable without forcing later agents to parse raw logs.

This document proposes the implementation contract. The successor may refine exact field names, but any change must remain synchronized across:

authority schema → workflow → runner → artifact renderer → controller validator → downstream derived view → tests.

## Proposed canonical artifact directory

\`<campaign>/evidence/phase0-testing/\`

### Required files

1. \`PHASE0_TEST_INVENTORY_v1.json\`
2. \`PHASE0_COVERAGE_GUIDED_FUNCTION_FUZZ_v1.json\`
3. \`PHASE0_COVERAGE_GUIDED_SEQUENCE_SIMULATION_v1.json\`
4. \`PHASE0_TEST_CORPUS_INDEX_v1.json\`
5. \`PHASE0_TEST_COVERAGE_v1.json\`
6. \`PHASE0_MACHINE_SECURITY_SIGNALS_v1.json\`
7. \`PHASE0_AUTOMATED_TESTING_SUMMARY_v1.json\`

Raw tool output may live under a subordinate \`raw/\` directory, but canonical later-phase consumers should use the structured artifacts above.

## Common identity envelope

Every canonical artifact should carry:

- \`schemaVersion\`
- \`artifactId\`
- \`campaignId\`
- \`campaignGenerationId\`
- \`sourceSha256\`
- \`buildIdentity\`
- \`buildDigestSha256\`
- \`fixtureIdentity\`
- \`chainOrForkIdentity\`
- \`toolchain\`
- \`generatedAt\`
- \`producer = PHASE0_AUTOMATION\`

## PHASE0_TEST_INVENTORY_v1.json

Purpose: exact admitted callable universe.

Suggested records:

- contract ID / qualified name;
- function ID;
- selector;
- canonical signature;
- visibility;
- mutability;
- payable;
- ABI input types;
- Source Intelligence anchors;
- privilege candidate refs;
- dependency/callback refs;
- testability status;
- exclusion reason if not testable;
- harness adapter identity.

No function may disappear silently between Source Intelligence and test inventory.

## PHASE0_COVERAGE_GUIDED_FUNCTION_FUZZ_v1.json

Per function:

- target function ID;
- corpus entry refs;
- seeds;
- actor classes exercised;
- value classes exercised;
- typed argument domains;
- cases executed;
- coverage delta;
- final coverage;
- machine signal IDs;
- blocked/limited reason;
- raw evidence refs.

## PHASE0_COVERAGE_GUIDED_SEQUENCE_SIMULATION_v1.json

Per campaign/sequence family:

- sequence family ID;
- max configured depth;
- achieved depth;
- starting fixture/snapshot;
- function transition edges;
- corpus entries;
- coverage delta;
- state-transition signatures;
- machine signals;
- minimized sequence refs;
- raw evidence refs.

## PHASE0_TEST_CORPUS_INDEX_v1.json

Each corpus entry:

- \`corpusEntryId\`;
- source/build binding;
- seed;
- starting snapshot;
- ordered transactions:
  - actor;
  - contract;
  - function ID/signature/selector;
  - typed arguments;
  - msg.value;
- coverage contribution;
- state transition contribution;
- signal refs;
- minimizedFrom / supersedes.

## PHASE0_TEST_COVERAGE_v1.json

Coverage should be multi-dimensional.

Suggested structure:

- coverage provider/tool;
- source/branch coverage;
- source/line coverage;
- contract coverage;
- function coverage;
- EVM edge/basic block coverage;
- selector transition coverage;
- state-transition coverage;
- unavailable metrics + reason;
- baseline;
- achieved;
- delta;
- plateau detection;
- uncovered high-value Source Intelligence surfaces.

## PHASE0_MACHINE_SECURITY_SIGNALS_v1.json

Each signal:

- \`signalId\`;
- \`signalClass\`;
- \`NOT_A_VALIDATED_FINDING: true\`;
- exact sequence/corpus ref;
- exact seed;
- source anchors;
- affected contract/functions;
- actor context;
- pre/post state refs;
- trace/log refs;
- coverage context;
- reproducibility;
- minimization status;
- downstream review hint;
- limitations.

## PHASE0_AUTOMATED_TESTING_SUMMARY_v1.json

This is the compact controller/later-phase view.

Suggested fields:

- inventory counts;
- tested/excluded function counts;
- function fuzz status;
- sequence simulation status;
- total executions;
- corpus size;
- coverage summary;
- signal count by class;
- minimized counterexample count;
- environment limitations;
- tool limitations;
- test budget;
- decisive artifact refs;
- downstream machine-signal view ref.

## Downstream derived view

Prefer a compact controller-generated view rather than copying raw artifacts.

Proposed:

\`derived/phase-0/PHASE4_MACHINE_SIGNAL_INPUT_v1.json\`

Contents:

- signal IDs/classes;
- affected Source Intelligence anchors;
- minimal reproducer refs;
- coverage gaps relevant to semantic review;
- no duplicated raw traces.

The Phase-4 schema/instructions should reference this as a controller input.

If a signal is primarily economic/math-related, the same canonical signal may be selected into the existing Phase-5 context by reference rather than copied into a second canonical record.

## Controller validation requirements

Phase 0 must fail closed if:

- inventory and Source Intelligence callable sets disagree without typed exclusion;
- required testing artifact missing;
- source/build identity mismatch;
- coverage guidance not active;
- retained signal lacks reproducible seed/sequence;
- raw result is referenced but absent;
- test summary claims execution of excluded functions;
- random-byte execution is counted as real-function coverage;
- a machine signal is marked as a validated finding or assigned severity.

## Authority changes required during implementation

At minimum inspect/update:

- Phase-0 contract required outputs;
- Phase-0 START_HERE/process description if user-facing;
- Source Intelligence/bundle references if test summary is admitted into the bundle;
- Phase-4 schema/controller inputs;
- Phase-5 context only if machine-signal references are selected there;
- Phase-10 final index routing for decisive retained limitations/evidence;
- shared validator policy for the new artifact contracts.

Do not introduce a new human-authored Phase-0 form: Phase 0 remains automation-only.
