# Phase 6 Fuzz Harness Requirements v3

## Mandatory execution rule

Phase 6 requires **both Medusa property/stateful fuzzing and native Foundry fuzz/invariant testing** for every admitted Solidity/EVM target, subject only to a genuine controller-recorded target/tool incompatibility. A repository-provided harness is optional; the testing stage is not.

`AUDITOR_OWNS_MISSING_FUZZ_HARNESS`: if the frozen target does not already contain a usable Medusa harness/configuration or native Foundry fuzz/invariant harness, the active Phase-6 subreviewer MUST create the missing audit-only scripts, harness contracts, configurations, fixtures, mocks, handlers, dictionaries, models, and adapters needed to exercise the frozen production source. Absence of repository-provided fuzz artifacts is **not** `NOT_APPLICABLE` and is never a reason to omit either fuzz engine.

The harness rule is subordinate to the full campaign methodology in `phases/phase-6/resources/PHASE6_FUZZ_CAMPAIGN_METHODOLOGY.md`. A technically runnable harness is insufficient if it does not support the mandatory campaign processes.

## Skeleton discovery requirement

the active Phase-6 subreviewer MUST read `phases/phase-6/resources/PHASE6_SKELETON_CODE_INDEX.md` and inspect `CurveYield2/Contract-Automation/packages/github-native-sim/harness-skeletons-v2/README_v2.md` before authoring or repairing Phase-6 fuzz harnesses. The canonical directory and every current skeleton filename are enumerated there.

A failed lookup of one path is not permission to declare the skeletons missing. While GitHub repository access is available, the reviewer MUST search `CurveYield2/Contract-Automation` for `harness-skeletons-v2` and the exact filenames listed in the index before classifying any discovery problem. Do not ask the human to locate the code.

## Existing mutable Anvil RPC requirement

Harness/config authoring MUST comply with `phases/phase-6/resources/PHASE6_MUTABLE_ANVIL_RPC_POLICY.md`. New work uses the Contract-Automation `harness-skeletons-v2` kit. A harness MUST NOT contain a usable literal RPC URL or accept a requester-selected RPC. Medusa configs must be fork-mode-oriented and fail closed until the trusted runner injects `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` plus the preflight-frozen block. Foundry configs/harnesses must not create/select an alternate fork; the trusted runner supplies the fork URL/block at invocation.

A missing, unreachable, or wrong-chain existing mutable RPC is infrastructure `FAILED`/blocked evidence and routes to repair. It is not a harness `NOT_APPLICABLE` condition and does not authorize provider substitution.

## Production-source immutability

Auditor-created fuzz artifacts MUST live outside the frozen production-source fence (for example, an audit harness/test directory or runner-staged audit overlay). They may import, deploy, wrap, mock dependencies for, model, or interact with the frozen target, but MUST NOT modify production contract logic merely to make fuzzing easier. Every harness/configuration/model must be separately hashed and bound to the exact source commit/digest it tests.

## Harness adequacy gate

A supplied or auditor-created harness is usable only when it can support the applicable Phase-6 methodology, including:

- broad security-relevant target discovery;
- property/invariant execution;
- multi-transaction state changes for stateful targets;
- boundary/dictionary value strategies;
- targeted selectors/actors when needed;
- campaign metrics/coverage sufficient for refinement;
- counterexample reproduction;
- triggered multi-actor/reference/differential work where required.

A harness that compiles/runs but causes nearly all relevant calls to revert, never changes meaningful state, or cannot exercise material security properties is **not** considered adequate merely because the tool exits successfully.

## Medusa requirements

The auditor MUST:

1. derive stateful properties/invariants and adversarial hypotheses from the sealed Phase-2–5 evidence;
2. inspect any supplied Medusa harness/configuration before reuse and reject/override any alternate RPC selection;
3. create or repair the Medusa harness/configuration when absent, unusable, or methodologically inadequate;
4. execute the Medusa portions of Campaigns A–D in the order required by `PHASE6_FUZZ_CAMPAIGN_METHODOLOGY.md`;
5. perform the mandatory coverage/corpus refinement and rerun cycle;
6. execute Medusa to a typed terminal result before native Foundry fuzz begins; and
7. preserve exact Medusa version/configuration, harness identity, seeds, fuzz-call/corpus/coverage evidence where available, counterexamples, mutable-RPC profile + frozen block/hash (never URL), status, and limitations.

A harness-construction failure is a recoverable Phase-6 execution problem first. Attempt bounded repair under the execution-repair protocol. If the required Medusa stage still cannot execute after required recovery, record `FAILED` with the exact blocker and recovery evidence. Do not convert that failure into `NOT_APPLICABLE` merely because the repository lacked a harness.

## Native Foundry fuzz/invariant requirements

After all required Medusa work reaches terminal evidence, the auditor MUST:

1. inspect any supplied Foundry fuzz/invariant tests before reuse;
2. create or repair audit-owned `testFuzz_*` tests, invariant/stateful handlers, fixtures, mocks, actor models, ghost/reference models, dictionaries, and supporting scripts when absent or unusable;
3. incorporate Medusa counterexamples, corpus observations, coverage gaps, and Phase-2–5 hypotheses into the native fuzz plan;
4. execute native Foundry portions of Campaigns B–D;
5. perform the mandatory native metrics/coverage refinement and rerun cycle;
6. execute native fuzz/invariant testing to a typed terminal result; and
7. preserve exact Forge/Foundry version/configuration, harness/test identity, seeds, runs/cases/rejects/invariant-call/handler metrics where available, mutable-RPC profile + same frozen block/hash (never URL), minimized reproductions, status, and limitations.

A native harness-construction failure follows the same repair-before-failure rule and MUST NOT become `NOT_APPLICABLE` solely because no repository-supplied fuzz tests existed.

## Allowed terminal states

For an admitted Solidity/EVM target, the normal terminal states for each required engine are `COMPLETED` or `FAILED`. `NOT_APPLICABLE` is reserved for a controller-recorded target/tool incompatibility that makes the engine genuinely inapplicable to the admitted target **after** the auditor has considered an audit-owned adapter/harness route; `TARGET_HARNESS_NOT_PRESENT` is forbidden as an inapplicability reason.

Method-level conditional statuses are governed by `PHASE6_FUZZ_CAMPAIGN_METHODOLOGY.md`: Processes 8–11 may be `NOT_TRIGGERED` only after objective trigger evaluation. Processes 1–7 may not use `NOT_TRIGGERED`.

## Phase 6 evidence gate

Phase 6 cannot seal successfully unless:

- `phases/phase-6/resources/PHASE6_FUZZ_CAMPAIGN_LEDGER.md` is populated and source-bound;
- all mandatory Processes 1–7 have valid terminal evidence;
- Processes 8–11 have explicit trigger decisions and valid terminal evidence;
- all required Medusa campaign work has terminal evidence before native Foundry starts;
- native Foundry fuzz/invariant testing has terminal evidence after Medusa;
- both engine families completed at least one deliberate refinement/rerun cycle;
- any missing supplied harnesses were replaced by auditor-created audit-only fuzz artifacts or a typed execution `FAILED` record documents why creation/execution could not be completed after required repair;
- security coverage is reconciled across code/function, property, actor, state-transition, hypothesis, and boundary dimensions; and
- the report distinguishes frozen target production source from auditor-created test/harness/model artifacts.


## v29 accounting/adversarial harness adequacy

For accounting-bearing targets, harness adequacy additionally requires the ability to execute the applicable target-bound randomized accounting attack motifs and check accounting invariants through meaningful multi-step sequences. A harness that only calls public functions randomly, uses one actor for role-sensitive state, checks invariants only at campaign end, or cannot model direct-transfer/donation/time/boundary behavior when applicable is inadequate.

Phase 6C must also provide critical-property sensitivity evidence using an audit-only mutant/fault fixture or accepted equivalent. Production source remains immutable.
