# Contract-Automation Agent Execution Policy

Policy version: v1

## Full simulation backend — mandatory

**All full, live-RPC, archive-RPC, mainnet-fork, lifecycle, deployment, or Phase-7 audit simulations MUST use Anvil.**

- Anvil is the only approved backend for full simulations in this repository.
- Do not use Ganache for full simulations, even for older EVM versions or as a compatibility fallback.
- Do not silently downgrade the configured EVM version to make another backend work.
- Preserve the request's exact compiler/EVM profile and execute it on Anvil.
- For Ethereum Phase-7 archive simulations, continue to use `SIM_ARCHIVE_PRIMARY_ETHEREUM_01` through the trusted Contract-Automation execution lane.
- Ganache code may remain only for bounded lightweight/local regression utilities that are not authoritative full-simulation evidence. It must never be selected by the V7 Phase-7/full-fork execution path.

If Anvil cannot start or cannot execute a required fork, fail with typed execution evidence and repair the Anvil path. Do not substitute Ganache.

## Audit execution boundary

Private audit/controller repositories are control planes. Technical/rate-limited execution belongs in this public Contract-Automation repository through the existing bridge. Do not add workload-running audit workflows to private controller repositories.
