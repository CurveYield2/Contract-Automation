# Development Agent Task-Lock State v2

MANAGER ID:
curveyield-ephemeral-anvil-simulation

END-STATE INVARIANT:
CurveYield2/Contract-Automation runs all required forked-chain smart-contract simulations entirely inside ordinary GitHub-hosted Ubuntu Actions jobs. Each simulation job uses dRPC's public Ethereum endpoint (`https://eth.drpc.org/`) only as the upstream Ethereum fork-state source, then launches and uses its own local mutable Anvil instance on the same GitHub runner for deployment, mutation, Medusa, ABI telemetry, targeted testing, and other simulation activity. The local Anvil instance exists only for the duration of the workflow job and may be discarded when the job ends. No persistent remote Anvil service, public RPC endpoint, Cloudflare service, Cloudflare Worker, Cloudflare R2 dependency, Cloudflare Tunnel, Codespace, external VM, self-hosted GitHub runner, Caddy proxy, DNS configuration, or persistent RPC hosting is required.

CURRENT MAIN:
- Contract-Automation main at lock rewrite: `3dd1c96125ee4e09418e7d80ea8fe597b77eab73`.
- The existing simulation runner already accepts `--fork-url` and launches the mutable local Anvil simulation environment.
- dRPC public Ethereum RPC was already proven during the Anvil qualification work to satisfy the existing Contract-Automation archive identity, historical-state, and historical-code probes at block 18,000,000.
- The earlier persistent `CurveYield2/anvil-node` fleet work is superseded for this task and is not a production dependency.

AUTHORITY:
- Human specification: only provide the simplest mechanism required to run forked-chain simulations when Contract-Automation simulation workflows execute.
- Human clarification: no persistent always-on RPC server is required.
- Human clarification: no Cloudflare service is required for this specification.
- Human clarification: dRPC solves the Ethereum state-source requirement.
- Existing Contract-Automation simulation behavior and acceptance rules remain authoritative; do not weaken Medusa, telemetry, deployment, archive-state, or evidence requirements to simplify the RPC architecture.
- `Contract-Automation/AGENTS.md`.
- `Contract-Automation/FOCUS/TASK LOCKS/TASK_LOCK_PROTOCOL_v1.md`.

CANONICAL ARCHITECTURE:
```text
GitHub Actions ubuntu-latest runner
        |
        | upstream fork reads only
        v
https://eth.drpc.org/
        |
        v
local Anvil spawned inside the same workflow job
        |
        +--> contract deployment simulation
        +--> mutable state changes
        +--> Medusa
        +--> ABI telemetry
        +--> randomized / targeted simulation
        +--> evidence generation
        |
        v
job ends -> local Anvil is discarded
```

SCOPE:
- Contract-Automation simulation workflows only.
- GitHub-hosted Linux Actions compute only.
- dRPC public Ethereum RPC as the default/canonical Ethereum fork-state source.
- Local ephemeral Anvil only.
- Existing Contract-Automation simulation scripts and evidence formats must be reused with minimal changes.

EXPLICIT NON-GOALS:
- No deployment of `CurveYield2/anvil-node` as a persistent service.
- No four-node permanent RPC fleet.
- No public Anvil URL.
- No stable externally reachable RPC endpoint.
- No Cloudflare Worker.
- No Cloudflare Containers.
- No Cloudflare Tunnel.
- No Cloudflare R2.
- No Cloudflare DNS requirement.
- No Codespaces.
- No Oracle/free VM.
- No self-hosted GitHub Actions runner.
- No Caddy or other reverse proxy.
- No persistence of Anvil state between separate workflow runs unless a later human instruction explicitly adds it.
- No new RPC-management subsystem.
- No new browser or node-provisioning UI.

SATISFIED:
- GitHub-hosted Ubuntu runners already provide the Linux compute needed to execute Anvil.
- The existing Phase-0 runner already requires a fork URL and launches/uses a mutable local Anvil environment rather than requiring a remotely mutable RPC.
- The existing simulation code already normalizes EVM execution to the canonical Ethereum Anvil baseline.
- The existing simulation workflows already run on `ubuntu-latest`.
- dRPC's public Ethereum endpoint has already passed the real Contract-Automation archive identity, historical-state, and historical-code probes during prior qualification.
- dRPC has already successfully served as the upstream source for Anvil during four-node qualification.
- Local Anvil mutation, impersonation, snapshots, mining, historical reads, persistence within a run, and nested-Anvil fork-source behavior were already proven during prior qualification.
- The persistent `anvil-node` implementation is no longer needed to satisfy the actual simulation requirement.

REMAINING DELTA:
- Update `.github/workflows/lite-phase0-randomized-simulation-v1.yml` so its default Ethereum fork source is `https://eth.drpc.org/` and it no longer requires `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` merely to start a normal Ethereum simulation.
- Update `.github/workflows/lite-phase0-simulation-testing-v1.yml` to use the same dRPC source directly for the smoke simulation path.
- Update `.github/workflows/lite-phase0-simulation-rebind-v1.yml` to use the same dRPC source directly.
- Search Contract-Automation for any additional live simulation path that consumes `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` or otherwise expects a remote mutable Anvil RPC; update only genuine simulation consumers.
- Preserve the existing `--fork-url` interface in the runner so a different upstream RPC can still be supplied manually later if necessary; do not hardwire dRPC deep inside the simulation engine if the workflow layer can supply it cleanly.
- Prefer one canonical workflow-level/default constant for the dRPC URL where mechanically simple; avoid duplicate RPC-selection subsystems.
- Keep Anvil local to the GitHub runner and bound to loopback/internal job use. Do not expose its RPC publicly.
- Add or retain a lightweight preflight that proves dRPC returns Ethereum chain ID 1 and required historical state before spending the full simulation budget.
- Run the existing Phase-0 simulation smoke workflow using dRPC as the upstream and require the requested Medusa/telemetry stage to pass.
- Run the standard full Phase-0 randomized simulation using dRPC as the upstream source and require all existing completion gates to pass.
- Confirm the resulting simulation evidence still records the canonical Ethereum Anvil baseline and does not imply that dRPC itself is the mutable simulation engine.
- Remove obsolete error messages/documentation that state `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` is mandatory for the ordinary default Ethereum simulation path.
- Do not delete or redesign the already-merged `CurveYield2/anvil-node` repository as part of this lock; it is simply no longer required by the active architecture.

ACCEPTANCE CRITERIA:
- A Contract-Automation simulation workflow can begin with no private Anvil RPC secret.
- The workflow runs on `ubuntu-latest`.
- dRPC supplies upstream Ethereum fork state.
- The simulation runner launches the local Anvil environment successfully.
- The local Anvil reports Ethereum chain ID 1.
- Historical state/code required by the simulation is readable through the fork.
- Contract deployment into local Anvil succeeds to the same standard required by the current simulation system.
- Mutable Anvil operations are performed locally, not against dRPC.
- The Phase-0 smoke workflow passes its requested Medusa and/or telemetry acceptance gates.
- The full Phase-0 randomized simulation passes the existing deployment, Medusa, telemetry, and evidence gates without reduced thresholds.
- No Cloudflare, persistent host, public RPC server, Codespace, VM, DNS, or self-hosted runner is required.
- No new secret is required solely to obtain the default Ethereum fork source.
- No unrelated audit/controller/browser workflow is changed.

PARKED / SUPERSEDED WORK:
- `CurveYield2/anvil-node` main commit `79ee877cbeee3a783e1e065dc4f1cea3c7524379` contains a qualified persistent four-node fleet implementation. That work remains intact but is superseded by the simpler requirement and is not part of the active production path.
- The previous persistent-host blockers, Cloudflare considerations, Caddy routes, DNS, self-hosted runner labels, and repository deployment secrets are no longer blockers because the persistent-service requirement was removed.
- Whether the merged `anvil-node` feature branch is eventually deleted is repository hygiene, not part of this simulation lock.

ACTIVE BLOCKER:
None.

NEXT ACTION:
Modify the live Contract-Automation simulation workflows to use `https://eth.drpc.org/` as the canonical default upstream Ethereum fork source while preserving the existing local-Anvil runner. Then execute the existing smoke simulation workflow and full randomized simulation qualification. Do not deploy or expose any remote Anvil service.
