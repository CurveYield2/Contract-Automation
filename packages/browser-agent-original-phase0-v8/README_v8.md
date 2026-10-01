# Browser Agent Home-Exit v8

v8 keeps Playwright on the GitHub-hosted runner and uses the user's Windows PC only as a Tailscale exit node during the browser phase.

## Architecture

1. GitHub performs checkout/runtime preparation normally.
2. The workflow joins the user's Tailscale network.
3. Immediately before Chrome starts, the runner selects the Windows PC as its Tailscale exit node.
4. Chrome runs headful under Xvfb. ChatGPT traffic therefore exits through the user's normal home internet address.
5. Immediately after the browser step, the runner disables the exit node before later GitHub/cache activity.

No OpenSSH server, SOCKS daemon, local GitHub runner, Browserless, or Browserbase is required.

## Windows PC

The PC only needs Tailscale running in the background.

In the Tailscale Windows app:

1. Open **Exit node**.
2. Select **Run as exit node**.
3. In the Tailscale admin console, approve the PC for **Use as exit node** if approval is requested.
4. Keep the PC awake while browser automation is running.

Windows exit nodes are supported by Tailscale.

## GitHub configuration

Required:

- `TAILSCALE_AUTHKEY`: reusable ephemeral auth key for the GitHub workflow.
- `HOME_TAILSCALE_EXIT_NODE`: repository variable or workflow input containing the Windows PC's Tailscale IP or MagicDNS name.
- existing ChatGPT browser-state secrets.

The current Windows Tailscale IPv4 observed during setup was `100.112.238.56`; prefer a stable MagicDNS machine name if available.

## Optional interactive browser view

When `interactive_view=true`, x11vnc binds only to the GitHub runner's Tailscale IP. The workflow prints:

`TAILSCALE_VNC=<runner-tailnet-ip>:5900`

From the Windows PC, connect a VNC viewer to that address. The VNC endpoint is reachable through the private tailnet and exists only while the job runs.

This lets the user personally complete normal ChatGPT login or Cloudflare verification if shown.

## Authentication-only bootstrap

Use `action=observe` with `interactive_view=true` first.

The browser opens ChatGPT and waits until backend probes are healthy. If login/verification appears, complete it through VNC. Once healthy, the encrypted Playwright state is saved for future runs without posting a message.

Then run `action=wake` with `mode=resume_existing` for the target conversation.

## Success criteria

v8 refuses to send while ChatGPT backend probes return `cf-mitigated: challenge`.

After Send, it requires the real `/backend-api/f/conversation/prepare` request to return success. A local message bubble or `Unknown error / Retry` cannot count as successful delivery.
