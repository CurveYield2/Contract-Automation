# PreflightSim Lite

PreflightSim Lite is a Cloudflare Pages/Worker and GitHub Actions service for Solidity compilation and stateful, single-chain live-RPC fork simulation. Submitted projects are treated as source data. Their scripts are never executed.

## Interfaces

- Human and browser-agent UI: `https://preflightsim.curveyield.online/`
- Minimal agent UI: `https://preflightsim.curveyield.online/agent/`
- REST API: `https://api.preflightsim.curveyield.online/api/v1/`
- Private Custom GPT Action: `integrations/custom-gpt/`
- Ordinary-chat GitHub issue bridge: `integrations/github-bridge/`

## V7 canonical operations

Audit V7 has one active execution workflow, one active qualification workflow, one generated runner manifest, and one CLI surface:

- `.github/workflows/audit-controller-execution.yml`
- `.github/workflows/v7-execution-infrastructure-qualification.yml`
- `process/RUNNER_MANIFEST.json`
- `npm run v7 -- help`

Common commands:

```bash
npm run v7:execute -- --request <request.json>
npm run v7:submit -- --request <request.json>
npm run v7:harness:init -- --request <request.json>
npm run v7:harness:validate -- --bundle <bundle-id> --request <request.json>
npm run v7:manifest -- --check
```

The REST/API security boundary rejects user RPC URLs, private keys, raw signed transactions, shell commands, project scripts, and broadcast operations. GitHub Actions runs only trusted runner code from this repository.

## Mutable RPC and simulation backend policy

`SIM_ARCHIVE_PRIMARY_ETHEREUM_01` is the approved existing mutable Ethereum Anvil RPC path for V7 work requiring mutable/fork-state RPC semantics. Request authors do not provide alternate RPC URLs.

**Anvil is the only approved backend for authoritative full simulations.** Full/live/archive-RPC forks, deployment simulations, lifecycle simulations, and V7 Phase-7 execution use Anvil. Ganache is not a compatibility fallback for authoritative evidence. If Anvil execution fails, preserve typed failure evidence and repair the approved path rather than substituting another backend or downgrading the requested EVM profile.

Phase 6 Medusa and Foundry use the same preflight-frozen mutable Anvil RPC identity. Phase 6 stages exact source plus the audit overlay once, hashes that snapshot, then executes from a local copy of that same snapshot.

## Archive policy

Superseded, deprecated, obsolete, or historical-only repository files do **not** remain beside current files. They belong in private `CurveYield2/archive` under:

`Contract-Automation/<original-path>`

Archive files are provenance/recovery material only and are never active V7 instructions. See `AGENTS.md` for the enforced agent policy.

## Local checks

```bash
npm test
npm run lint
npm run build
```

The full runner integration requires installed npm dependencies and the approved runner-managed RPC secret. See `docs/setup.md`.
