# Focus Lock — Upgrade Agent Task-Lock + Browser Manager Repair v2

## END-STATE INVARIANT

Upgrade the development-agent control plane in `CurveYield2/Contract-Automation` so development/upgrade agents:

1. remain anchored to one explicit human-requested end-state;
2. work only the smallest remaining live delta;
3. preserve satisfied work across supervision/replacement;
4. use the corrected browser automation pathway already finalized on current `main`, instead of the stale direct browser wake/poke setup still embedded in the Development Agent Task Manager;
5. default to a persistent ChatGPT Project so agents can survive context exhaustion, replacement, and multi-agent handoff without losing task continuity.

## BROWSER CONTINUITY DEFAULT

Project-backed execution is the default for managed development/upgrade tasks.

Rationale: development agents commonly exhaust conversation context or chat length before completing non-trivial tasks. The durable Project is therefore the normal continuity boundary, while individual chats are replaceable workers.

Default behavior:

- First worker creates one ChatGPT Project for the managed task.
- The private Project share URL is captured through the normal UI and persisted durably.
- The first chat is created inside that Project.
- Replacement/successor agents reopen that exact persisted Project URL and create a fresh chat inside the same Project.
- If a chat disappears or exhausts context, replace the chat, not the Project.
- Never create a second Project for the same manager ID unless the human explicitly requests a reset.

Lightweight exception:

- A clearly tiny task that is expected to require only one agent and no successor/replacement may use a normal standalone chat.
- This is an exception, not the default.
- If such a task later needs replacement or continuation, migrate into a Project-backed managed task rather than repeatedly creating unrelated standalone chats.

## CORRECTED BROWSER PATHWAY

Use the current corrected browser automation primitives already finalized on `main`, including:

- visible Chrome under Xvfb;
- GitHub-hosted Playwright as the production browser provider;
- encrypted ChatGPT session-state restore and persistence;
- Tailscale connection and home exit-node routing;
- private tailnet VNC support where the current shared pathway requires it;
- durable write verification before treating a wake/poke as delivered;
- persisted Project URL handling;
- deterministic Project creation/opening;
- Project-local fresh-chat creation;
- safe replacement behavior that reuses the Project and replaces only the chat.

Do not reuse the Development Agent Task Manager's stale direct browser setup when the corrected shared primitives already exist.

Do not copy audit-specific wake-message content into development tasks. Reuse browser transport and generic browser operations, not audit reviewer instructions.

## HARD EXCLUSION

Do **not** incorporate the development task-lock policy into the existing audit execution pathway.

That exclusion includes:

- audit reviewer wake instructions;
- audit reviewer watchdog/monitor policy;
- audit campaign phase orchestration;
- audit phase handoffs;
- Audit V7 execution/qualification workflows;
- audit-source initialization;
- lite audit phase workflows;
- audit-specific registration, receipt, or campaign-state semantics.

Audit browser files may be inspected as the current source of the corrected generic browser transport/Project primitives. Reuse of those generic browser primitives is allowed. The development task-lock behavior itself must remain development-only.

## CURRENT MAIN BASELINE

- Repository: `CurveYield2/Contract-Automation`
- Baseline main commit: `5a34b046e2211a4cb4a3f4065156ab91d8770c80`
- Working branch: `upgrade-agent-focus-lock-v1`

## AUTHORITATIVE IMPLEMENTATION AREA

Primary implementation surface:

`process/development-agent-task-manager/`

Primary launcher/supervisor:

`.github/workflows/development-agent-task-manager.yml`

Generic browser primitives may be reused from the current shared browser stack, especially:

- `scripts/browser-agent-wake.mjs`
- `scripts/browser-operations-v1.mjs`
- `scripts/browser-routine-engine-v1.mjs`
- `.github/actions/setup-browser-agent-runtime`
- current home-exit/session-state mechanics already used by the corrected browser pathway.

## SATISFIED

- Located the existing Development Agent Task Manager.
- Confirmed `process/development-agent-task-manager/` is the correct home for the permanent task-lock protocol.
- Created a dedicated implementation branch.
- Added the permanent task-lock protocol.
- Added the task-lock state template.
- Began wiring task-lock metadata into the Development Agent Task Manager.
- Confirmed the stale Development Agent Task Manager browser path still calls the shared script directly without the corrected home-exit/session-state workflow mechanics.
- Located the corrected browser pathway on current `main`, including the deterministic Project create/open/share-link work merged in PRs #485/#486 and the home-exit Playwright transport introduced by PR #463 and subsequent repairs.
- Recorded the explicit audit-path exclusion.
- Set Project-backed continuity as the development-manager default, with standalone chat only as a tiny-task exception.

## REMAINING DELTA

1. Finish task-lock integration in initial development-agent wakes.
2. Finish task-lock integration in replacement/resume development-agent wakes.
3. Ensure idle supervision re-anchors to the existing task lock and smallest remaining delta.
4. Ensure machine completion requires a closed task-lock state.
5. Replace stale Development Agent Task Manager browser startup/observe/poke/replacement callsites with the corrected browser transport.
6. Add development-specific Project routines or genericize/reuse the corrected Project operations without using audit-specific wake text.
7. Make Project-backed continuity the default for managed tasks.
8. Add an explicit lightweight standalone-chat mode for genuinely tiny one-agent tasks.
9. Persist the managed task's Project private share URL in durable manager state.
10. Initial managed Project launch must create the Project once and capture/persist its private share URL before launch is considered successful.
11. Replacement/successor development agents must reopen the exact saved Project URL and create a new chat inside it.
12. Chat failure/context exhaustion must replace only the chat, never the Project.
13. Add regression tests for task-lock enforcement, corrected browser transport, Project persistence, Project reuse, and standalone-chat exception.
14. Verify the task-lock policy was not injected into audit-specific wakes/monitors/orchestration.
15. Update development-agent documentation.
16. Re-check current `main` before completion and reconcile only live changes that affect this delta.

## PARKED OBSERVATIONS

- General repository organization issues are outside this task.
- Audit methodology changes are outside this task.
- Audit-specific wake-message redesign is outside this task.
- Unrelated workflow cleanup is outside this task.
- Any defect discovered outside the development-agent manager/browser continuity path is parked unless it directly prevents this implementation.

## ACTIVE BLOCKER

None.

## NEXT ACTION

Inspect the corrected shared browser workflow boundaries and refactor the Development Agent Task Manager to consume those proven browser/session/Project primitives, with Project-backed continuity as the default and standalone chat as the explicit tiny-task exception.

## ANTI-DRIFT CHECK

Before every new implementation action, answer:

`Which REMAINING DELTA item does this action eliminate or verify?`

If the answer is none, do not perform the action.
