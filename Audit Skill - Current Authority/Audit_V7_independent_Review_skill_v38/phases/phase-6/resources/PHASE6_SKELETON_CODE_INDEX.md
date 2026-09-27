# Phase 6 Skeleton Code Index v1

## Purpose

This file is the mandatory navigation index for all Phase-6 auditor-authored Medusa and native Foundry harness code.

## Canonical repository and directory

Repository: `CurveYield2/Contract-Automation`

Canonical directory:

`packages/github-native-sim/harness-skeletons-v2/`

Canonical entrypoint:

`packages/github-native-sim/harness-skeletons-v2/README_v2.md`

**DISCOVERY HARD GATE:** before authoring, repairing, or claiming absence of any Phase-6 fuzz/simulation harness, `reviewer-3` MUST open the canonical entrypoint above and inspect the applicable skeleton files. Do not author a replacement from memory before reading the supplied skeletons.

## Exact skeleton files

### Medusa

- `packages/github-native-sim/harness-skeletons-v2/medusa/medusa-discovery-template_v2.json`
- `packages/github-native-sim/harness-skeletons-v2/medusa/medusa-property-template_v2.json`
- `packages/github-native-sim/harness-skeletons-v2/medusa/medusa-targeted-template_v2.json`
- `packages/github-native-sim/harness-skeletons-v2/medusa/Phase6MedusaHarness_v2.sol.template`

### Native Foundry

- `packages/github-native-sim/harness-skeletons-v2/foundry/foundry-template_v2.toml`
- `packages/github-native-sim/harness-skeletons-v2/foundry/Phase6InvariantTargeting_v2.sol.template`
- `packages/github-native-sim/harness-skeletons-v2/foundry/Phase6StatefulHandler_v2.sol.template`
- `packages/github-native-sim/harness-skeletons-v2/foundry/Phase6InvariantSuite_v2.t.sol.template`
- `packages/github-native-sim/harness-skeletons-v2/foundry/Phase6BoundaryFuzz_v2.t.sol.template`
- `packages/github-native-sim/harness-skeletons-v2/foundry/Phase6DifferentialFuzz_v2.t.sol.template`

### Models and evidence

- `packages/github-native-sim/harness-skeletons-v2/models/Phase6GhostModel_v2.sol.template`
- `packages/github-native-sim/harness-skeletons-v2/phase6-harness-manifest-template_v2.json`

## Mandatory companion instructions

Before using the skeletons, read all of:

- `phases/phase-6/resources/PHASE6_FUZZ_CAMPAIGN_METHODOLOGY.md`
- `phases/phase-6/resources/PHASE6_FUZZ_HARNESS_REQUIREMENTS.md`
- `phases/phase-6/resources/PHASE6_MUTABLE_ANVIL_RPC_POLICY.md`
- `phases/phase-6/resources/PHASE6_FUZZ_CAMPAIGN_LEDGER.md`
- `shared/execution/EXECUTION_PREFLIGHT_AND_REPAIR_PROTOCOL.md`
- `phases/phase-6/START_HERE.md`

## Mandatory retrieval fallback

If the canonical directory lookup does not resolve, the agent MUST perform repository discovery before reporting any problem:

1. Search `CurveYield2/Contract-Automation` for the exact string `harness-skeletons-v2`.
2. Search for exact filenames from this index, starting with:
   - `Phase6StatefulHandler_v2.sol.template`
   - `Phase6MedusaHarness_v2.sol.template`
   - `medusa-discovery-template_v2.json`
   - `foundry-template_v2.toml`
   - `phase6-harness-manifest-template_v2.json`
3. List the parent directory returned by any exact-file match and inspect `README_v2.md` there.
4. If a path was version-moved, use the latest non-deprecated skeleton directory referenced by repo `AGENTS.md` and record the resolved path.

When the repository is accessible, **`SKELETON_CODE_NOT_FOUND` is not a valid conclusion until the canonical path and exact-filename searches above have all been attempted.** Do not ask the human where the skeletons are. Do not say they are unavailable merely because one guessed path failed.

## Valid failure classification

If repository access itself is unavailable after the agent attempts the repository read/search mechanisms it normally uses, classify that as `GITHUB_REPOSITORY_ACCESS_FAILURE` / infrastructure limitation. Do not mislabel it as missing skeleton code.

Under the operating assumption that the agent has the skill and can access `CurveYield2/Contract-Automation`, the skeleton code is considered discoverable and the agent MUST proceed from this index.
