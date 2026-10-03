# Development Agent Task-Lock State v1

MANAGER ID:
audit-wake-human-only-v1

END-STATE INVARIANT:
Phase 1 audit wake/watch automation creates a brand-new ChatGPT Project through visible human-style UI interaction, creates a new chat inside that Project, writes the exact controller-generated Phase 1 wake message using only human-style visible UI input, verifies durable presence without direct ChatGPT backend/API/DOM extraction methods, persists the private Project URL and chat URL, uses the upgraded human-only protocol for subsequent audit wake/watch operation, completely replaces the broken protocol in the Audit Controller/overseer pipeline, passes end-to-end live verification, and is merged to main.

CURRENT MAIN:
7e80af7956d4dc244d87635d4d14e54cb3f2487a

AUTHORITY:
- process/development-agent-task-manager/TASK_LOCK_PROTOCOL_v1.md @ main
- process/development-agent-task-manager/handoffs/BROWSER_HOME_EXIT_PLAYWRIGHT_V10_HANDOFF_v1/README_v1.md @ main
- User directive in current task: all non-human ChatGPT read/write methods are banned; finish Phase 1 end-to-end and replace the broken audit wake/watch protocol; merge to main when verified.

SATISFIED:
- Home-exit GitHub-hosted Playwright architecture has a human-confirmed durable delivery baseline (VERIFY4).
- Required Tailscale and ChatGPT session-state secrets are known to exist from the verified v10 path.
- Dedicated repair branch audit-wake-human-only-v1 exists from current main.

REMAINING DELTA:
- Make the human-only ChatGPT interaction ban impossible for browser agents to miss in governing instructions.
- In the existing live browser wake/watch implementation, replace only the exact non-human ChatGPT reads/writes (backend/API probes, network inspection, injected-JS/DOM extraction, programmatic clipboard/value mutation) with equivalent visible human UI + mouse/keyboard/OS-clipboard interactions. Do not recreate, redesign, or otherwise alter the workflow.
- Verify the existing Phase 1 Project-create routine still creates a new Project, obtains its private share URL through the visible Share Project UI, creates a new chat inside it, enters/sends the exact Phase 1 wake through human-style visible UI interaction, and persists project/chat state.
- Verify the existing audit Phase 1 controller/overseer wake and subsequent watch/resume pathway use the surgically upgraded human-only interactions with no other behavioral changes.
- Execute a live Phase 1 end-to-end verification using the real pipeline and confirm the correct wake is durably stored in the newly created Project chat.
- Run regression/qualification checks and merge the verified result to main.

PARKED OBSERVATIONS:
- Repository-organization PR #460 is unrelated and parked.

ACTIVE BLOCKER:
None

NEXT ACTION:
Surgically replace the prohibited ChatGPT read/write calls in scripts/browser-agent-wake.mjs and scripts/browser-operations-v1.mjs, adding only the OS-clipboard dependency required by those replacements; preserve all surrounding workflow/control logic.
