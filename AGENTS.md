# Contract-Automation Agent Execution Policy

Policy version: v9

## Archive boundary — mandatory

`CurveYield2/archive` is the only repository-level home for superseded, deprecated, obsolete, historical-only, backup, or replaced Contract-Automation files.

- Active Contract-Automation paths contain only current operational files and current instructions.
- When an active file is superseded, preserve the old file in `CurveYield2/archive/Contract-Automation/<original-path>` and remove it from this repository.
- Do not keep version chains such as active `foo-v1`, `foo-v2`, `foo-v3` siblings when only one version is current.
- Git history remains available, but do not use Git history as an excuse to leave obsolete files beside live files.
- Agents MUST NOT use Archive files as current execution instructions, current schemas, current workflows, current skeletons, or current policy unless a human explicitly requests historical recovery/comparison.
- If an Archive copy is needed, preserve the exact original bytes/digest before deleting the active-repo copy.

Static checks enforce this rule for V7 workflows, process artifacts, and Phase-6 skeleton-kit siblings.

## Branch lifecycle and cleanup — mandatory

Agents MUST NOT leave completed, abandoned, superseded, experimental, request, repair, or qualification branches sitting indefinitely without an explicit disposition.

Every branch created by an agent must end in exactly one of these states:

1. **MERGED_AND_DELETED** — completed reusable infrastructure work is merged into its intended base branch and the working branch is deleted;
2. **ACTIVE_WITH_OPEN_PR** — unfinished or review-pending work has an open pull request that states the owner/purpose, remaining work, intended base branch, and whether the branch is an execution/request branch that must not be merged; or
3. **CLOSED_WITH_RECORDED_DISPOSITION** — the branch is intentionally not being merged because it is obsolete, superseded, rejected, a completed trace/request branch, or preserved only for recovery/history. Before retiring it, preserve any uniquely valuable code/evidence in the appropriate active path or `CurveYield2/archive` and record why it is not being merged.

Mandatory rules:

- Creating a branch creates an obligation to close its lifecycle before the task ends.
- Do not use branches as permanent storage or as a substitute for the archive repository, workflow artifacts, or canonical evidence storage.
- Atomic V7 request branches are intentionally non-mergeable into trusted `main`, but they are still temporary. After the execution/evidence identity is durably recorded and no retry requires the exact branch, close the trace PR and retire/delete the request branch.
- Do not leave a completed branch merely because work was cherry-picked, squash-merged, reproduced elsewhere, or superseded; compare it against current `main`, inspect every unique changed file, preserve anything useful, then retire it.
- Before declaring a branch disposable, inspect unique implementation, tests, fixtures, workflow changes, evidence, documentation, and recovery material. Do not assume old agent work was pointless.
- If a branch remains active at the end of an agent turn, it MUST have an open PR or an explicit handoff identifying branch, owner/purpose, exact current status, and next action.
- After a normal implementation PR is merged, delete the merged branch unless repository policy explicitly requires it to remain.
- Periodically audit non-main branches and clean up stale branches.

## Canonical V7 control surface

For Audit V7, this repository has exactly one active execution workflow, one active qualification workflow, one active runner manifest, and one operational CLI:

- execution workflow: `.github/workflows/audit-controller-execution.yml`
- qualification workflow: `.github/workflows/v7-execution-infrastructure-qualification.yml`
- runner manifest: `process/RUNNER_MANIFEST.json`
- CLI: `packages/github-native-sim/src/v7-cli.mjs`

Agents MUST NOT choose among historical workflow/manifests or recreate version-suffixed active entrypoints.

Normal operations are:

- execute: `npm run v7:execute -- --request <request.json>`
- submit an atomic request: `npm run v7:submit -- --request <request.json>`
- create a Phase-6 harness bundle: `npm run v7:harness:init -- --request <request.json> [--campaign discovery|property|targeted]`
- validate a Phase-6 harness bundle: `npm run v7:harness:validate -- --bundle <bundle-id> --request <request.json>`
- verify the generated runner manifest: `npm run v7:manifest -- --check`

If a deterministic operation exists in this CLI, agents MUST use it instead of manually reconstructing the underlying Git/RPC/file workflow.

## Terminal disposition is authoritative

Every V7 execution returns a top-level machine disposition plus `blocking`, `owner`, `nextAction`, `retryFrom`, and `recoveryCommand` where applicable.

Agents MUST consume these fields directly and MUST NOT re-derive a different next state from nested logs when the runner already supplied one. Current terminal dispositions include:

- `PASS`
- `FINDINGS`
- `HARNESS_AUTHORING_REQUIRED`
- `RUNNER_REPAIR_REBIND`
- `RECIPE_GAP`
- `INFRASTRUCTURE_BLOCKED`
- `EXECUTION_FAILED`

If the disposition contains a recovery command, use that command before inventing a manual repair path.

## Request submission — automated and byte-safe

Do not manually perform the historical blob/tree/commit/ref playbook during normal audit work.

Use:

`npm run v7:submit -- --request <request.json>`

The trusted submission implementation performs schema validation, exact-byte SHA-256 capture, Git blob/tree/commit/ref creation, exact remote-byte verification, atomic-diff verification, and trace-PR creation. A request branch must differ from trusted `main` by exactly one request payload.

Requester-controlled execution fields remain forbidden, including `rpc`, `rpcUrl`, shell commands, private keys, signed transactions, mnemonics, and secrets.

## Phase 6 skeleton code — canonical location and mandatory discovery

The canonical entrypoint is:

`packages/github-native-sim/harness-skeletons-v2/README_v2.md`

The canonical directory is:

`packages/github-native-sim/harness-skeletons-v2/`

Before authoring or repairing a Phase-6 Medusa/Foundry harness, agents MUST open that README. If the path does not resolve on the first lookup, search this repository for `harness-skeletons-v2` or the exact skeleton filenames. While the repository is accessible, do not ask the human where the skeleton code is and do not recreate supplied skeletons from memory.

## Phase 6 harness authoring — deterministic bundle lifecycle

Missing usable harnesses are `HARNESS_AUTHORING_REQUIRED`, never `NOT_APPLICABLE` when the target is technically compatible.

Start with:

`npm run v7:harness:init -- --request <request.json> [--campaign discovery|property|targeted]`

Then adapt the generated audit-only files to the exact frozen target and run:

`npm run v7:harness:validate -- --bundle <bundle-id> --request <request.json>`

The validator checks source binding, duplicate destinations, file digests, required `medusa.json`/`foundry.toml`, mandatory Medusa fork mode, forbidden literal RPC URLs, Foundry RPC selection, and unresolved target-specific placeholders.

Harness/config/model files remain audit-only. Never modify frozen production source merely to make the harness compile or execute.

## Phase 6 source staging — single immutable snapshot

Phase 6 stages exact source, verifies any archive, and materializes the approved audit overlay **once**. That staged project is hashed and used for preflight. Execution receives a local copy of that same hashed snapshot.

Do not add a second network checkout, second archive extraction, or second harness-overlay materialization to the normal Phase-6 path. Snapshot digest mismatch is an integrity failure.

## Existing mutable Anvil RPC — mandatory shared execution boundary

`SIM_ARCHIVE_PRIMARY_ETHEREUM_01` is the existing approved CurveYield mutable Ethereum Anvil RPC used by the trusted Contract-Automation execution lane.

Any audit operation requiring fork-state access or mutable JSON-RPC semantics MUST use this existing runner-managed path.

- Do not request, accept, invent, or substitute another mutable RPC URL.
- Do not create a parallel local or remote Anvil fork system when the existing path applies.
- The secret is runner-owned and must never be serialized into requests, committed configs, corpora, artifacts, logs, or reports.
- Evidence may record the profile name, chain identity, frozen block number/hash, and policy disposition, never the URL.
- Missing/unreachable/wrong-chain mutable RPC is infrastructure failure; do not fall back to another provider.

For applicable Phase 6:

- preflight verifies Ethereum identity and freezes the observed block number/hash;
- Medusa runs in fork mode through that RPC;
- Foundry uses the same frozen fork identity;
- Medusa must reach terminal evidence before native Foundry begins.

## Full simulation backend — Anvil only

All authoritative full/live/archive/mainnet-fork/deployment/lifecycle/Phase-7 simulation uses Anvil.

Do not use Ganache as a full-simulation compatibility fallback and do not downgrade the requested EVM profile to make another backend work. Static repository checks reject Ganache imports from authoritative V7 execution modules.

## V7 qualification

Infrastructure qualification is repository-level and outside individual audit campaigns. The only active workflow is:

`.github/workflows/v7-execution-infrastructure-qualification.yml`

Static/schema/unit/build qualification runs on relevant PRs. Live mutable-Anvil qualification runs only on trusted `main`/manual execution, where the approved secret is available.

Phase 7 uses `packages/github-native-sim/src/phase7-fork-preflight-v2.mjs` plus standardized lifecycle recipes. Unsupported required behavior is `RECIPE_GAP`, not permission for arbitrary commands.

If infrastructure must change after campaign admission, preserve the failed attempt and return through `RUNNER_REPAIR_REBIND`; do not change target source to repair runner infrastructure.

## Dependency locking status

The repository currently has no recoverable `package-lock.json`. The canonical workflows therefore prefer `npm ci` when a lockfile exists but temporarily fall back to `npm install --no-package-lock` and record `V7_DEPENDENCY_LOCKED=false` when it does not.

Do not claim dependency resolution is locked until a valid lockfile is generated from the repository dependency graph and committed. Do not fabricate a lockfile.

## Audit execution boundary

Private audit/controller repositories are control planes. Technical/rate-limited execution belongs in this public Contract-Automation repository through the canonical bridge/workflow. Do not add competing workload-running audit workflows to private controller repositories.