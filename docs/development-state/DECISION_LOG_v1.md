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

## D-0005 — Deduplication is conservative; probable matches do not auto-merge

- Status: ACTIVE
- Decision: An exact shared exploit transaction hash is sufficient to classify two candidate records as the same incident and merge their references. A contextual/root-cause fingerprint match without exact transaction identity is only `PROBABLE_SAME_INCIDENT` and remains separate for review. Distinct transaction hashes, or asymmetric transaction evidence with the same fingerprint, are `VARIANT_OR_RELATED`, never silently collapsed.
- Basis: K05 must avoid both duplicate EXP IDs and loss of distinct exploit variants.
- Consequence: automated ingestion can merge exact duplicates deterministically while preserving variant/family relationships for explicit modeling.

## D-0006 — Incident fact verification is distinct from executable historical proof

- Status: ACTIVE
- Decision: `EXP-2023-0001` may be `incidentStatus: VERIFIED` because its incident facts are supported by primary protocol/onchain/security evidence, while `PROOF-0001` remains only `SCHEMA_VALID` until the historical reproduction obligations in later modules are executed and qualified.
- Basis: v3 separates reference confidence from executable proof tiers; K07 must not imply that a verified incident record has already been replayed.
- Consequence: registry and matching logic may consume the verified incident facts, but no HISTORICAL_REPRODUCTION, GENERALIZED_VARIANT_PROVEN, or QUALIFIED claim may be inferred from K07 alone.

## D-0007 — Recipe instantiation is mechanical and fail-closed

- Status: ACTIVE
- Decision: Generalized recipes contain only declared `${binding:...}` placeholders. A recipe instance is `BLOCKED` until every required target binding is explicitly supplied; instantiation performs data substitution only and rejects undeclared placeholders and literal onchain identities in the generalized template.
- Basis: K09 requires reusable target-bound actions without silently assuming the historical target, and v3 forbids automatic target-specific security judgment.
- Consequence: missing functions/addresses/metrics are never guessed by the global KB. Applicability, target-specific binding provenance, and auditor-approved security judgment remain later matcher/adaptation/controller responsibilities.

## D-0008 — Every proof-tier advancement requires fresh tier-specific evidence

- Status: ACTIVE
- Decision: Proof advancement is strictly sequential, and evidence already accumulated at a lower proof tier cannot by itself satisfy the evidence obligation of the next tier. Each transition supplies a fresh tier-specific evidence bundle; prior evidence remains accumulated only for traceability.
- Basis: K10 requires evidence/run identities per proof tier and must prevent manual or stale-evidence promotion to `QUALIFIED`.
- Consequence: executable content changes set lifecycle status to `REQUALIFICATION_REQUIRED`, and automatic scheduling is permitted only when the proof is both `ACTIVE` and `QUALIFIED` after the required fresh evidence transitions.

## D-0009 — Executables bind immutable knowledge identity, not mutable IDs alone

- Status: ACTIVE
- Decision: Persistent incident, pattern, and recipe records expose explicit positive integer revisions. Every backend-neutral executable binds each referenced knowledge record by kind, stable ID, revision, and canonical SHA-256 digest; stale revision or content digest fails closed. Before an executable has actually qualified, `lastQualification` is `null` rather than a synthetic run claim.
- Basis: K11 requires exact incident/pattern/recipe revision binding and the global KB is consumed through immutable IDs/digests.
- Consequence: `CONTROLLED` and `HISTORICAL` executable modes share one metadata contract; historical mode additionally requires archive RPC-by-environment and exact block identity. Literal RPC URLs, private keys, mnemonics, and arbitrary shell/command escape fields are forbidden recursively.
