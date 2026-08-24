# V7 GitHub-native qualification tests

Changes under this directory intentionally match the canonical V7 execution-infrastructure qualification workflow's `pull_request` and `push` path filters. For ChatGPT web-agent operation, a reviewed documentation-only change here can therefore be used to create an agent-operable qualification event when the direct GitHub `workflow_dispatch` control is unavailable.

The pull-request run validates the candidate without trusted-main secrets. After merge to `main`, the push-triggered run executes the additional trusted-main Phase 6 / Phase 7 live qualification and publishes `process/V7_QUALIFICATION_STATUS.json` only after the complete qualification passes.
