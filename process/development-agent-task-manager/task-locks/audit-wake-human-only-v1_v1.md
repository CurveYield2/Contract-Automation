# Development Agent Task-Lock State v1

MANAGER ID:
audit-wake-human-only-v1

END-STATE INVARIANT:
Phase 1 audit wake/watch automation creates a brand-new ChatGPT Project through visible human-style UI interaction, creates a new chat inside that Project, writes the exact controller-generated Phase 1 wake message using only human-style visible UI input, verifies durable presence without direct ChatGPT backend/API/DOM extraction methods, persists the private Project URL and chat URL, uses the upgraded human-only protocol for subsequent audit wake/watch operation, completely replaces the broken protocol in the Audit Controller/overseer pipeline, passes end-to-end live verification, and is merged to main.

CURRENT MAIN:
11d22cae03dc9728092ff664c4d51886eb7057ba

AUTHORITY:
- process/development-agent-task-manager/TASK_LOCK_PROTOCOL_v1.md @ main
- process/development-agent-task-manager/handoffs/BROWSER_HOME_EXIT_PLAYWRIGHT_V10_HANDOFF_v1/README_v1.md @ main
- User directive in current task: all non-human ChatGPT read/write methods are banned; finish Phase 1 end-to-end and replace the broken audit wake/watch protocol; merge to main when verified.

SATISFIED:
- Home-exit GitHub-hosted Playwright architecture has a human-confirmed durable delivery baseline (VERIFY4).
- Required Tailscale and ChatGPT session-state secrets are known to exist from the verified v10 path.
- Dedicated repair branch audit-wake-human-only-v1 exists.
- Repository-wide browser instruction prominently bans all non-human ChatGPT reads/writes.
- Existing scripts/browser-agent-wake.mjs and scripts/browser-operations-v1.mjs were surgically converted in place: no ChatGPT backend/API fetches, request/response interception, injected JavaScript, JS clipboard, content scraping, or programmatic field mutation remain in the live audit wake path.
- Existing wake/watch workflows retain their control flow and install only the OS clipboard helper needed for normal paste/copy behavior.
- Lite Structured Phase Regression v2 passed on the repaired branch.
- V7 Execution Infrastructure Qualification passed on the repaired branch.

REMAINING DELTA:
- Complete live Phase 1 verification: visible Project create/recovery, Share Project -> Share Link OS-clipboard capture, fresh chat creation, exact wake human-style send, visible durable marker, persisted Project/chat URLs, Audit-Controller assignment activation, and immediate watchdog.
- Remove all temporary branch-only live-test triggers/ref overrides after successful proof.
- Reconcile latest main, rerun final gates, and merge PR #499 to main.

PARKED OBSERVATIONS:
- Repository-organization PR #460 is unrelated and parked.

ACTIVE BLOCKER:
Accidental old-main fresh-runner retry 37135809471 is still occupying the campaign wake concurrency slot. It has not persisted a Project/chat or activated the assignment.

NEXT ACTION:
After run 37135809471 terminates without durable state mutation, trigger the corrected repair-branch Phase 1 live proof and repair only the exact visible human interaction that fails, if any.
