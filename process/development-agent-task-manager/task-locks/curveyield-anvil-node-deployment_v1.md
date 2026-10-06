# Development Agent Task-Lock State v1

MANAGER ID:
curveyield-anvil-node-deployment

END-STATE INVARIANT:
CurveYield2/anvil-node is converted from the full ethui/stacks clone into the minimum proven CurveYield-owned deployment that, through GitHub-controlled automation, runs a fixed private fleet of persistent Ethereum Anvil fork nodes with stable remotely reachable HTTPS JSON-RPC URLs. The fleet preserves the upstream Stacks Anvil lifecycle, fork, persistence, readiness, graceful-shutdown, and corrupt-state recovery behavior required for long-running simulation use; removes browser/frontend, public node creation, accounts/auth/email, MCP, explorer, Graph/IPFS/subgraph, and other multi-user/SaaS surfaces; keeps node startup/configuration server-controlled; uses a replaceable server-side Ethereum fork-source RPC without exposing it to Contract-Automation; and produces at least one primary endpoint that can replace `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` and passes the existing Contract-Automation archive/fork-source probes plus Phase-0 smoke/full simulation qualification. Initial target fleet is four fixed nodes (`ethereum-01` through `ethereum-04`) with independent persistent state and stable URLs; no dynamic node-provisioning API is permitted.

CURRENT MAIN:
- Contract-Automation main checked: `98c628d26d62c064df12410dd50048d4c92ba0ce`.
- anvil-node main checked: `79ee877cbeee3a783e1e065dc4f1cea3c7524379`.
- Final disposable fleet qualification run: `https://github.com/CurveYield2/anvil-node/actions/runs/37484638546` — PASS.

AUTHORITY:
- Human instruction in current task: self-host the Stacks-derived Anvil service in `CurveYield2/anvil-node`, keep only the functions required by Contract-Automation, expose persistent RPC links, deploy via GitHub, and execute against this task lock.
- Human-approved design from the current task: fixed private persistent Anvil fleet; no browser or third-party provisioning surface; Contract-Automation consumes stable RPC URLs; upstream Ethereum source is hidden behind the fleet and replaceable.
- `Contract-Automation/AGENTS.md` @ current main.
- `Contract-Automation/FOCUS/TASK LOCKS/TASK_LOCK_PROTOCOL_v1.md` @ blob `1f464444e1f0d148b46aeba2bd93ffda7846f834`.
- `CurveYield2/anvil-node` upstream Stacks baseline @ `9a943eca6e1f093ec449211aa7f1f11a6437f123`.
- Contract-Automation compatibility authorities:
  - `.github/workflows/lite-phase0-simulation-testing-v1.yml`
  - `.github/workflows/lite-phase0-randomized-simulation-v1.yml`
  - `.github/workflows/lite-phase0-simulation-rebind-v1.yml`
  - `scripts/run-phase0-randomized-simulation-v1.mjs`
  - `packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs`
  - `packages/github-native-sim/src/archive-rpc-identity-v1.mjs`
  - `packages/github-native-sim/src/archive-rpc-state-readiness-v1.mjs`
  - `packages/github-native-sim/src/archive-contract-code-readiness-v1.mjs`

SATISFIED:
- `CurveYield2/anvil-node` was initialized from the selected Stacks baseline and Git history preserves that provenance.
- The live `anvil-node/main` tree was reduced to the minimum production surface: one canonical workflow, root documentation/ignore rules, and the fixed `curveyield-anvil` runtime only. The Stacks frontend, Phoenix management surface, public stack APIs, auth/email, MCP, explorer, Graph/IPFS/subgraph material, Bruno collection, old compose files, package/devenv files, and unrelated CI are absent from the live tree.
- Four fixed nodes are implemented: `ethereum-01`, `ethereum-02`, `ethereum-03`, and `ethereum-04`.
- Every node has an independent persistent Docker volume and independent process/container.
- Native Anvil ports are bound only to host loopback; Caddy is the only intended Internet-facing service.
- Four stable secret-path HTTPS route shapes are implemented, one per fixed node.
- Production node configuration is server-controlled. No public dynamic node-creation/configuration API exists.
- Anvil is configured with Ethereum chain ID 1, upstream `--fork-url`, persistent `--state`, `--preserve-historical-states`, `--auto-impersonate`, and `--no-rate-limit`.
- The Foundry image is pinned to the exact image digest qualified as Anvil 1.5.1-stable / commit `b0a9dd9c`.
- Health checks require successful chain identity, block number, and latest-block retrieval.
- Graceful stop time is 45 seconds and state persistence across restart is proven.
- Corrupt state-file quarantine plus one-shot recovery from the upstream fork is implemented and proven.
- The upstream Ethereum source URL is supplied only through deployment configuration and is not exposed as a Contract-Automation input.
- Existing Contract-Automation archive identity, historical-state, and historical-code probes passed against all four nodes at block 18,000,000.
- Required JSON-RPC reads and mutable Anvil methods passed qualification, including transaction/receipt reads, historical nonce/code/storage/call, logs, balance mutation, impersonation, snapshot/revert, mining, and state dump.
- A second Anvil successfully used `ethereum-01` as its upstream fork source, proving the architecture Contract-Automation requires.
- Final qualification run `37484638546` passed after the repository was reduced to the final minimal tree.
- PR #1 was updated with the verified four-node scope and qualification evidence, then merged to `anvil-node/main` as commit `79ee877cbeee3a783e1e065dc4f1cea3c7524379`.
- The canonical production deployment job is implemented and targets one durable Linux self-hosted GitHub runner labeled `self-hosted`, `linux`, `curveyield-anvil`.
- Production deployment validates all four services and all four external HTTPS routes before reporting success.
- dRPC's public Ethereum endpoint is used only for disposable CI qualification; production remains source-agnostic and uses `ETHEREUM_SOURCE_RPC_URL`.

REMAINING DELTA:
- Provide or designate one durable Linux host that can remain online as the RPC server and install Docker Engine plus Docker Compose v2 on it.
- Register that machine as a GitHub self-hosted runner for `CurveYield2/anvil-node` with labels `self-hosted`, `linux`, and `curveyield-anvil`.
- Choose a production RPC hostname and point its DNS to that host; permit inbound TCP 80 and 443.
- Configure `CurveYield2/anvil-node` repository secrets `ETHEREUM_SOURCE_RPC_URL`, `RPC_DOMAIN`, and a high-entropy `RPC_PATH_TOKEN` of at least 32 characters.
- Set repository variable `CURVEYIELD_ANVIL_SELF_HOSTED_ENABLED=true` only after the host, labels, DNS, and secrets are ready.
- Manually dispatch `.github/workflows/curveyield-anvil-node.yml` from `main` and require the persistent deployment job to PASS.
- Capture the resulting stable `ethereum-01` through `ethereum-04` HTTPS RPC endpoints without committing or logging their secret path.
- Set Contract-Automation's existing `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` secret to the deployed `ethereum-01` endpoint.
- Run `.github/workflows/lite-phase0-simulation-testing-v1.yml` against the deployed primary endpoint without weakening acceptance rules.
- Run the standard full Phase-0 randomized simulation against the deployed primary endpoint without weakening Medusa/telemetry/deployment requirements.
- Delete the merged `agent/curveyield-anvil-node-deployment` branch. GitHub did not auto-delete it; the available GitHub connector has no branch-delete action and the attempted GitHub browser cleanup was blocked by missing browser authentication.

PARKED OBSERVATIONS:
- The upstream repository exposes no license in GitHub metadata. Confirm redistribution/licensing terms before any broader redistribution decision; this does not change the already-completed technical implementation.
- The persistent Anvil fleet still depends on its configured Ethereum source for fork state not already cached. If the chosen production source becomes the limiting factor under real workloads, a self-hosted Ethereum source/archive node may become a separate infrastructure task.
- General Contract-Automation refactors, audit-system changes, browser automation, and unrelated repository cleanup remain outside this task.

ACTIVE BLOCKER:
Production deployment cannot presently execute because the required persistent GitHub self-hosted runner/host configuration is not enabled. The latest deployment preflight observed `CURVEYIELD_ANVIL_SELF_HOSTED_ENABLED` as empty, and no durable host, production DNS value, or deployment secret values are available in the current task context. GitHub-hosted Actions runners are ephemeral and cannot satisfy the persistent RPC end-state. The available GitHub connector does not expose repository-secret or self-hosted-runner administration, so those resources cannot be fabricated or registered from this execution environment. Separately, the merged implementation branch still exists because repository setting `delete_branch_on_merge` is false; the connector exposes no branch-delete action and a GitHub UI deletion attempt was blocked by missing browser authentication.

NEXT ACTION:
On a durable Linux host, install Docker Engine and Docker Compose v2, register a GitHub Actions self-hosted runner for `CurveYield2/anvil-node` with the `curveyield-anvil` label, point the chosen RPC hostname to that host, and configure the three repository secrets. Then set `CURVEYIELD_ANVIL_SELF_HOSTED_ENABLED=true` and dispatch the canonical workflow from `main`. Resume this lock at the production deployment job; do not repeat implementation or disposable qualification work.
