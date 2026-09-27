# P6.4 — Medusa Coverage / Model Refinement & Mandatory Rerun

**Entry:** P6.3 terminal and original Medusa evidence preserved.

**Exit:** the Medusa-side requirements of Process 5 and Gate B are satisfied: security-relevant gaps are reviewed, a justified harness/config/corpus change is made, Medusa is rerun, before/after evidence is preserved, and residual gaps are explicit. Process 5 remains open for its required Foundry-side refinement/rerun until P6.7/P6.8.

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
