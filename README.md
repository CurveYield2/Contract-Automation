# PreflightSim Lite

PreflightSim Lite is a Cloudflare Pages/Worker and GitHub Actions service for Solidity compilation and stateful, single-chain live-RPC fork simulation. Submitted projects are treated as source data. Their scripts are never executed.

## Interfaces

- Human and browser-agent UI: `https://preflightsim.curveyield.online/`
- Minimal agent UI: `https://preflightsim.curveyield.online/agent/`
- REST API: `https://api.preflightsim.curveyield.online/api/v1/`
- Private Custom GPT Action: `integrations/custom-gpt/`
- Ordinary-chat GitHub issue bridge: `integrations/github-bridge/`

The REST API uses bearer authentication. Browser agents can use the HTML interface, a private Custom GPT can use the included Action schema, and ordinary connected chats can use the GitHub issue bridge. None of these paths call the separately billed OpenAI developer API.

## Security boundary

The service accepts Solidity source, ZIP archives, public GitHub repositories, and structured EVM workflows. It rejects user RPC URLs, private keys, raw signed transactions, shell commands, project scripts, and broadcast operations. GitHub Actions runs only the trusted runner from this repository.

## Local checks

```bash
npm test
npm run lint
npm run build
```

The full runner integration requires installed npm dependencies and an allowlisted RPC secret. See [deployment setup](docs/setup.md).
