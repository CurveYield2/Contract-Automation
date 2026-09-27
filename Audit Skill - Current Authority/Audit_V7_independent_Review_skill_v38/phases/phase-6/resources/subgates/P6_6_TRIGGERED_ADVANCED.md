# P6.6 — Triggered Advanced Campaigns

**Entry:** Immediately preceding sub-gate terminal. Evaluate Processes 8–11 independently; NOT_TRIGGERED requires the exact evidence defined below.

**Exit:** Processes 8–11 each have an objective trigger decision; every triggered Medusa-side Campaign D-M requirement that must precede Foundry is terminal; any applicable Foundry-side continuation is explicitly carried into P6.7. Overall Process 8–11 terminal dispositions are finalized in P6.8 after Foundry-side work.

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

## Gate D — trigger assessment

The auditor MUST separately evaluate Processes 8–11 and record `COMPLETED`, `FAILED`, or `NOT_TRIGGERED` with evidence.

**Gate success:** objective triggers were evaluated and triggered methods executed.  
**Gate failure:** conditional methods are skipped by preference, cost avoidance, or vague “not needed” prose.
