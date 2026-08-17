# PreflightSim Lite Specification

## Goal

Deploy a no-server Solidity compilation and single-chain live-RPC fork simulation service that is callable through a normal authenticated REST API and usable by ChatGPT web agents through a Cloudflare Pages UI.

## Runtime architecture

- Cloudflare Pages hosts the human/browser-agent UI, agent job pages, API reference, and privacy policy.
- A Cloudflare Worker exposes the authenticated API, stores jobs/projects/results in R2, and dispatches trusted GitHub Actions workflows.
- GitHub Actions runs only trusted repository code. Submitted repositories, ZIPs, and Solidity sources are data; their scripts are never executed.
- The runner compiles Solidity with solc-js, starts a local Ganache stateful fork from an allowlisted RPC, performs structured EVM actions, and uploads JSON/HTML results to the Worker/R2.
- No AWS, home server, Docker daemon, private key, real signing, or transaction broadcast is used.

## Supported clients

- Ordinary web agents through the public Pages UI.
- Human browser users.
- Direct API clients.

## Initial chains

- Ethereum
- Base
- Katana
- Fraxtal
- Arbitrum
- Polygon
- Optimism

Each chain name maps to a GitHub Actions secret. Users cannot submit RPC URLs.

## Project inputs

- Public GitHub repository plus optional ref.
- Inline Solidity files for small projects.
- ZIP uploaded through a short-lived R2 upload URL.

Maximum uploaded archive: 250 MB. Public GitHub downloads and ZIP extraction enforce path traversal, extracted-size, and file-count limits.

## Compilation

- Solidity only in Lite v1.
- Exact `compilerVersion` is required unless every source uses the same exact pragma.
- Initial locally pinned compiler: 0.8.30.
- Other exact compiler versions are fetched only from the official Solidity compiler distribution.
- Local relative imports are supported.
- OpenZeppelin Contracts is the only initial remote dependency allowlist and requires an exact version.
- Project scripts, npm lifecycle scripts, Hardhat scripts, Foundry scripts, and tests are never executed.

## Structured simulation actions

- `deploy`
- `call`
- `staticCall`
- `expectRevert`
- `setBalance`
- `transferNative`
- `mine`
- `increaseTime`
- `snapshot`
- `revertSnapshot`
- `assertBalance`
- `assertCall`

Aliases created by deployments can be referenced as `$alias`. The runner preserves state across every step.

## Security boundary

Allowed:

- Trusted compilation of supplied Solidity source.
- Local simulated signing with ephemeral Ganache accounts.
- Local account unlocking/impersonation inside the fork.
- Local simulated state mutation.
- Read-only access to allowlisted chain RPCs.

Forbidden:

- User-provided RPC URLs.
- Private keys supplied by users.
- `eth_sendRawTransaction` or any real-chain broadcast path.
- Arbitrary shell commands or project scripts.
- Arbitrary outbound URLs.
- Private GitHub repositories in Lite v1.
- Multi-chain jobs, LayerZero, CCIP, Vyper, real deployment, and verification.

## API

No OpenAPI import, GPT Action, or OpenAI API account is required. Browser agents use the semantic HTML agent pages; scripts use the same REST endpoints directly.

Public authenticated endpoints:

- `GET /api/v1/health`
- `GET /api/v1/chains`
- `POST /api/v1/uploads`
- `POST /api/v1/jobs`
- `GET /api/v1/jobs/{jobId}`
- `GET /api/v1/jobs/{jobId}/result`
- `GET /api/v1/jobs/{jobId}/report`

Runner-only endpoints:

- `GET /internal/v1/jobs/{jobId}`
- `GET /internal/v1/jobs/{jobId}/project`
- `POST /internal/v1/jobs/{jobId}/status`
- `POST /internal/v1/jobs/{jobId}/result`

## Job lifecycle

`queued -> running -> completed | failed`

The Worker writes the request to R2 and invokes a GitHub Actions workflow with only the job ID. The runner fetches the authoritative request from the Worker, executes it, and returns results. Clients poll status.

## Reports

- Machine-readable JSON is authoritative.
- A self-contained HTML report is generated from the same JSON.
- Compiler errors, transaction receipts, gas, logs, decoded returns, reverts, assertions, and deployed addresses are preserved.
- Reports default to 30-day R2 retention through bucket lifecycle rules.

## Deployment

- GitHub Actions runs tests and builds both apps.
- Wrangler deploys the Worker.
- Wrangler uploads the static Pages build.
- Intended domains:
  - `preflight.curveyield.online`
  - `preflight.curveyield.online`

