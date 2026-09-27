# P6.1 — Broad Randomized Discovery + Gate A

**Entry:** P6.0 terminal.

**Exit:** Process 1 has valid terminal evidence; Gate A coverage/corpus/security-surface review is evidence-backed; the initial refinement plan required by the methodology is recorded. Process 5 remains cross-cutting and is not final until both Medusa and Foundry refinement/rerun requirements are satisfied.

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
