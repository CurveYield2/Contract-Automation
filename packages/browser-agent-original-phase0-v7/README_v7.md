# Browser Agent Home-Egress v7

v7 keeps GitHub-hosted Playwright as the browser executor and routes only Chrome's network traffic through the user's normal home network.

## Architecture

GitHub-hosted runner
→ local SOCKS5 port on the runner
→ SSH tunnel over Tailscale
→ user's Windows PC
→ user's normal internet connection
→ ChatGPT

The audit/controller work stays in GitHub Actions. The Windows PC is only an SSH network endpoint.

## Optional interactive browser viewing

The same SSH connection can also create a reverse VNC tunnel:

GitHub runner Xvfb/Chrome
→ x11vnc bound to runner localhost
→ SSH reverse forward
→ 127.0.0.1:5901 on the user's Windows PC

Nothing is exposed publicly. When interactive view is enabled, connect any VNC viewer on the Windows PC to:

`127.0.0.1:5901`

This lets the user personally complete ordinary ChatGPT login or verification if required.

## Required GitHub secrets

- `TAILSCALE_AUTHKEY` — preferably an ephemeral reusable Tailscale auth key.
- `HOME_PROXY_TAILSCALE_HOST` — the Windows PC's Tailscale IP or MagicDNS name.
- `HOME_PROXY_SSH_USER` — Windows OpenSSH username.
- `HOME_PROXY_SSH_PRIVATE_KEY` — private key whose public half is authorized for that Windows account.
- `CHATGPT_STORAGE_STATE_B64` — retained only as bootstrap login state.
- `CHATGPT_SESSION_STATE_KEY_B64` — optional; when present, protects the refreshed rolling browser state.

No Browserless or Browserbase credentials are required or used by the v7 workflow.

## Windows PC one-time setup

The PC only needs Tailscale and Windows OpenSSH Server running in the background. OpenSSH must allow TCP forwarding. No GitHub runner or browser automation runs locally.

Recommended `sshd_config` settings:

```
PubkeyAuthentication yes
AllowTcpForwarding yes
GatewayPorts no
```

Keep port 22 reachable only through Tailscale/firewall policy where practical.

Authorize the public key corresponding to `HOME_PROXY_SSH_PRIVATE_KEY` for `HOME_PROXY_SSH_USER`.

## Refreshed login state

The workflow restores/saves the same encrypted Playwright storage-state mechanism used by the known-good September-27 browser implementation. If you manually log in or clear a normal verification challenge through VNC, the refreshed session state is encrypted and cached for later v7 runs.

The cache never contains plaintext storage state.

## Success rules

v7 refuses to send until ordinary ChatGPT backend probes are healthy and not marked `cf-mitigated: challenge`.

After Send, v7 also requires the real ChatGPT `/backend-api/f/conversation/prepare` response to succeed. A local UI bubble, `Unknown error / Retry`, or `local-chatgpt:` route cannot be reported as successful delivery.
