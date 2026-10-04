# Development Agent Task-Lock State v1

MANAGER ID:
browser-monitor-click-control

END-STATE INVARIANT:
A standalone isolated GitHub Actions browser screenshare workflow exists in Contract-Automation that launches a visible authenticated Chrome session and exposes it over the private Tailscale network through browser-based noVNC with full interactive mouse, click, scroll, and keyboard control; the session remains live for a configurable hold window, and successful external interaction is verified without modifying or depending on the audit Project/wake automation path.

CURRENT MAIN:
b8f858f81ed9b776bb01693973dc2ac0a87fe4a9

AUTHORITY:
FOCUS/TASK LOCKS/TASK_LOCK_PROTOCOL_v1.md @ blob 1f464444e1f0d148b46aeba2bd93ffda7846f834
FOCUS/TASK LOCKS/TASK_LOCK_STATE_TEMPLATE_v1.md @ blob d491d7c8cf3842f62226e47912a7a87c1f3ff621
Human task authority: use a functional public interactive Playwright/noVNC implementation as the baseline, then copy/adapt it minimally into the existing browser automation/audit workflow.
Public technical baseline: DmitriyG228/playwright-vnc @ 3621cf7c2d5307df19c55b75fdbadc5cda064e8c (MIT). Relevant upstream files: start.sh, Dockerfile, agent-example.js.

SATISFIED:
- Isolated screenshare implementation exists separately from the audit/browser-wake workflow.
- Browser Active Screenshare v1 live run verified the VNC RFB handshake, noVNC HTTP surface, and noVNC WebSocket upgrade on the runner.
- x11vnc is configured for interactive input rather than view-only operation.
- noVNC is configured with view_only=0 and shared interactive access.
- The v1 Chrome-launch failure was isolated to the system Chrome executable path not being exported into the same launch step.
- Browser Active Screenshare v2 exists on current main with the system Chrome executable exported for the same-step Playwright child process.

REMAINING DELTA:
- Port only the proven upstream Xvfb + Fluxbox + x11vnc + websockify/noVNC display stack into the existing v10 audit browser workflow.
- Keep the existing audit Project/chat Playwright automation logic unchanged.
- Adapt remote exposure only for the existing private Tailscale environment.
- Run the adapted workflow and verify the noVNC URL is reachable and supports real mouse, click, scroll, and keyboard input while the same headed Playwright browser is running.
- If verification fails, repair only the monitor/display transport; do not redesign the audit browser flow.

PARKED OBSERVATIONS:
- Browser Active Screenshare v1 remains in the repository as an earlier failed version; removing or retiring it is not required to prove the interactive v2 end-state unless it creates ambiguity or conflicts with execution.
- Audit Project/wake browser automation has separate unresolved behavior and is outside this lock's scope.

ACTIVE BLOCKER:
None

NEXT ACTION:
Create one repair branch from current main, copy the upstream display/VNC startup pattern into browser-agent-home-exit-v10 with only Tailscale-specific exposure changes, then live-verify interactive control before merging.