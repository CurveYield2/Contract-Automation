# Phase-0 Automated Testing System Specification v1

## 1. Objective

Extend automated Lite Phase 0 so that every admitted audit source receives broad machine security exploration **before Phase 0 seals**.

This testing is intentionally different from Phase 5.

Phase 0 asks:

> “What behavior, coverage, failures and unusual state transitions can machines discover automatically without AI semantic test design?”

Phase 5 asks:

> “Given the candidates and hypotheses identified by semantic review, what exact attacker tests and targeted fuzz campaigns should be run?”

Both are required. Phase-0 exploration must not replace Phase-5 AI-guided testing.

## 2. Hard testing rule: real functions only

Meaningful testing MUST operate through real callable functions.

Allowed execution units:

- known external/public Solidity functions;
- real receive/fallback entry points when they are intentional contract surfaces;
- constructor/deployment actions when necessary to establish a runnable fixture;
- explicitly discovered integration callbacks when callable in the admitted environment.

Random argument generation MUST be ABI typed.

Stateful sequence generation MUST select real functions and build real transactions.

Do not award coverage credit for arbitrary random byte payloads that do not intentionally target a known function.

If an underlying fuzzer internally mutates bytes, its harness must still decode/route them into admitted real-function calls. The security campaign is defined in terms of function calls, not uninterpreted calldata.

## 3. Coverage guidance is mandatory

Phase 0 is **always coverage-guided**.

The system MUST use feedback to prioritize/mutate future executions.

Preferred feedback order:

1. source branch coverage;
2. source line coverage;
3. contract/function coverage;
4. EVM basic-block/edge coverage;
5. selector/function transition coverage;
6. new persistent-state transition signatures.

When compiler/source coverage is unavailable, the run must fall back to the strongest mechanically available coverage signal. It must never silently become unguided random execution.

The result artifact must state which coverage classes were available and which guided the corpus.

## 4. Test families

### 4.1 Coverage-guided function fuzzing

Goal: exercise each admitted public/external function across typed argument space and actor/value contexts.

For each function:

- generate ABI-valid arguments;
- prioritize boundary values;
- vary caller identities;
- vary msg.value only when payable;
- vary relevant pre-state by reusing/adapting reachable corpus states;
- feed new-coverage inputs back into the corpus;
- preserve deterministic seed and exact call encoding.

Boundary seeds SHOULD include mechanically valid cases such as:

- zero;
- one;
- maximum/minimum values for integer widths;
- ±1 around discovered constants/thresholds where type-safe;
- empty/singleton/max-practical dynamic collections;
- zero address;
- contract addresses;
- known actors/admins/dependencies;
- current balances/allowances and ±1 where derivable;
- discovered timestamps/deadlines and boundary offsets where derivable.

Do not invent protocol-specific correctness assertions at this layer.

### 4.2 Coverage-guided stateful sequence simulation

Goal: discover behavior that only appears after multi-transaction state transitions.

Generate sequences of real functions:

\`f1(args1, actor1) → f2(args2, actor2) → ... → fn(argsn, actorn)\`

Coverage feedback MUST influence:

- next function choice;
- mutation of sequence length;
- argument mutation;
- actor choice;
- value transfer choice;
- retained starting state/snapshot.

The system should begin with short sequences and grow only when additional depth earns new coverage/state-transition value.

The execution engine must retain the shortest reproducing sequence for anomalies/counterexamples.

### 4.3 Access/authority probing

Using Source Intelligence privilege candidates and controller-discovered roles:

- call privileged-looking functions from non-authorized actor classes;
- record success/revert behavior;
- record state delta;
- never declare “access control vulnerability” automatically;
- produce a neutral signal for semantic review when an apparently privileged operation succeeds for an unexpected actor.

### 4.4 Dependency and callback exploration

When external interfaces/callback surfaces are identified:

- execute admitted callback/integration entry points where the harness can do so safely;
- vary dependency return/revert behavior when a deterministic mock/fork fixture already exists;
- record dependency-induced state/error transitions;
- do not fabricate a fake production integration and treat it as production evidence.

### 4.5 Automatically derivable standards probes

Only when standards/interface identity is mechanically high-confidence, run generic compliance/behavior probes that do not require protocol-specific assumptions.

Every such probe must record its basis, for example:

- exact implemented interface;
- compiler ABI signature set;
- inherited known standard contract;
- explicit source declaration.

A standards probe failure is a machine signal, not an audit finding.

## 5. Corpus model

Maintain a versioned Phase-0 testing corpus.

Each retained seed/sequence requires:

- corpus entry ID;
- source/build identity;
- campaign/generation;
- deterministic random seed;
- actor set;
- starting snapshot/fixture identity;
- ordered function IDs/selectors;
- typed decoded arguments;
- msg.value per transaction;
- coverage contribution;
- state-transition contribution;
- anomaly/counterexample refs;
- minimized replacement entry if minimization succeeds.

Corpus retention policy:

retain an input if it causes at least one of:

- new coverage;
- new function-transition edge;
- new persistent-state transition signature;
- new panic/assert/revert class worth preserving;
- new machine anomaly;
- shorter reproduction of an existing signal.

## 6. Neutral machine signal policy

Phase 0 MUST NOT generate vulnerability findings or severities.

Allowed machine signal classes include:

- Solidity panic/assert;
- unexpected EVM execution failure;
- deterministic crash/internal execution failure;
- surprising authorization success candidate;
- state-transition anomaly;
- unexpected external-call/reentrancy shape candidate;
- standard-probe deviation;
- repeated liveness/revert region;
- coverage gap;
- environment/deployment/configuration blocker;
- minimizable counterexample.

Every signal needs:

- exact source/build identity;
- exact fixture/snapshot;
- exact call sequence;
- seed/corpus ID;
- raw trace/log ref;
- coverage context;
- reproducibility count;
- machine classification;
- explicit \`NOT_A_VALIDATED_FINDING\`.

Semantic phases decide security significance.

## 7. Reproducibility

Every retained failure/signal MUST be reproducible by exact seed or serialized sequence.

Required identity binding:

- campaign ID/generation;
- source archive SHA-256;
- build identity/digest;
- compiler/config identity;
- deployment/config fixture identity;
- chain/fork/block identity when applicable;
- tool versions;
- runner version;
- corpus entry;
- seed;
- exact ordered calls.

Randomness without a reproducible seed is not admissible evidence.

## 8. Minimization

For each retained counterexample/signal, attempt:

1. sequence-length minimization;
2. removal of irrelevant prefix transactions;
3. argument shrinking;
4. actor simplification;
5. value simplification;
6. fixture simplification when safe.

Store both original and minimized refs if minimization changes the reproducer.

## 9. Environment strategy

Use the strongest admitted environment available from existing Phase-0 automation.

Priority:

1. exact project test/deployment fixture already runnable;
2. exact discovered deployment scripts/config;
3. deterministic local fixture assembled from admitted source/config without semantic invention;
4. typed blocked/limited result when no safe executable environment can be produced.

Never hide deployment/configuration uncertainty by synthesizing a convenient environment and calling it exact.

## 10. Tool integration

Prefer extension of existing Contract-Automation execution infrastructure.

Expected reuse targets include:

- github-native-sim V7 runner;
- existing Foundry support;
- existing Medusa support;
- existing build identity and readiness outputs;
- existing deploy/config execution;
- existing evidence ingestion/observer patterns;
- existing workflow qualification.

Medusa/Foundry campaigns must be configured around actual function/harness calls.

Do not create a second evidence-ingestion architecture.

## 11. Phase-0 execution order

Recommended order inside Phase 0:

1. source initialization;
2. build/source identity;
3. automated Source Intelligence;
4. static analysis/SBOM/readiness;
5. deployment/configuration execution;
6. generate Phase-0 real-function test inventory/harness;
7. coverage-guided function fuzzing;
8. coverage-guided stateful sequence simulation;
9. minimize retained counterexamples;
10. materialize testing artifacts;
11. integrate neutral signals/coverage references into Phase-0 canonical views;
12. final Phase-0 validation/seal;
13. prepare Phase-1 assignment.

All machine work happens before Phase-0 seal.

## 12. Downstream routing

Avoid copying large raw results into every phase.

Canonical ownership:

- raw machine testing artifacts remain in the Phase-0 testing evidence directory;
- Source Intelligence / Phase-0 audit-surface artifacts contain references and summarized neutral signal IDs;
- Phase 4 receives the relevant machine-signal view for semantic source/security review;
- Phase 5 receives only economically/security relevant candidate context needed for AI-guided test design;
- Phase 6 may reference Phase-0 machine evidence when interpreting later target execution, but does not re-bookkeep it;
- Phase 10 final index carries decisive evidence/limitations by reference.

## 13. Required limitations

The final Phase-0 testing summary MUST explicitly disclose:

- contracts/functions that could not be instantiated;
- functions excluded and exact reason;
- unavailable coverage classes;
- tool failures;
- fork/environment limitations;
- unsupported ABI/type patterns;
- stateful depth/time budget;
- campaigns that terminated early;
- whether coverage plateaued;
- any signals that could not be reproduced/minimized.

## 14. Resource/budget controls

The system may impose deterministic budgets, but must record them.

Budgets should be expressed in machine terms:

- wall-clock cap;
- calls/cases;
- corpus size;
- maximum sequence depth;
- per-target timeout;
- coverage-plateau threshold.

A budget is a limitation, not evidence of complete security coverage.

## 15. Security conclusion boundary

Phase-0 automation may say:

- “this sequence triggered panic X”;
- “this actor successfully called surface Y”;
- “coverage reached Z”;
- “this candidate was reproducible N/N times”;
- “this region remained uncovered.”

It may NOT say:

- “Critical vulnerability”;
- “safe”;
- “exploit confirmed”;
- “no vulnerability exists”;
- “severity = ...”.

Those require later semantic audit judgment.
