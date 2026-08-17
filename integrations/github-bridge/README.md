# PreflightSim GitHub issue bridge

The GitHub bridge gives ordinary ChatGPT web chats a machine-callable path without arbitrary HTTP access. A connected ChatGPT agent creates a structured issue with the `preflightsim-job` label. GitHub Actions validates the author and payload, submits the job to PreflightSim, polls it, posts the compact summary and chunked JSON result as comments, and closes the issue.

## Security model

- Only GitHub users listed in the repository variable `PREFLIGHTSIM_ALLOWED_GITHUB_USERS` may submit jobs.
- The bridge runs trusted code from the repository default branch.
- Issue text is parsed as JSON data and is never evaluated by a shell.
- The normal PreflightSim protocol rejects private keys, RPC URLs, signed transactions, scripts, shell commands, and broadcast operations.
- Duplicate execution is rejected when a bridge-start marker already exists in the issue comments.
- Use a private repository if project details or simulation output are confidential.

## Required repository configuration

Create this label exactly:

```text
preflightsim-job
```

Create these GitHub Actions values:

```text
Variable: PREFLIGHTSIM_API_URL=https://preflight.curveyield.online
Variable: PREFLIGHTSIM_ALLOWED_GITHUB_USERS=James-Nexus
Secret:   PREFLIGHTSIM_GITHUB_BRIDGE_API_KEY=<same private key as Worker GITHUB_BRIDGE_API_KEY>
```

Multiple allowed users are comma-separated. Matching is case-insensitive.

## Ordinary ChatGPT agent workflow

1. Connect the GitHub app to ChatGPT and grant access to the private bridge repository.
2. Give the agent the repository name and ask it to create an issue using `issue-template.md`.
3. Require the agent to apply the `preflightsim-job` label at creation time.
4. GitHub Actions posts an acceptance comment, a job ID, a final summary, and one or more JSON result comments.
5. Ask the agent to fetch the issue and all comments, then interpret the simulation result.

The GitHub connector does not need access to the PreflightSim API key. The key exists only as a repository secret used by the trusted workflow.
