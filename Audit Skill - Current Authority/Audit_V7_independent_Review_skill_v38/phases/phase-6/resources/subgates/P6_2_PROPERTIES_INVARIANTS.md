# P6.2 — Human-Derived Properties & Invariants

**Entry:** Immediately preceding sub-gate terminal.

**Exit:** every Process mapped to this gate has a valid methodology-defined terminal disposition and its exact evidence is recorded in the Phase-6 campaign ledger and sub-gate state.

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
