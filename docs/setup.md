# PreflightSim Lite deployment setup

## 1. Cloudflare resources

Create:

- An R2 bucket named `preflightsim-lite`.
- A Worker for `apps/api/src/index.mjs`.
- A Pages project for the `dist/web` build.
- DNS routes for `api.preflightsim.curveyield.online` and `preflightsim.curveyield.online`.

Set Worker secrets with Wrangler:

```bash
npx wrangler secret put CLIENT_API_KEY --config apps/api/wrangler.toml
npx wrangler secret put RUNNER_API_KEY --config apps/api/wrangler.toml
npx wrangler secret put GITHUB_TOKEN --config apps/api/wrangler.toml
npx wrangler secret put R2_ACCOUNT_ID --config apps/api/wrangler.toml
npx wrangler secret put R2_ACCESS_KEY_ID --config apps/api/wrangler.toml
npx wrangler secret put R2_SECRET_ACCESS_KEY --config apps/api/wrangler.toml
```

Use a GitHub token restricted to the PreflightSim repository with Actions write permission. The client and runner API keys must be different long random values.

Configure R2 browser-upload CORS to allow `PUT` from `https://preflightsim.curveyield.online` with the `content-type` header. Configure an R2 lifecycle rule that deletes `uploads/` and `jobs/` objects after 30 days.

## 2. GitHub repository variables

Create these Actions variables:

```text
PREFLIGHTSIM_API_URL=https://api.preflightsim.curveyield.online
PAGES_PROJECT_NAME=preflightsim-lite
```

## 3. GitHub repository secrets

```text
PREFLIGHTSIM_RUNNER_API_KEY
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
RPC_ETHEREUM
RPC_BASE
RPC_KATANA
RPC_FRAXTAL
RPC_ARBITRUM
RPC_POLYGON
RPC_OPTIMISM
```

The RPC values are read-only fork sources. Do not store wallets or private keys in this repository.

## 4. Deploy

Push to `main` or run the `Test and Deploy PreflightSim Lite` workflow manually. The deploy workflow runs tests, builds the static site, deploys the Worker, and uploads `dist/web` to Cloudflare Pages.

## 5. Test an agent job

Open `/agent/`, enter the client API key, and submit the default compile-only request. The returned permanent job URL contains only the job ID; the API key remains separate in session storage.
