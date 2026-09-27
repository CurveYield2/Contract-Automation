# Phase 6 Fuzzing External References v1

## Purpose

This is an **informative** primary-source bibliography for `PHASE6_FUZZ_CAMPAIGN_METHODOLOGY.md`. The Audit V7 skill requirements are normative even if an external page later moves or becomes unavailable.

Access basis: reviewed 2026-08-23.

## Trail of Bits / Medusa

1. **Medusa — The Fuzzing Lifecycle**  
   https://secure-contracts.com/program-analysis/medusa/docs/src/testing/fuzzing_lifecycle.html  
   Relevant concepts: random call-sequence generation, corpus mutation, coverage-increasing corpus, coverage-guided fuzzing.

2. **Medusa — Slither Configuration**  
   https://secure-contracts.com/program-analysis/medusa/docs/src/project_configuration/slither_config.html  
   Relevant concepts: extraction of interesting constants from the target system and use of those constants to improve coverage.

3. **Trail of Bits — Curvance: Invariants Unleashed**  
   https://blog.trailofbits.com/2024/04/30/curvance-invariants-unleashed/  
   Relevant concepts: exploration mode before assertion/invariant campaigns, very long-running campaigns, Medusa complementing Echidna, harness/campaign refinement, and coverage-driven deep testing.

## OpenZeppelin

4. **OpenZeppelin — Scroll ZKTrieVerifier Audit**  
   https://www.openzeppelin.com/news/scroll-zktrieverifier-audit  
   Relevant concepts: identify gaps through manual review, build fuzz tests specifically for those gaps, simplify the harness to target the critical library directly, randomize proof/storage parameters, mutate targeted proof fields, and acknowledge resource/time limitations.

## Consensys Diligence / Harvey

5. **Fuzzing Smart Contracts Using Multiple Transactions**  
   https://diligence.consensys.io/blog/2019/01/fuzzing-smart-contracts-using-multiple-transactions/  
   Relevant concepts: deep bugs requiring transaction sequences, demand-driven sequence fuzzing, mutation of steps/sequences, and coverage in the final target transaction.

6. **Diligence Fuzzing Now Supports Foundry Projects**  
   https://diligence.consensys.io/blog/2023/08/diligence-fuzzing-now-supports-foundry-projects/  
   Relevant concepts: black-box vs grey-box fuzzing, coverage-guided corpus generation, input prediction, stateful transaction sequences, and Foundry invariant testing.

7. **Optimism SafetyChecker Audit**  
   https://diligence.consensys.io/audits/2021/03/optimism-safetychecker/  
   Relevant concepts: differential fuzzing against a custom Go reference implementation and comparison of equivalent randomized inputs.

8. **Amp Audit**  
   https://diligence.consensys.io/audits/2020/06/amp/  
   Relevant concepts: custom properties, complete system deployment, multiple known users, and audit-time changes to the fuzz setup to improve effectiveness.

## Ackee Blockchain / Wake

9. **Introducing Manually Guided Fuzzing**  
   https://ackee.xyz/blog/introducing-manually-guided-fuzzing-a-new-approach-in-smart-contract-testing/  
   Relevant concepts: human-defined invariants and flows, randomized execution within guided flows, stateful testing, and auditor responsibility for identifying attack vectors.

10. **Wake Fuzzing Documentation**  
    https://ackee.xyz/wake/docs/4.9.0/testing-framework/fuzzing/  
    Relevant concepts: flow weights, preconditions, maximum execution counts, and invariants asserted after flows.

11. **A Beginner's Guide to Manually Guided Fuzzing**  
    https://ackee.xyz/blog/a-beginners-guide-to-manually-guided-fuzzing/  
    Relevant concepts: actor setup, independent Python expected state, flow design, invariants, and model-vs-contract comparisons.

## Foundry

12. **Foundry — Invariant Testing**  
    https://getfoundry.sh/forge/invariant-testing  
    Relevant concepts: randomized sequences of predefined calls, runs/depth, target contracts/selectors/senders, handlers, ghost variables, bounded/unbounded handlers, actor management, and handler metrics.

## Methodology interpretation used by Audit V7

These sources collectively support a layered model rather than a single generic “fuzzing” step:

- broad discovery to learn reachable behavior;
- human-authored properties/invariants;
- randomized stateful transaction sequences;
- targeted functions/actors/boundaries after broad exploration;
- coverage/corpus feedback and harness refinement;
- targeted adversarial hypotheses;
- independent models/differential testing when meaningful;
- deeper corpus/compute escalation when residual risk warrants it.

Audit V7 intentionally makes the first seven processes baseline requirements and the remaining advanced methods trigger-mandatory so assurance increases without forcing high-cost techniques where they add no meaningful independence or security value.
