# Historical Exploit + Adversarial Simulation KB — Decision Log v1

Append-only. Do not rewrite earlier decisions; append a superseding decision if needed.

## D-0001 — Reuse canonical V7 execution infrastructure

- Status: ACTIVE
- Decision: The KB will consume the existing `packages/github-native-sim` harness skeletons, V7 lifecycle recipes, Phase-6/Phase-7 preflight paths, normalized result/evidence machinery, and Anvil runner. It will not create parallel Medusa/Foundry/Anvil runner systems or one workflow per exploit.
- Basis: repository policy and K01 anti-duplication requirement.

## D-0002 — Track overlapping active infrastructure work explicitly

- Status: ACTIVE
- Decision: PR #126 (`feat/v26-machine-execution-v1`) and PR #122 (`policy/mandatory-preflight-v1`) are overlapping active work. KB integration must adapt to their interfaces if/when merged rather than copy their unmerged implementation into the KB branch.
- Consequence: K01 records both as `ADAPT_PENDING_MERGE` assets, not canonical `REUSE` assets yet.

## D-0003 — Recovery commit identity semantics

- Status: ACTIVE
- Decision: A file inside a Git commit cannot contain that same commit's final SHA without changing the SHA. Therefore `currentCommit` records the latest already-observed durable commit when the state file is authored; the next recovery checkpoint advances it to the newly observed implementation commit. `baselineMainSha` and `lastKnownGoodCommit` remain exact observed SHAs. External run records capture the exact workflow head SHA after GitHub assigns it.
- Consequence: Validators require a 40-character SHA but do not impose an impossible self-referential equality with the commit containing the state file.

## D-0004 — Historical campaign simulations are recipe inputs, not historical proof

- Status: ACTIVE
- Decision: Existing BoostHub/lifecycle campaign workflows and requests are classified `ADAPT`; they may seed reusable recipes only after normalization and target-binding removal. They do not satisfy HISTORICAL_REPRODUCTION proof merely because they ran on a fork.
- Consequence: The first historical exploit proof remains a K07-K14 obligation with exact historical chain/block/code/effect binding.
