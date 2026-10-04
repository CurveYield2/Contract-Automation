# Development Agent Task-Lock State v1

MANAGER ID:
browser-monitor-click-control

END-STATE INVARIANT:
A standalone isolated GitHub Actions browser screenshare workflow exists in Contract-Automation that launches a visible authenticated Chrome session and exposes it over the private Tailscale network through browser-based noVNC with full interactive mouse, click, scroll, and keyboard control; the session remains live for a configurable hold window, and successful external interaction is verified without modifying or depending on the audit Project/wake automation path.

CURRENT MAIN:
0c8db1f3240d069c40bad2c698a7a1564292d792

AUTHORITY:
FOCUS/TASK LOCKS/TASK_LOCK_PROTOCOL_v1.md @ blob 1f464444e1f0d148b46aeba2bd93ffda7846f834
FOCUS/TASK LOCKS/TASK_LOCK_STATE_TEMPLATE_v1.md @ blob d491d7c8cf3842f62226e47912a7a87c1f3ff621
Human task authority: create a working isolated browser monitor/screenshare with click abilities; prioritize full interactive browser control and keep it isolated from the audit/browser-wake workflow.

SATISFIED:
- Isolated screenshare implementation exists separately from the audit/browser-wake workflow.
- Browser Active Screenshare v1 live run verified the VNC RFB handshake, noVNC HTTP surface, and noVNC WebSocket upgrade on the runner.
- x11vnc is configured for interactive input rather than view-only operation.
- noVNC is configured with view_only=0 and shared interactive access.
- The v1 Chrome-launch failure was isolated to the system Chrome executable path not being exported into the same launch step.
- Browser Active Screenshare v2 exists on current main with the system Chrome executable exported for the same-step Playwright child process.

REMAINING DELTA:
- Live-run Browser Active Screenshare v2 and verify visible Chrome reaches the held interactive-session state.
- Verify the private noVNC URL is reachable from the user's Tailscale-connected browser.
- Verify external mouse movement, click, scroll, and keyboard input through noVNC visibly control the runner Chrome session.
- If any of those checks fail, make only the smallest transport/input repair required and re-run until all interactive checks pass.

PARKED OBSERVATIONS:
- Browser Active Screenshare v1 remains in the repository as an earlier failed version; removing or retiring it is not required to prove the interactive v2 end-state unless it creates ambiguity or conflicts with execution.
- Audit Project/wake browser automation has separate unresolved behavior and is outside this lock's scope.

ACTIVE BLOCKER:
None

NEXT ACTION:
Trigger Browser Active Screenshare v2, verify it reaches the held live Chrome session, then have the user connect through its private noVNC URL and confirm mouse/click/scroll/keyboard control.
