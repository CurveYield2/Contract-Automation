# Original Phase-0 Self-Hosted Browser v6

This path keeps Playwright but moves Chrome execution from GitHub-hosted Azure runners onto a self-hosted runner on the user's normal network.

## Why

The exact September-27 browser code was proven to work. Current GitHub-hosted Chrome receives Cloudflare `cf-mitigated: challenge` responses from ChatGPT backend endpoints. v6 does not attempt to bypass that protection. It runs a normal visible Chrome window on the user's own machine/network and allows the user to complete ordinary ChatGPT login or verification interactively.

## Important runner requirement

Run the GitHub self-hosted runner **interactively in the logged-in desktop session**, not as a Windows service. The Playwright Chrome window must be visible to the user. Give the runner the custom label:

`curveyield-browser`

The workflow targets:

`[self-hosted, curveyield-browser]`

## Persistent local login state

v6 uses Playwright `launchPersistentContext` with:

`~/.curveyield/chatgpt-playwright-profile-v6`

The profile stays on the self-hosted machine. ChatGPT login cookies and any normal browser verification state do not need to be copied into GitHub Secrets.

On the first run, Chrome opens visibly and the workflow waits while the user signs in or completes any verification page. The workflow polls normal ChatGPT backend endpoints. It will not send a wake until the backend is healthy and no `cf-mitigated: challenge` response is present.

## Trigger

Push one JSON request into:

`process/browser-agent-self-hosted-v6/requests/`

or manually run:

`Original Phase0 Self-Hosted Browser v6`

The included current-chat request targets the conversation used for this recovery test.

## Security

The persistent browser profile remains local to the self-hosted runner. Do not upload it to GitHub, Actions artifacts, caches, or logs.
