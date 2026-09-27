# Phase 6 Fuzz Campaign Methodology v2

## Purpose

This reference is the normative Phase-6 campaign methodology for admitted Solidity/EVM targets. It converts the sealed Phase-2–5 analytical record into reproducible adversarial automation while preserving the Audit V7 source fence, evidence identity, sequential-reviewer boundary, and Medusa-before-native-Foundry ordering.

### Mandatory existing mutable-Anvil binding

All Phase-6 fork-state and mutable-RPC work MUST also comply with `phases/phase-6/resources/PHASE6_MUTABLE_ANVIL_RPC_POLICY.md`. The auditor does not choose an RPC provider. The trusted Contract-Automation runner reuses `SIM_ARCHIVE_PRIMARY_ETHEREUM_01`, freezes its observed Ethereum block number/hash at preflight, forces Medusa fork mode on that identity, and binds native Foundry to the same identity. Alternate/requester RPCs and parallel fork systems are prohibited. Missing/unreachable mutable RPC infrastructure is `FAILED`/blocked infrastructure, never `NOT_TRIGGERED` or `NOT_APPLICABLE`.


The core rule is:

> **Broad discovery and targeted adversarial fuzzing are complementary and non-substitutable.** A broad randomized campaign does not satisfy the targeted campaign requirement, and a targeted campaign does not satisfy the broad discovery requirement.

Phase 6 is successful because the auditor executed the required process competently and produced reproducible evidence. **“No bug found” is not itself evidence of successful auditor performance.** Conversely, a valid security finding does not mean the audit process failed. Process status and finding severity remain separate axes.

Read together with:

- `phases/phase-6/resources/PHASE6_FUZZ_HARNESS_REQUIREMENTS.md`
- `shared/execution/EXECUTION_PREFLIGHT_AND_REPAIR_PROTOCOL.md`
- `phases/phase-6/resources/PHASE6_FUZZING_EXTERNAL_REFERENCES.md`
- `phases/phase-6/resources/PHASE6_FUZZ_CAMPAIGN_LEDGER.md`
- `phases/phase-6/START_HERE.md`

## Mandatory Phase-6 campaign tree

The logical campaign model has four stages:

```text
PHASE6_EXECUTION_PREFLIGHT
        |
        v
CAMPAIGN A — DISCOVERY
Broad randomized Medusa exploration
        |
        v
COVERAGE / CORPUS GATE A
What was reached? What was not? Why?
        |
        v
CAMPAIGN B — PROPERTY + STATE MACHINE
Human-derived invariants
Semi-targeted randomized testing
Stateful transaction sequences
Boundary/dictionary-directed values
        |
        v
COVERAGE / MODEL GATE B
Refine harness, actors, state, selectors, values, depth
        |
        v
CAMPAIGN C — TARGETED ADVERSARIAL
Attack-hypothesis-specific fuzz campaigns
        |
        v
CAMPAIGN D — ASSURANCE ESCALATION
Triggered multi-actor / reference-model /
differential / advanced corpus + deep campaigns
        |
        v
SECURITY-SURFACE RECONCILIATION
        |
        v
PHASE6 EVIDENCE SEAL
```

### Mandatory engine-order timeline

The campaign tree is logical; engine ordering is physical and strict. **All required Medusa work reaches terminal evidence before native Foundry fuzz/invariant execution begins.** Therefore execute the logical stages in this engine-safe order:

```text
1. Phase-6 preflight + campaign plan + existing mutable-Anvil RPC identity/block freeze
2. Campaign A-M: broad Medusa discovery in mandatory fork mode on the preflight-frozen mutable Anvil identity
3. Gate A: coverage/corpus/security-surface review
4. Campaign B-M: Medusa property/stateful/boundary campaign
5. Gate B-M: mandatory Medusa refinement + rerun
6. Campaign C-M: Medusa targeted-adversarial campaigns
7. Campaign D-M: triggered Medusa corpus/depth/escalation work
8. Seal terminal Medusa evidence
9. Campaign B-F: native Foundry testFuzz + invariant/stateful campaign on the same preflight-frozen mutable Anvil identity
10. Gate B-F: native metrics/coverage review + refinement/rerun
11. Campaign C-F: native Foundry targeted-adversarial campaigns
12. Campaign D-F: triggered multi-actor/model/differential/deep native work
13. Final multi-dimensional security-surface reconciliation
14. Phase-6 evidence seal and phase report
```

Native Foundry MUST consume Medusa counterexamples, coverage gaps, corpus observations, suspicious state transitions, and unresolved hypotheses, but it MUST remain a genuinely distinct native campaign rather than a mechanical replay of Medusa only.

## Process status vocabulary

### Always-mandatory processes

Processes 1–7 MUST terminate as one of:

- `COMPLETED` — success criteria are met and evidence is sealed.
- `FAILED` — required process could not be completed after required bounded repair, or the auditor materially violated its execution contract.

`NOT_TRIGGERED` is invalid for Processes 1–7. `NOT_APPLICABLE` is allowed only under the narrow target/tool incompatibility rules in `PHASE6_FUZZ_HARNESS_REQUIREMENTS.md`; missing repository tests/harnesses are never an applicability waiver.

### Trigger-mandatory processes

Processes 8–11 MUST first receive an applicability/trigger decision. Their valid terminal states are:

- `COMPLETED` — trigger fired and required method was executed successfully.
- `FAILED` — trigger fired but required execution failed after bounded repair, or the auditor failed to execute it correctly.
- `NOT_TRIGGERED` — objective trigger criteria were evaluated and demonstrably absent; rationale and evidence are recorded.

`NOT_TRIGGERED` MUST NOT mean “too expensive,” “probably unnecessary,” “the broad campaign passed,” or “the repository did not provide a harness.”

## Cross-cutting execution standards

### A. Production source remains frozen

All fuzz harnesses, handlers, adapters, models, dictionaries, configs, and scripts created by the auditor are audit-only artifacts outside the frozen production-source fence. They may deploy, wrap, model, mock, or interact with production contracts. They MUST NOT alter production logic simply to increase coverage.

### B. Reachability must be honest

Do not claim a vulnerability reachable if the fuzzer reached it only through impossible direct storage mutation, impossible actor permissions, or a setup state that cannot arise from valid protocol transitions. Artificial state setup is permitted for isolated property probing only when clearly labeled and separately followed by realistic reachability analysis.

### C. Reproducibility is mandatory

For each campaign preserve, where supported:

- exact source commit/digest;
- harness/config/model digest;
- exact Medusa or Foundry version;
- mutable-RPC profile name (`SIM_ARCHIVE_PRIMARY_ETHEREUM_01` for the admitted Ethereum path), preflight-frozen fork block number/hash, and proof that the URL itself was not persisted;
- runner/execution-profile identity;
- target contracts/selectors/interfaces;
- sender/actor set;
- initial state/fixture identity;
- seed(s);
- run/depth/call/time configuration;
- corpus input/output identity;
- property/invariant/hypothesis IDs;
- coverage/metrics output;
- counterexamples and minimized reproductions;
- status and limitations.

### D. Security coverage, not line coverage alone

Phase 6 MUST reconcile at least these coverage dimensions:

1. code/instruction/basic-block coverage where the engine exposes it;
2. contract/function/selector coverage;
3. invariant/property coverage;
4. actor/authority coverage;
5. state-transition/lifecycle coverage;
6. threat/hypothesis coverage;
7. numerical/time/boundary coverage;
8. dependency/integration coverage that is expressible in Phase 6.

No arbitrary code-coverage percentage alone proves completion. High line coverage with untested security-critical actors, transitions, or hypotheses is insufficient.

### E. Campaign duration is risk-driven

There is no universal run count or time value that proves safety. Baseline campaigns must be long/deep enough to demonstrate meaningful state exploration and stable coverage behavior. Escalate when trigger criteria require it. Record when compute/time constraints leave residual risk.

### F. Counterexamples are inputs to analysis, not automatic findings

Every counterexample enters candidate validation. Minimize/reproduce where supported, determine whether the state is reachable, distinguish harness bugs from production bugs, and preserve the smallest reliable reproduction.

---

# Process 1 — Broad randomized exploration

**Class:** ALWAYS MANDATORY  
**Primary engine:** Medusa  
**Campaign node:** A-M

## Objective

Discover reachable behavior and interaction paths that the human analysis did not predict before aggressively constraining the state space.

## Optimal execution

1. Start from the exact frozen target and a realistic initial deployment state.
2. Target the full security-relevant in-scope contract surface rather than only functions already suspected by the auditor.
3. Include all materially reachable state-changing entry points unless a specific exclusion is justified and recorded.
4. Avoid prematurely restricting `targetFunctionSignatures`/selectors to only known-risk functions.
5. Enable coverage guidance and preserve the coverage-increasing corpus.
6. Use Medusa/Slither constant extraction or equivalent interesting-value mining when supported.
7. Configure call-sequence length/depth sufficient to exercise multi-step state behavior rather than only single-call behavior.
8. Use a realistic sender set when different callers can alter behavior.
9. Record initial coverage and security-surface reachability, not merely aggregate execution counts.

## Auditor success

`COMPLETED` requires evidence that:

- a genuinely broad campaign ran against the admitted target;
- security-relevant callable surfaces were not silently excluded;
- corpus/coverage evidence was preserved where available;
- coverage gaps and unexpectedly unreachable functions/states were identified for Gate A;
- the auditor did not mistake absence of a counterexample for proof of safety.

## Auditor failure

Record `FAILED` when, after bounded repair, the auditor:

- skips broad discovery and begins only with hand-picked attack targets;
- runs only a smoke-sized campaign incapable of meaningful exploration without documenting a process blocker;
- silently excludes material contracts/functions/actors;
- cannot produce source/config/run identity;
- treats high aggregate execution count as sufficient without reviewing reached surfaces;
- allows a missing supplied harness to suppress the campaign.

---

# Process 2 — Human-derived property and invariant fuzzing

**Class:** ALWAYS MANDATORY  
**Primary engines:** Medusa, then native Foundry  
**Campaign node:** B-M and B-F

## Objective

Convert the sealed security model into executable falsification targets. The fuzzer should search for counterexamples to what the protocol is required to preserve.

## Optimal execution

1. Map Phase-2 security properties, Phase-3 threats, Phase-4 implementation concerns, and Phase-5 economic/math properties into stable property IDs.
2. Express invariants at the highest useful semantic level: solvency, conservation, authorization, monotonicity, accounting consistency, fee caps, share/debt/reward correctness, state-machine safety, and liveness proxies where expressible.
3. Prefer properties that do not simply restate the production implementation.
4. Separate global invariants from state-specific invariants when protocol modes differ.
5. Avoid conditional assertions that accidentally disable checking for most of a campaign; prefer explicit state-specific properties/harnesses.
6. Include before/after function-level assertions where an invariant alone can hide local accounting errors.
7. Ensure each material Phase-2–5 property is either fuzz-tested or explicitly mapped to another evidence method with rationale.

## Auditor success

`COMPLETED` requires:

- a property/invariant matrix tied to sealed Phase-2–5 evidence;
- each fuzzable material property implemented and exercised;
- failed properties minimized/reproduced or classified as harness/model defects with evidence;
- non-fuzzed material properties explicitly routed elsewhere rather than silently omitted.

## Auditor failure

Record `FAILED` when the auditor:

- uses only generic properties unrelated to the target;
- copies production formulas into the “expected” side without independence analysis;
- omits material security properties from automation without routing/rationale;
- writes invariants that are never meaningfully asserted because preconditions always short-circuit;
- accepts invariant “PASS” despite metrics showing the relevant handlers/functions were never reached.

---

# Process 3 — Semi-targeted randomized fuzzing

**Class:** ALWAYS MANDATORY  
**Primary engines:** Medusa, then native Foundry  
**Campaign node:** B-M/B-F and C-M/C-F

## Objective

Use human security reasoning to constrain the *meaningful attack surface* while preserving randomized values, callers, and/or transaction ordering within that surface.

## Optimal execution

1. Choose a security-relevant component, property, or hypothesis.
2. Narrow targets only enough to increase depth on that area; retain multiple meaningful transitions and randomized inputs.
3. Use targeted contracts/selectors/senders/handlers where supported.
4. Keep entropy inside the target: values, actors, order, repetitions, timing, or combinations should remain generated/mutated.
5. Run complementary bounded and unbounded input strategies when bounds could hide behavior.
6. Compare results against the broad campaign to ensure targeting did not accidentally delete important transitions.

## Auditor success

`COMPLETED` requires at least one documented semi-targeted campaign family whose target selection is justified by the threat/property model and whose execution still performs randomized exploration.

## Auditor failure

Record `FAILED` when the auditor:

- equates a deterministic unit test with fuzzing;
- removes essentially all randomness from a “targeted fuzz” campaign;
- over-constrains selectors/actors/values so the attack state cannot vary;
- uses `vm.assume`/bounds/preconditions so aggressively that most meaningful adversarial inputs are discarded;
- cannot explain why the targeted surface was selected.

---

# Process 4 — Stateful transaction-sequence fuzzing

**Class:** ALWAYS MANDATORY for admitted stateful Solidity/EVM protocols; a genuinely stateless/pure target requires a typed target-level `NOT_APPLICABLE` decision under the harness policy.  
**Primary engines:** Medusa call sequences, Foundry invariant/handler campaigns  
**Campaign node:** B-M and B-F

## Objective

Discover vulnerabilities that require a sequence of valid state transitions rather than one isolated call.

## Optimal execution

1. Build a state-transition inventory from public/external state-changing entry points and protocol lifecycle actions.
2. Include meaningful repeated operations (deposit/withdraw, mint/redeem, borrow/repay, stake/claim, vote/execute, bridge/send/receive, etc.).
3. Set sequence depth/call length high enough to reach deep states.
4. Use handler logic to make calls valid enough that the fuzzer changes meaningful state instead of spending most calls reverting.
5. Also retain an unbounded/hostile mode where invalid or surprising calls are security-relevant.
6. Assert invariants after transitions and use function-level assertions around critical steps.
7. Preserve failing transaction sequences and minimize them without changing reachability semantics.

## Auditor success

`COMPLETED` requires evidence of randomized multi-transaction sequences that materially changed protocol state and checked properties across those changes.

## Auditor failure

Record `FAILED` when:

- only stateless `testFuzz_*` functions are executed against a stateful protocol;
- sequence depth is nominally >1 but metrics show meaningful state never changes;
- handlers cause persistent reverts/discards and the auditor does not repair them;
- a discovered failure depends on impossible direct state mutation but is reported as reachable without validation.

---

# Process 5 — Coverage-guided refinement and mandatory rerun

**Class:** ALWAYS MANDATORY  
**Primary engines:** Medusa and native Foundry metrics/coverage  
**Campaign node:** Gate A, Gate B-M, Gate B-F

## Objective

Prevent one-shot fuzz execution from becoming a checkbox. Use observed gaps to change the harness/configuration and conduct at least one deliberate refinement/rerun cycle.

## Optimal execution

1. After the first broad Medusa run, inspect code/function/selector/property/actor/state/hypothesis/boundary coverage.
2. Identify security-relevant gaps and classify why they were not reached: initialization, permissions, value distribution, sequence depth, target selection, reverts, dependency setup, timing, or genuine unreachability.
3. Make a justified audit-harness/config change: seed corpus, alter initialization, add actors, add handlers, change call depth, target selectors, tune bounds, add boundary values, or create a focused property.
4. Rerun and compare before/after metrics.
5. Repeat when a material high-risk gap remains and the additional work is technically feasible.
6. For Foundry, review handler-call/revert/discard metrics and refine targets/handlers; do not accept a passing invariant campaign where most calls revert.
7. Preserve the original and refined campaign evidence separately.

A rerun is mandatory even if the first campaign looks healthy. If no material gap is found, vary at least seed(s), sequence depth, actor distribution, or another meaningful campaign dimension and confirm stability.

## Auditor success

`COMPLETED` requires:

- a documented initial coverage review;
- at least one intentional refinement/rerun cycle per required engine family;
- before/after metrics or qualitative surface reconciliation;
- explicit residual gaps and limitations after refinement.

## Auditor failure

Record `FAILED` when the auditor:

- runs each engine once and stops;
- observes an important uncovered branch/state/actor and does not attempt to improve reachability;
- reports only a line-coverage percentage without security-surface analysis;
- changes the production source instead of the audit harness/configuration;
- discards the original run evidence, preventing comparison.

---

# Process 6 — Targeted adversarial fuzz campaigns

**Class:** ALWAYS MANDATORY  
**Primary engines:** Medusa, then native Foundry where technically expressible  
**Campaign node:** C-M and C-F

## Objective

Turn material attack hypotheses from manual review into focused randomized attempts to falsify protocol security.

## Optimal execution

1. Build a hypothesis register from Phase-2–5 evidence and Campaign A/B observations.
2. For every material hypothesis, assign exactly one primary disposition:
   - `TARGETED_FUZZ`;
   - `DETERMINISTIC_SIMULATION`;
   - `STATIC_OR_MANUAL_PROOF`;
   - `NOT_APPLICABLE_WITH_REASON`.
3. Every hypothesis assigned `TARGETED_FUZZ` receives a dedicated campaign definition containing:
   - hypothesis ID;
   - target contracts/functions/selectors;
   - actor roles;
   - required starting state;
   - relevant value/boundary classes;
   - sequence motifs;
   - falsification property/oracle;
   - engine(s) used;
   - success/failure evidence.
4. Preserve randomness inside the selected attack surface.
5. Target repeated/extractive patterns where economically relevant, not only a single attack step.
6. Convert counterexamples into deterministic reproductions for Phase 8 validation where appropriate.

## Auditor success

`COMPLETED` requires:

- a complete material-hypothesis disposition map;
- dedicated fuzz campaigns for fuzzable high-risk hypotheses;
- reproducible evidence for each executed campaign;
- no material hypothesis silently dropped because broad fuzzing already passed.

## Auditor failure

Record `FAILED` when:

- broad fuzzing is used as a substitute for attack-hypothesis campaigns;
- hypotheses are listed but not executed/routed;
- the “targeted” campaign is actually a fixed deterministic test with no fuzz dimension;
- the auditor targets only the suspected function while excluding prerequisite/adjacent state transitions needed to reveal the bug family;
- a high-risk fuzzable hypothesis is omitted solely for compute convenience without a process limitation/failure record.

---

# Process 7 — Boundary and dictionary-directed fuzz generation

**Class:** ALWAYS MANDATORY  
**Primary engines:** Medusa value mining/dictionaries and native Foundry handlers/fuzz tests  
**Campaign node:** B-M, C-M, B-F, C-F

## Objective

Concentrate randomized testing around constants and transition boundaries where smart-contract bugs disproportionately occur.

## Optimal execution

Build a boundary dictionary from source, specification, configuration, and Phase-5 math/economic analysis. Include as applicable:

- `0`, `1`, and near-zero dust;
- type minima/maxima and realistic operational maxima;
- threshold `-1`, threshold, threshold `+1`;
- fee/ratio/basis-point caps and neighboring values;
- decimal-scaling transitions;
- share/asset conversion rounding boundaries;
- collateral/LTV/liquidation thresholds;
- reward-period start/end and checkpoint boundaries;
- timestamp/block-number boundaries;
- minimum/maximum deposit/withdraw/borrow/repay values;
- exact constants mined from source/AST/Slither;
- addresses/roles with special semantics;
- empty/single/max-length arrays or proof structures;
- repeated-operation counts around meaningful limits.

Use dictionaries/constant mining where the engine supports them. In Foundry, combine targeted values with random values rather than replacing randomness entirely.

## Auditor success

`COMPLETED` requires a recorded boundary dictionary tied to security-relevant source/spec/math facts and evidence those classes were exercised in the relevant campaigns.

## Auditor failure

Record `FAILED` when:

- the auditor relies only on uniform/random `uint256` generation for threshold-heavy logic;
- critical Phase-5 numerical boundaries are not transferred into Phase 6;
- bounds exclude the very edge cases under review;
- source constants are known but never introduced into the fuzz value strategy without justification.

---

# Process 8 — Explicit multi-actor state-machine model

**Class:** TRIGGER-MANDATORY

## Trigger

Triggered when security materially depends on any of:

- caller identity or privilege;
- cross-user balance/accounting interactions;
- owner/governance/keeper/reward-distributor/oracle roles;
- victim/attacker sequencing;
- delegation, approvals, permits, callbacks, or transfer hooks;
- liquidation between parties;
- share/reward redistribution;
- bridge sender/receiver roles;
- role changes or authority transitions.

Most nontrivial DeFi systems will trigger this process.

## Optimal execution

1. Define named actor classes and their initial authority/balances.
2. Map permitted and forbidden actions per actor.
3. Randomize actor selection within realistic role constraints.
4. Include attacker/victim interaction where value can move between users.
5. Include authority changes if governance/ownership is in scope.
6. Track actor-specific ghost state where useful.
7. Ensure actor setup does not accidentally grant attackers impossible privileges.

## Auditor success

`COMPLETED` requires evidence that role-sensitive behavior was fuzzed across multiple actors and that actor-specific invariants/permissions were checked.

`NOT_TRIGGERED` requires a reasoned demonstration that caller identity and cross-actor state cannot materially affect the target's security behavior.

## Auditor failure

Record `FAILED` when the trigger exists but the auditor fuzzes only from one default account, or uses arbitrary senders without preserving role semantics, causing meaningless or unreachable states.

---

# Process 9 — Independent ghost/reference model

**Class:** TRIGGER-MANDATORY

## Trigger

Triggered when a material security property can be modeled independently at proportionate cost, especially for:

- accounting/conservation;
- rewards/emissions;
- fee calculation;
- vault shares/assets;
- debt/interest;
- exchange rates;
- liquidation amounts;
- voting weights;
- bridge message/accounting state;
- mathematically defined AMM or pricing behavior.

It is also triggered when direct on-chain invariants are too weak because both sides of an assertion come from the same implementation state.

## Optimal execution

1. Maintain expected state in harness-owned ghost variables or a separate model.
2. Update expected state from the known semantics of successful transactions, not by rereading the production value being checked.
3. Prefer a conceptually independent formulation when possible (e.g., high-precision math, alternative algorithm, external specification).
4. Reconcile model state against on-chain state after flows and at campaign checkpoints.
5. Treat model divergence as a candidate requiring investigation; the model may be wrong.

## Auditor success

`COMPLETED` requires a materially independent expected-state model for triggered properties and evidence of repeated comparison across randomized state transitions.

`NOT_TRIGGERED` requires a recorded reason that no material property can be independently modeled at proportionate cost or that such a model would be non-independent/duplicative and add no assurance.

## Auditor failure

Record `FAILED` when the trigger exists but the auditor avoids the model without rationale, or when the “reference” merely calls/copies the same production implementation and is represented as independent evidence.

---

# Process 10 — Differential fuzzing

**Class:** TRIGGER-MANDATORY

## Trigger

Triggered when a trustworthy comparison target exists or can reasonably be built, including:

- upstream protocol behavior for a fork where behavior should remain unchanged;
- previous vs new version;
- optimized vs reference implementation;
- Solidity vs independent Python/Go/math implementation;
- implementation vs normative standard/specification;
- two independent implementations of the same parser/verifier/math function.

## Optimal execution

1. Define exactly which behavior is expected to be equivalent and which intentional differences are excluded.
2. Feed the same randomized inputs/state transitions to both sides when semantics permit.
3. Normalize outputs/reverts/events/state before comparison where representation differs.
4. Compare not only return values but material state transitions and asset movement where feasible.
5. Minimize divergences and classify whether they reveal a production bug, reference bug, or intended difference.
6. Bind the reference implementation/version/commit as evidence.

## Auditor success

`COMPLETED` requires a valid independent comparison target, randomized comparative execution, and explicit divergence handling.

`NOT_TRIGGERED` requires evidence that no trustworthy independent reference/specification exists or that constructing one would be disproportionate and non-independent.

## Auditor failure

Record `FAILED` when the trigger exists but is skipped, when the comparison target is stale/untrusted, or when intentional differences are not scoped and produce meaningless divergence noise.

---

# Process 11 — Advanced corpus engineering and deep-campaign escalation

**Class:** TRIGGER-MANDATORY

## Trigger

Triggered by any of:

- security-critical coverage plateau/gap after normal refinement;
- suspicious near-failure or unstable property behavior;
- difficult-to-reach high-impact state;
- high-risk hypothesis not adequately resolved by baseline campaigns;
- counterexample suggesting a broader bug family;
- Medusa/Foundry disagreement;
- complex state machine where deeper sequences remain materially unexplored;
- material residual risk that additional compute is reasonably likely to reduce.

## Optimal execution

As appropriate:

1. Preserve and seed coverage-increasing/counterexample corpora.
2. Add known meaningful transaction-sequence seeds.
3. Increase call-sequence depth/runs/time/campaign count.
4. Vary seeds and actor distributions.
5. Narrow targets only after preserving a broad corpus baseline.
6. Create specialized initialization to make a difficult but reachable state accessible.
7. Run multiple independent seeds/campaigns rather than one monolithic seed when useful.
8. Track coverage/residual-risk progress over time and stop only when marginal assurance gain is low or resource limits are explicitly recorded.

## Auditor success

`COMPLETED` requires evidence that the trigger was addressed with a proportionate escalation and that resulting coverage/counterexamples/residual gaps were reviewed.

`NOT_TRIGGERED` requires evidence that baseline/refined campaigns left no unresolved condition meeting the trigger criteria.

## Auditor failure

Record `FAILED` when the trigger exists but the auditor stops solely because a nominal default run count completed; when corpus evidence is discarded; or when extended compute is spent without a defined security objective, coverage metric, or stopping rationale.

---

# Campaign gates and success/failure rules

## Gate A — broad discovery review

The auditor MUST answer:

1. Which contracts/functions/selectors changed meaningful state?
2. Which were never/rarely reached?
3. Which actors/roles were exercised?
4. Which security properties were touched?
5. Which high-risk transitions remained absent?
6. Which boundary classes were observed?
7. What did the corpus learn that was not in the initial plan?
8. What exact refinement will be made before rerun?

**Gate success:** answers are evidence-backed and produce a deliberate refinement plan.  
**Gate failure:** “coverage looks good” or a single percentage is used without surface reconciliation.

## Gate B — property/state-machine quality review

The auditor MUST inspect:

- property assertion execution;
- handler/flow call counts;
- revert/discard rates;
- actor distribution;
- state transition diversity;
- depth/runs;
- boundary hit evidence;
- ghost/reference model consistency when triggered;
- uncovered hypotheses/surfaces.

**Gate success:** the campaign is demonstrably exercising the intended protocol states and the auditor refines weak areas.  
**Gate failure:** invariants pass because handlers revert, assumptions discard most values, or state never meaningfully changes.

## Gate C — targeted-adversarial completion

Every material hypothesis MUST have a disposition and supporting evidence.

**Gate success:** all material hypotheses are fuzzed or deliberately routed to another valid evidence method.  
**Gate failure:** any material hypothesis is silently untested, or broad fuzzing is cited as its only coverage without target-specific reasoning.

## Gate D — trigger assessment

The auditor MUST separately evaluate Processes 8–11 and record `COMPLETED`, `FAILED`, or `NOT_TRIGGERED` with evidence.

**Gate success:** objective triggers were evaluated and triggered methods executed.  
**Gate failure:** conditional methods are skipped by preference, cost avoidance, or vague “not needed” prose.

# Final Phase-6 security-surface reconciliation

Phase 6 cannot seal as successful until `PHASE6_FUZZ_CAMPAIGN_LEDGER` shows:

- Processes 1–7 have valid terminal evidence;
- Processes 8–11 have trigger decisions and valid terminal evidence;
- Medusa completed all required work before Foundry began;
- at least one refinement/rerun cycle occurred for Medusa and native Foundry;
- every material Phase-2–5 fuzzable security property/hypothesis is mapped;
- security coverage dimensions are reconciled;
- counterexamples are preserved and routed to validation;
- residual gaps/limitations are explicit;
- audit-created harness/model artifacts are separately hashed/source-bound;
- no production source was changed to make fuzzing easier.

A Phase-6 process `FAILED` blocks successful Phase-6 sealing unless the controller records an allowed typed limitation under the active V7 limitation policy. A limitation does not convert failed execution into successful evidence and must remain visible through Phase 10. No human approval is required for routine progression.

# Auditor anti-patterns

The following are explicit performance failures when applicable:

- `medusa fuzz` with default configuration followed by `forge test` and no campaign design.
- Treating the repository's existing tests as sufficient merely because they pass.
- Treating broad fuzzing and targeted fuzzing as interchangeable.
- Using code coverage as the only completion metric.
- Building a handler that causes nearly all calls to revert and accepting passing invariants.
- Restricting selectors before any broad discovery without a documented technical necessity.
- Failing to carry Phase-5 math/economic boundaries into fuzz inputs.
- Fuzzing only a single caller for a role-sensitive protocol.
- Calling a copied implementation a reference model.
- Skipping differential testing despite a high-quality upstream/reference implementation.
- Ignoring Medusa corpus/counterexamples when designing Foundry campaigns.
- Starting native Foundry fuzzing before required Medusa terminal evidence.
- Skipping the required refinement/rerun cycle.
- Declaring a conditional process `NOT_TRIGGERED` because it is expensive.
- Declaring missing harnesses `NOT_APPLICABLE`.

# Reference basis

The normative rules above are Audit V7 requirements. They are informed by public primary material from Trail of Bits/Medusa, OpenZeppelin, Consensys Diligence/Harvey, Ackee/Wake, and Foundry. The annotated source list is maintained in `phases/phase-6/resources/PHASE6_FUZZING_EXTERNAL_REFERENCES.md`.


## v29 comprehensive assurance additions

All original Process 1–11 requirements above remain normative. v29 adds independent obligations that do not replace them:

1. **Accounting assurance:** accounting-bearing DeFi targets fill `PHASE6_ACCOUNTING_ASSURANCE_MODEL.md`; relevant conservation/solvency/share/debt/reward/fee/rounding/donation/time invariants require explicit executable/alternate disposition.
2. **Randomized accounting attack campaigns:** fill `PHASE6_RANDOMIZED_ATTACK_CAMPAIGN_MATRIX.md` and execute target-bound multi-actor/stateful attack motifs with random + boundary-biased values, ordering, repetition and time changes. This is not equivalent to random public-function calls.
3. **Known/historical attack disposition:** use the qualified Historical Exploit KB when available; until then use `PHASE6_KNOWN_ATTACK_DISPOSITION.md`. Known attacks and novel randomized accounting attacks are separate obligations.
4. **Harness sensitivity:** Phase 6C fills `PHASE6_MUTATION_SENSITIVITY_REPORT.md`; critical properties should kill a relevant audit-only fault/mutant or provide equivalent sensitivity evidence. Critical `SURVIVED` gaps force refinement/rework.
5. **Multidimensional coverage-gap closure:** fill `PHASE6_COVERAGE_GAP_REPORT.md`. A high-risk unexplained gap is blocking even when line coverage or fuzz-call counts are high.
6. **Three fresh subreviewers:** 6A owns design/P6.0, 6B owns P6.1–P6.6 Medusa, 6C owns P6.7–P6.8 Foundry/closure. Sealed predecessor work is not repeated.
7. **Backward compatibility:** future automation is optional until qualified. The exact manual fallback templates are sufficient to execute these requirements now.
