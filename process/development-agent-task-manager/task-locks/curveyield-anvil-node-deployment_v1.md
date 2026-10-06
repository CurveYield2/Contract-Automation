# Development Agent Task-Lock State v1

MANAGER ID:
curveyield-anvil-node-deployment

END-STATE INVARIANT:
CurveYield2/anvil-node is converted from the full ethui/stacks clone into the minimum proven CurveYield-owned deployment that, through GitHub-controlled automation, runs a fixed private fleet of persistent Ethereum Anvil fork nodes with stable remotely reachable HTTPS JSON-RPC URLs. The fleet preserves the upstream Stacks Anvil lifecycle, fork, persistence, readiness, graceful-shutdown, and corrupt-state recovery behavior required for long-running simulation use; removes browser/frontend, public node creation, accounts/auth/email, MCP, explorer, Graph/IPFS/subgraph, and other multi-user/SaaS surfaces; keeps node startup/configuration server-controlled; uses a replaceable server-side Ethereum fork-source RPC without exposing it to Contract-Automation; and produces at least one primary endpoint that can replace `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` and passes the existing Contract-Automation archive/fork-source probes plus Phase-0 smoke/full simulation qualification. Initial target fleet is four fixed nodes (`ethereum-01` through `ethereum-04`) with independent persistent state and stable URLs; no dynamic node-provisioning API is permitted.

CURRENT MAIN:
- Contract-Automation base main checked for this lock update: `05b7f78998ca5c4ba9771b33f4d3eaccb1d615fe`.
- anvil-node main checked: `9a943eca6e1f093ec449211aa7f1f11a6437f123`.

AUTHORITY:
- Human instruction in current task: self-host the Stacks-derived Anvil service in `CurveYield2/anvil-node`, keep only the functions required by Contract-Automation, expose persistent RPC links, deploy via GitHub, and execute against the task lock.
- Human-approved design from the current task: fixed private persistent Anvil fleet; no browser or third-party provisioning surface; Contract-Automation consumes stable RPC URLs; upstream Ethereum source is hidden behind the fleet and replaceable.
- `Contract-Automation/AGENTS.md` @ base main `05b7f78998ca5c4ba9771b33f4d3eaccb1d615fe`.
- `Contract-Automation/FOCUS/TASK LOCKS/TASK_LOCK_PROTOCOL_v1.md` @ blob `1f464444e1f0d148b46aeba2bd93ffda7846f834`.
- `CurveYield2/anvil-node` upstream Stacks baseline @ `9a943eca6e1f093ec449211aa7f1f11a6437f123`.
- Upstream implementation references to preserve by minimal modification where applicable:
  - `server/lib/ethui/services/anvil.ex` — Anvil lifecycle, `--fork-url`, `--state`, readiness, graceful state writes, state-load handling.
  - `server/lib/ethui/stacks/http_ports.ex` — safe port ownership behavior where still needed.
  - `server/lib/ethui/stacks/stack.ex` — Anvil option allowlisting/security model.
  - `server/lib/ethui_web/controllers/proxy_controller.ex` — RPC proxy behavior if a proxy layer remains necessary.
  - `server/Dockerfile` — Foundry/Anvil runtime installation baseline.
- Contract-Automation compatibility references:
  - `.github/workflows/lite-phase0-simulation-testing-v1.yml`
  - `.github/workflows/lite-phase0-randomized-simulation-v1.yml`
  - `.github/workflows/lite-phase0-simulation-rebind-v1.yml`
  - `scripts/run-phase0-randomized-simulation-v1.mjs`
  - `packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs`
  - `packages/github-native-sim/src/archive-rpc-identity-v1.mjs`
  - `packages/github-native-sim/src/archive-rpc-state-readiness-v1.mjs`
  - `packages/github-native-sim/src/archive-contract-code-readiness-v1.mjs`

SATISFIED:
- `CurveYield2/anvil-node` exists and its `main` is exactly the selected upstream Stacks baseline commit `9a943eca6e1f093ec449211aa7f1f11a6437f123`; no reconstruction from scratch is required.
- The upstream baseline already contains proven Anvil process lifecycle, fork-url, persistent-state, readiness, slow-state-load, and graceful-state-write behavior.
- Contract-Automation already centralizes the primary Ethereum fork source under `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` and passes it to the existing Phase-0 runner; the integration can preserve that interface.
- Contract-Automation already contains archive identity, historical-state, historical-code, local-Anvil fork, Phase-0 smoke, and full randomized-simulation qualification paths that can be reused rather than reimplemented.
- The required deployment scope is bounded: private CurveYield simulation infrastructure only, not a public Stacks service.

REMAINING DELTA:
- Inspect `CurveYield2/anvil-node` live GitHub workflows/deployment metadata and identify the smallest existing GitHub-controlled hosting path; do not invent parallel infrastructure if an existing path is usable.
- Determine the actual persistent host/runtime available to GitHub deployment. GitHub Actions itself is not a persistent host; the workflow must deploy to a durable machine/service controlled by CurveYield.
- Preserve/copy only proven upstream Stacks behaviors needed for Anvil lifecycle, readiness, persistence, safe shutdown, and recovery; prefer minimal modification of existing code over new implementation.
- Remove from the deployable runtime all unnecessary frontend/browser UI, public stack creation/deletion/listing, dynamic provisioning, user registration/auth/email, MCP, explorer, Graph Node, IPFS, subgraph, public admin, and unrelated SaaS components.
- Replace dynamic stack provisioning with exactly four fixed server-configured nodes: `ethereum-01`, `ethereum-02`, `ethereum-03`, and `ethereum-04`.
- Give every node an independent persistent state directory/volume, independent process/container, stable internal identity, and stable external HTTPS RPC route.
- Configure Anvil with server-managed equivalents of: host/port, chain ID 1, `--fork-url`, persistent `--state`, `--preserve-historical-states`, `--auto-impersonate`, `--no-rate-limit`, and quiet logging; pin the qualified Foundry/Anvil version instead of leaving production on a floating version.
- Keep the Ethereum source RPC server-side only and replaceable. Support at least a primary source and, if mechanically simple, a secondary source. Never commit or log source-RPC credentials.
- Preserve stable CurveYield RPC URLs even when the source RPC changes.
- Add the minimum TLS/reverse-proxy layer needed to expose only the fixed RPC endpoints. Native Anvil ports, Docker socket, management surfaces, and deployment controls must not be publicly reachable.
- Add health checks requiring successful JSON-RPC, `eth_chainId == 0x1`, valid `eth_blockNumber`, and block retrieval before a node is considered ready.
- Prove graceful restart preserves endpoint identity and node state. Prove corrupt-state handling quarantines the bad state and recovers without launching duplicate writers.
- Verify the RPC method surface needed by Contract-Automation, including historical reads (`eth_getBlockByNumber`, `eth_getTransactionByHash`, `eth_getTransactionCount`, `eth_getCode`, `eth_getStorageAt`, `eth_call`, logs/receipts) and direct mutable Anvil methods used by simulation/debugging.
- Qualify every fixed endpoint with the existing Contract-Automation archive identity/state/code probes.
- Qualify the primary endpoint as the fork source for the existing local Phase-0 Anvil runner.
- Run `.github/workflows/lite-phase0-simulation-testing-v1.yml` using the new primary endpoint without weakening its acceptance rules.
- Run the standard full Phase-0 randomized simulation using the new primary endpoint without weakening Medusa/telemetry/deployment requirements.
- Set or document the final primary integration mapping for `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` without exposing the secret URL in committed files or logs; record secondary/spare endpoint profiles similarly.
- Keep the final `anvil-node` live tree minimal: one canonical deployment configuration and only files required to build, deploy, operate, health-check, and qualify the fixed fleet. Do not leave duplicate historical configs or experimental versions active.
- Close the implementation branch lifecycle according to Contract-Automation policy and leave one clear production path.

PARKED OBSERVATIONS:
- The upstream repository tree did not expose an obvious LICENSE/COPYING file during initial inspection. Confirm redistribution/licensing terms before broader public redistribution of copied/modified upstream code; this does not block private technical qualification.
- A self-hosted Stacks/Anvil fleet still requires an Ethereum source RPC for previously unfetched fork state. If the available source remains rate-limited enough to prevent the required Contract-Automation qualification, that becomes an infrastructure blocker; operating a self-hosted Ethereum source/archive node is not automatically in scope unless required to satisfy the end-state.
- General Contract-Automation refactors, audit-system changes, browser automation, and unrelated repository cleanup are outside this task.

ACTIVE BLOCKER:
None

NEXT ACTION:
Inspect `CurveYield2/anvil-node` current GitHub workflows, deployment metadata, repository variables/configuration, and any existing persistent runner/host integration. Identify the one smallest GitHub-controlled deployment path that can keep the fixed Anvil service running after a workflow exits. Record only that path and the exact remaining deployment delta; do not start a second architecture or redesign unrelated Stacks code.
