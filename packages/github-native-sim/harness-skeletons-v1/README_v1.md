# Phase 6 Harness Skeleton Kit v1

Purpose: repo-native templates for Audit V7 Phase 6 harness authoring in `CurveYield2/Contract-Automation`.

These are **templates, not production contracts**. The auditor must adapt them to the frozen target, preserve the production-source fence, hash every instantiated audit-only artifact, and bind it to the exact audited source commit/archive identity.

## Current Contract-Automation execution contract

The V2 runner currently:

- requires `github-native-simulate-v2` for Phase 6;
- pins Medusa to `1.5.1` and runs `medusa fuzz` from the target `projectRoot`;
- runs native Foundry as `forge test --fuzz-runs <request.configuration.analysis.nativeFuzz.fuzzRuns>` from the same `projectRoot`;
- requires terminal Medusa evidence before native Foundry starts;
- preflights Medusa by looking for `medusa*.json` or Solidity property/invariant functions;
- preflights native Foundry by looking for an exact runtime `foundry.toml` and at least one `*.t.sol` file;
- returns `PHASE6_HARNESS_AUTHORING` when an applicable target lacks a harness.

Therefore checked-in skeletons remain versioned, while instantiated audit-only runtime files use the tool-required names:

| Checked-in skeleton | Runtime materialization |
|---|---|
| `medusa/medusa-discovery-template_v1.json` | `medusa.json` for Campaign A-M |
| `medusa/medusa-property-template_v1.json` | `medusa.json` for Campaign B-M |
| `medusa/medusa-targeted-template_v1.json` | `medusa.json` for Campaign C-M |
| `foundry/foundry-template_v1.toml` | `foundry.toml` |
| Solidity `*_v1.sol.template` files | auditor-chosen `test/phase6/*.sol` / `*.t.sol` paths |

Never overwrite the production source files to make a harness compile. Materialize the audit-only harness as a separate overlay/workspace artifact and preserve its digest.

## Skeleton map

- `medusa/medusa-discovery-template_v1.json` — broad coverage/corpus discovery; deliberately avoids selector narrowing.
- `medusa/medusa-property-template_v1.json` — property/invariant and state-machine campaign.
- `medusa/medusa-targeted-template_v1.json` — hypothesis-specific selectors/actors/corpus refinement.
- `medusa/Phase6MedusaHarness_v1.sol.template` — property harness skeleton with independent property hooks.
- `foundry/foundry-template_v1.toml` — Phase 6 fuzz/invariant profile, failure persistence, depth/runs placeholders.
- `foundry/Phase6InvariantTargeting_v1.sol.template` — dependency-free Foundry invariant target/selector/sender plumbing.
- `foundry/Phase6StatefulHandler_v1.sol.template` — stateful multi-actor handler with call/revert/transition counters.
- `foundry/Phase6InvariantSuite_v1.t.sol.template` — invariant suite and ghost-state checks.
- `foundry/Phase6BoundaryFuzz_v1.t.sol.template` — boundary/dictionary-directed native fuzz skeleton.
- `foundry/Phase6DifferentialFuzz_v1.t.sol.template` — same-input reference-vs-target differential skeleton.
- `models/Phase6GhostModel_v1.sol.template` — independent expected-state model skeleton.
- `phase6-harness-manifest-template_v1.json` — evidence/source-binding manifest for instantiated artifacts.

## Mandatory instantiation discipline

1. Read sealed Phase 2–5 properties, threats, implementation concerns, and economic/math boundaries.
2. Record the exact production source identity before authoring.
3. Instantiate only the skeletons required by the Phase 6 campaign tree.
4. Replace every `PHASE6_*` placeholder; unresolved placeholders are a harness-authoring failure.
5. Keep broad Medusa discovery broad. Do not copy targeted selectors into Campaign A.
6. Preserve Medusa corpus and coverage between Campaign A/B/C where the campaign plan requires reuse.
7. Build native Foundry handlers from Medusa counterexamples, coverage gaps, and unresolved hypotheses while maintaining a genuinely distinct campaign.
8. Record actor roles, handler call/revert counts, state-transition counters, boundary classes hit, seeds/config, runs/depth, corpus identities, and counterexamples.
9. Hash each instantiated harness/config/model artifact and populate the manifest.
10. Do not represent a copied production formula as an independent model.

## Success criteria

The kit is used correctly only when the instantiated campaign can provide evidence for the v12 Phase 6 process ledger: broad discovery, properties/invariants, semi-targeted randomness, stateful sequences, refinement/rerun, targeted hypotheses, boundary values, and every triggered advanced process.

A tool exit code of zero is not sufficient. Passing invariants with dead handlers, near-total reverts/discards, one default actor on a role-sensitive system, or unexercised target selectors is auditor-performance failure.

## Current integration boundary

The checked-in runner can detect `HARNESS_REQUIRED`, but it does not yet provide a first-class request field that transports an auditor-authored harness overlay into both the preflight checkout and the execution checkout. These templates intentionally do not weaken the frozen-source rule to work around that gap. A subsequent runner change should stage a separately hashed audit-only overlay before both Phase-6 preflight and execution, without changing `request.source` identity.

## External method basis

The templates are aligned to Trail of Bits Medusa coverage/corpus and target-function controls, Foundry stateful invariant handlers/targeting/ghost-state practices, and the v12 Phase 6 methodology. Tool-specific values remain risk-driven; there is no universal run/depth value that proves safety.
