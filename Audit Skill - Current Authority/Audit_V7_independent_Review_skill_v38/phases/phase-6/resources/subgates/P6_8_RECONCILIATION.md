# P6.8 — Security-Surface Reconciliation & Phase-6 Result

**Hard entry gate:** P6.7 terminal.

This gate does not add a new fuzzing process. It proves that the complete Phase-6 campaign actually satisfied the existing methodology and cross-phase obligations.

Resources:
- [`PHASE6_CAMPAIGN_RESULT_SUMMARY.md`](../PHASE6_CAMPAIGN_RESULT_SUMMARY.md)
- [`PHASE6_FUZZ_CAMPAIGN_LEDGER.md`](../PHASE6_FUZZ_CAMPAIGN_LEDGER.md)
- [`EVM review controls`](../../../../shared/domain-modules/evm-contract-review.md)
- [`External dependency controls`](../../../../shared/domain-modules/external-dependencies.md)
- [`Controller-operated execution`](../audit-modules/controller-operated-execution.md)
- [`Domain Applicability Registry`](../../../../shared/controller/DOMAIN_APPLICABILITY_REGISTRY.json)
- [`Security Traceability Graph`](../../../../shared/controller/SECURITY_TRACEABILITY_GRAPH.json)
- [`Carried-Forward Obligation Ledger`](../../../../shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json)
- [`Accounting Assurance Model`](../PHASE6_ACCOUNTING_ASSURANCE_MODEL.md)
- [`Randomized Attack Matrix`](../PHASE6_RANDOMIZED_ATTACK_CAMPAIGN_MATRIX.md)
- [`Known Attack Disposition`](../PHASE6_KNOWN_ATTACK_DISPOSITION.md)
- [`Mutation Sensitivity Report`](../PHASE6_MUTATION_SENSITIVITY_REPORT.md)
- [`Coverage Gap Report`](../PHASE6_COVERAGE_GAP_REPORT.md)

## Normative campaign gates and final reconciliation (exact preserved methodology excerpt)

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
- no production source was changed to make fuzzing easier;
- applicable accounting invariant classes are explicitly dispositioned;
- randomized accounting attack motifs and known-attack patterns are separately dispositioned;
- critical harness sensitivity is evidenced and unresolved `SURVIVED` gaps are repaired/limited;
- no high-risk unexplained `BLOCKING_GAP` remains in the multidimensional coverage report.

A Phase-6 process `FAILED` blocks successful Phase-6 sealing unless controller policy explicitly permits a typed limitation-continuation disposition after required recovery is exhausted. A typed limitation never converts failed execution into successful evidence and remains visible through Phase 10.

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

