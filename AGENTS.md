# Contract-Automation Agent Execution Policy

Policy version: v3

## Full simulation backend — mandatory

**All full, live-RPC, archive-RPC, mainnet-fork, lifecycle, deployment, or Phase-7 audit simulations MUST use Anvil.**

- Anvil is the only approved backend for full simulations in this repository.
- Do not use Ganache for full simulations, even for older EVM versions or as a compatibility fallback.
- Do not silently downgrade the configured EVM version to make another backend work.
- Preserve the request's exact compiler/EVM profile and execute it on Anvil.
- For Ethereum Phase-7 archive simulations, continue to use `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` through the trusted Contract-Automation execution lane.
- Ganache code may remain only for bounded lightweight/local regression utilities that are not authoritative full-simulation evidence. It must never be selected by the V7 Phase-7/full-fork execution path.

If Anvil cannot start or cannot execute a required fork, fail with typed execution evidence and repair the Anvil path. Do not substitute Ganache.

## V7 execution preflight and qualification — mandatory

- New V7 work is V2-only: `deep-assurance-github-request-v2`, `github-native-compile-v2`, and `github-native-simulate-v2`. V1 execution profiles are historical/non-executable.
- Infrastructure qualification is repository-level and occurs outside audit campaigns. Use `.github/workflows/v7-execution-infrastructure-qualification-v1.yml` to qualify an exact candidate release before the Solo Audit Controller admits it to a campaign.
- Phase 6 must classify target Medusa and Foundry/native-fuzz harness applicability before analyzer invocation. Use `packages/github-native-sim/src/phase6-execution-preflight-v1.mjs`. Missing target harnesses are terminal `NOT_APPLICABLE`; do not invoke an inapplicable analyzer merely to discover that condition.
- Phase 7 must pass the Anvil/archive fork preflight before lifecycle execution. Use `packages/github-native-sim/src/phase7-fork-preflight-v1.mjs` to prove launcher/hardfork, archive secret, chain identity, pinned state, target code, impersonation/balance control, and workflow-action support.
- Prefer standardized Phase-7 lifecycle recipes from `packages/github-native-sim/src/lifecycle-recipes-v1.mjs`. Unsupported behavior is `RECIPE_GAP`, not permission for arbitrary commands.
- If runner infrastructure must change after campaign admission, preserve the failed attempt and return control to the Solo Audit Controller `RUNNER_REPAIR_REBIND` state. Do not change target production source to repair audit infrastructure.

## Audit execution boundary

Private audit/controller repositories are control planes. Technical/rate-limited execution belongs in this public Contract-Automation repository through the existing bridge. Do not add workload-running audit workflows to private controller repositories.

## Exact large-request / binary-safe Git transfer — mandatory playbook

For large V7 request JSON, exact serialized payloads, or any data where byte integrity matters, **do not use GitHub's Contents API (`create_file` / `update_file`) as the primary transfer path**. During V7 recovery it repeatedly produced malformed large JSON even when the local source bytes parsed correctly.

Use Git's low-level object path instead:

1. **Prepare and validate the exact bytes before GitHub write.**
   - Materialize or generate the complete request locally/in the working container.
   - Parse JSON locally (`JSON.parse` or equivalent) before upload.
   - Compute/record request ID, request digest, byte length, and SHA-256 where applicable.
   - Do not reserialize or hand-edit the payload after this validation point.

2. **Read the destination branch/base commit and base tree.**
   - Resolve the exact parent commit SHA for the branch you are updating.
   - Fetch that commit and record its tree SHA.
   - For an atomic request branch, normally start from current trusted `main` unless preserving an already-frozen request commit intentionally.

3. **Create the blob from the exact validated bytes.**
   - Call GitHub `create_blob`.
   - Prefer `encoding: "base64"` for exact request/binary-safe transfer; base64-encode the already-validated bytes once.
   - Record the returned blob SHA.
   - Do not pass the payload through `create_file` or `update_file` first.

4. **Create a tree containing the destination path.**
   - Call `create_tree` with `base_tree_sha` equal to the parent commit's tree SHA.
   - Add exactly one tree entry for an atomic request branch, for example:
     - `path`: `github-native-sim/requests/<request-id>/request.json`
     - `mode`: `100644`
     - `type`: `blob`
     - `sha`: the SHA returned by `create_blob`
   - Record the returned tree SHA.

5. **Create the commit explicitly.**
   - Call `create_commit` with:
     - `tree_sha`: the new tree SHA
     - `parent_sha`: the exact current branch/head commit SHA
     - a descriptive message
   - Record the returned commit SHA.

6. **Move only the intended branch ref.**
   - Call `update_ref` for the request/working branch and point it to the new commit SHA.
   - Do not update `main` directly for audit request submission.
   - Do not force-update unless repairing a branch whose lineage is deliberately being reset and the reason is documented.

7. **Verify the remote bytes before execution.**
   - Fetch the request file/blob from the new branch/commit.
   - Parse it as JSON again.
   - Confirm request ID, request digest, source commit/archive digest, fork block, and any other frozen identities match the locally validated payload.
   - If exact bytes matter, compare byte length/SHA-256 as well.
   - Only after this verification may the request be treated as successfully transferred.

8. **Open a trace-only PR to trusted `main` when PR visibility is needed for V7 Actions.**
   - The PR branch should contain only the atomic request data, not runner changes.
   - Do **not** merge audit request branches into `main`.
   - Trusted runner code must come from `main`; request data comes from the request branch.

### Failure recovery

If a request created through `create_file` / `update_file` fails JSON parsing but the local source parses correctly:

- Treat transport corruption as the default hypothesis.
- Do not rewrite the request semantics.
- Replace the bad path with the exact validated bytes using `create_blob → create_tree → create_commit → update_ref`.
- Rerun validation on the remote blob before retriggering execution.

### Atomic branch rule

A V7 request branch must contain **exactly one new request payload** relative to trusted `main`. If inherited request files appear in the PR diff, reset/recreate the branch from the intended base and install only the desired request via the blob/tree/commit path.
