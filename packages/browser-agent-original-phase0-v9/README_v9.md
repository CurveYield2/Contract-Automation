# Browser Agent Home-Exit v9

v9 keeps Playwright on the GitHub-hosted runner and uses the user's Windows PC only as a Tailscale exit node during the browser phase.

## Authentication method

v9 uses the current Tailscale GitHub Action OAuth-client flow. It does **not** require a Tailscale Auth Keys page.

Create a CI tag and OAuth client in the current admin console:

1. Open **Access controls**.
2. Open the **Tags** tab in the visual editor.
3. Create a tag named `ci` (Tailscale stores it as `tag:ci`). Leaving owners empty is fine for an admin-owned CI tag.
4. Open **Trust credentials**.
5. Create an **OAuth client**.
6. Give it writable **Keys > Auth Keys** permission.
7. Associate it with `tag:ci`.
8. Copy the generated OAuth **Client ID** and **Client secret**.
9. Add them to GitHub Actions secrets in CurveYield2/Contract-Automation as:
   - `TS_OAUTH_CLIENT_ID`
   - `TS_OAUTH_SECRET`

The GitHub Action creates an ephemeral, tagged tailnet node for each run.

## Exit-node permission

On default Tailscale policy, exit-node use is allowed without an extra grant.

If this tailnet has a custom access-control policy, ensure `tag:ci` can use `autogroup:internet`, for example:

```json
{
  "grants": [
    {
      "src": ["tag:ci"],
      "dst": ["autogroup:internet"],
      "ip": ["*"]
    }
  ]
}
```

Merge that with existing policy; do not replace unrelated policy rules.

## Windows PC

The Windows PC only needs Tailscale running in the background and advertising itself as an exit node.

Its observed Tailscale IPv4 during setup was `100.112.238.56`.

In the Tailscale Windows app/admin console:

1. Advertise **Run as exit node**.
2. Approve **Use as exit node** for this PC if approval is requested.
3. Keep the PC awake while browser automation runs.

## First browser test

Run workflow:

`Original Phase0 Home-Exit Browser v9`

Use:

- `action=observe`
- `mode=create_fresh`
- `home_exit_node=100.112.238.56`
- `interactive_view=true`
- `manual_challenge_wait_minutes=15`

No message is sent in observe mode.

The runner joins the tailnet, switches its browser-phase internet egress through the Windows exit node, opens headful Chrome under Xvfb, and waits until ChatGPT backend probes are healthy.

## Manual login / challenge

With `interactive_view=true`, the workflow prints:

`TAILSCALE_VNC=<runner-tailnet-ip>:5900`

From the Windows PC, connect a VNC viewer to that private Tailscale address to interact with the actual runner Chrome window and complete any normal ChatGPT login or verification.

## Resume test

After observe succeeds, run:

- `action=wake`
- `mode=resume_existing`
- `chat_url=https://chatgpt.com/c/6abe90a0-fd68-83e8-8026-8af0171605fc`

v9 only reports delivery when the actual ChatGPT `/backend-api/f/conversation/prepare` request succeeds. A local message bubble or `Unknown error / Retry` is failure.
