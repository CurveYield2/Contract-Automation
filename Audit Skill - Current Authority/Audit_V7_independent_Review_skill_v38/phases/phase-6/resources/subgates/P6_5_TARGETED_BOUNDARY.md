# P6.5 — Targeted Adversarial Medusa Campaigns

**Entry:** P6.4 terminal.

**Exit:** Process 6 Medusa-side targeted-adversarial work and Gate C hypothesis dispositions are complete; every material hypothesis is executed or deliberately routed to another valid evidence method. Boundary/dictionary Process 7 was completed in P6.3 and remains binding.

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

## Gate C — targeted-adversarial completion

Every material hypothesis MUST have a disposition and supporting evidence.

**Gate success:** all material hypotheses are fuzzed or deliberately routed to another valid evidence method.  
**Gate failure:** any material hypothesis is silently untested, or broad fuzzing is cited as its only coverage without target-specific reasoning.
