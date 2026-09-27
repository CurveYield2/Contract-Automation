# P6.3 — Semi-Targeted, Stateful & Boundary/Dictionary Medusa Campaigns

**Entry:** P6.2 terminal.

**Exit:** Processes 3, 4 and 7 have valid Medusa-side terminal evidence under their existing applicability rules, with realistic state transitions, actor semantics and boundary classes recorded.

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
