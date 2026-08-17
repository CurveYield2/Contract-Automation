# Install the private PreflightSim GPT Action

1. Open **Explore GPTs → Create** in ChatGPT.
2. Add the contents of `instructions.md` to the GPT Instructions field.
3. Open **Actions → Create new action**.
4. Choose **API key** authentication and **Bearer** mode.
5. Enter the dedicated private key configured as the Cloudflare Worker's `GPT_API_KEY`.
6. Import or paste `action-schema.json`.
7. Use `https://preflight.curveyield.online/privacy.html` as the privacy-policy URL if the editor requests one.
8. Test `listSupportedChains` in Preview, then submit a small compile-only inline contract.
9. Keep the GPT private or workspace-restricted. Actions are unavailable in ChatGPT Pro mode; select a model that supports Actions.

The OpenAPI JSON file is only the tool description consumed by the GPT editor. It does not call the separately billed OpenAI developer API.
