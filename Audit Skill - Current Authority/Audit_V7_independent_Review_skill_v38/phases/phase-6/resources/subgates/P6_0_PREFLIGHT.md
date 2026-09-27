# P6.0 — Execution Preflight, Source Fence & Harness Admission

**Entry:** accepted Phase-5 handoff; reviewer-3 bound; exact campaign/source identity resolved.

**Exit requires:** Phase-6 execution preflight sealed; exact build/compiler/runner identities accepted; canonical skeleton discovery complete; mutable Anvil identity frozen; required audit-only Medusa/Foundry harness construction plan complete; production source unchanged; initial domain-specific fuzz targets imported from the Domain Applicability Registry and Phase-2–5 traceability/obligation state.

Open only these resources while P6.0 is active:

- [`EXECUTION_PREFLIGHT_AND_REPAIR_PROTOCOL.md`](../../../../shared/execution/EXECUTION_PREFLIGHT_AND_REPAIR_PROTOCOL.md)
- [`GITHUB_ACTIONS_VIA_GITHUB_APP.md`](../../../../shared/execution/GITHUB_ACTIONS_VIA_GITHUB_APP.md)
- [`PHASE6_SKELETON_CODE_INDEX.md`](../PHASE6_SKELETON_CODE_INDEX.md)
- [`PHASE6_MUTABLE_ANVIL_RPC_POLICY.md`](../PHASE6_MUTABLE_ANVIL_RPC_POLICY.md)
- [`PHASE6_FUZZ_HARNESS_REQUIREMENTS.md`](../PHASE6_FUZZ_HARNESS_REQUIREMENTS.md)
- [`DOMAIN_APPLICABILITY_REGISTRY.json`](../../../../shared/controller/DOMAIN_APPLICABILITY_REGISTRY.json)
- [`supply-chain-build`](../../../../shared/domain-modules/supply-chain-build.md)

## Normative common Phase-6 controls (exact preserved methodology excerpt)

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

