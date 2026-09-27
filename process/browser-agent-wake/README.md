# Browser-Agent Wake Registration

## Normal ChatGPT browser routines

Browser automation is no longer limited to one hard-coded wake path. Reusable operations live in:

- `scripts/browser-operations-v1.mjs`
- `scripts/browser-routine-engine-v1.mjs`
- `process/browser-routines/*.json`

A routine is a declarative sequence of named browser operations. The first admitted routine is:

`audit-ultralite-reviewer-v1`

It always targets **normal ChatGPT web Chat**, never Work. Before the first reviewer message it switches away from Work if necessary, creates or reuses the campaign ChatGPT Project, and opens a new normal chat inside that Project. After the first message creates the conversation URL, it attempts to rename the chat to the supplied campaign/reviewer name.

The browser operation registry currently includes:

- `chatgpt.ensure_chat_mode`
- `chatgpt.ensure_project`
- `chatgpt.start_project_chat`
- `chatgpt.rename_current_chat`

Additional routines can reuse those operations without creating a new GitHub Actions workflow.

## Ultralite audit browser orchestration

`.github/workflows/ultralite-audit-browser-orchestrator-v1.yml` is the first complete routine consumer.

It starts with a dedicated **normal ChatGPT web** Phase-0 bootstrap chat. That bootstrap agent is instructed to:

1. use the GitHub connector app;
2. read and obey the active audit skill authority;
3. execute Phase 0 only;
4. write/seal the required Phase-0 packet/handoff;
5. stop at the machine-readable successor boundary.

The Phase-0 bootstrap is deliberately outside the campaign Project. When the canonical controller/pointer reaches the Phase-0 successor boundary, the existing Lite watchdog launches the first semantic reviewer through `audit-ultralite-reviewer-v1`. That launch creates/reuses a ChatGPT Project named from the campaign title and creates a normal reviewer chat inside it.

Every later successor is derived from the live Audit-Controller pointer, not from a hard-coded reviewer count. The successor launch reads `.nextMilestone.reviewer`, `.nextMilestone.id`, the sealed handoff, campaign title/path, and the newest audit-skill ZIP in the campaign authority directory. The wake envelope contains:

- campaign URL;
- reviewer identity;
- milestone identity;
- latest audit skill URL;
- sealed handoff path;
- explicit GitHub connector requirement;
- explicit rule that the latest skill is the audit methodology authority;
- instruction to continue from sealed durable state and run the assigned reviewer through its terminal handoff/final-report state.

There is no `reviewer-5`, `P8_10`, or other reviewer-count assumption in successor termination. A campaign ends when canonical campaign state is terminal or the active pointer has no successor.

## Reviewer repair

Reviewer repair is handled by:

`.github/workflows/browser-agent-reviewer-repair-v1.yml`

and schema:

`protocol/schemas/curveyield-reviewer-repair-request-v1.schema.json`

The default repair disposition is **resume first**. A replacement normal ChatGPT reviewer chat is created in the same campaign Project and instructed to recover from current durable GitHub state without repeating sealed work.

If safe continuation is impossible because the active reviewer's partial files are irreconcilably incomplete or misplaced, the replacement reviewer is prohibited from deleting data itself. It must file:

`controller/REVIEWER_REPAIR_REQUEST_v1.json`

with exact campaign, reviewer, milestone, handoff, and baseline-commit identity. The watchdog validates that request against the live pointer before dispatching the reset path.

The reset path restores the campaign to the exact handoff baseline commit, while preserving the current source directory, authority directory, skill-authority receipts, and current skill binding. It writes `controller/REVIEWER_REPAIR_RESET_v1.json`, removes the consumed reset request, then launches a fresh replacement reviewer in the campaign Project.

Repair can also be explicitly dispatched with `repair_mode=reset_to_handoff`; absent a valid filed repair request, this requires `force_reset=true`.

### Automatic breakdown escalation

Reviewer watchdog states carry a repair policy. The default ultralite routine uses:

- idle poke threshold: 3;
- non-challenge unviewable threshold: 2.

A normal browser/security challenge is treated as infrastructure noise and never as reviewer failure. A shared authentication prompt is also not grounds for replacing a reviewer.

The watchdog continues the normal **GET BACK TO WORK** process for temporary inactivity. Persistent inactivity beyond the configured poke threshold, a truly unavailable conversation, or repeated non-challenge unviewable observations can dispatch reviewer repair automatically. Productive activity resets the inactivity counters.


This directory is the durable control surface for ordinary ChatGPT web-agent wake/resume behavior. All browser wake automation remains in `CurveYield2/Contract-Automation`; no workflow is required in Audit-Controller or Audits.

One registration file is used per active audit campaign:

`process/browser-agent-wake/registrations/<SAFE_CAMPAIGN_ID>.json`

The safe campaign ID is the campaign ID with any character outside `A-Za-z0-9._-` replaced by `_`.

## Lite registration

Lite audits use the existing compressed milestone topology, with a separate mechanical bootstrap boundary:

- `P0_BOOTSTRAP` — gate identity for the dedicated web-bootstrap agent executing Phase 0; this is not a semantic-review milestone.
- `P0_1` — reviewer-1 consumes the sealed Phase-0 bootstrap and completes Phase 1, sealing the combined Phase 0–1 milestone.
- `P2_5` — reviewer-2, Phases 2–5.
- `P6_7` — reviewer-3L, Phases 6–7.
- `P8_10` — reviewer-4, Phases 8–10.

Use:

```json
{
  "schemaVersion": "curveyield-browser-agent-wake-registration-v1",
  "campaignId": "REPLACE_WITH_EXACT_CAMPAIGN_ID",
  "mode": "create_fresh",
  "chatUrl": "",
  "wakeMessage": "[AUDIT_AUTOMATION_WAKE_V1]\nResume the admitted audit from the latest durable completion evidence. Do not restart completed work. Continue the current assignment until its required terminal state.",
  "watchdog": {
    "enabled": true,
    "idleMessage": "[AUDIT_AGENT_WATCHDOG_V1]\nGET BACK TO WORK. Resume the admitted audit from the latest durable campaign state and completion evidence. Do not restart completed work. Continue until the current assignment reaches its required terminal completion state.",
    "gate": {
      "mode": "LITE",
      "repository": "CurveYield2/Audit-Controller",
      "ref": "main",
      "statePath": "campaigns/REPLACE_WITH_AUDIT_NAME/controller/CAMPAIGN_STATE_v1.json",
      "expectedPhaseId": "phase-0",
      "expectedMilestoneId": "P0_BOOTSTRAP",
      "activePointerPath": "campaigns/REPLACE_WITH_AUDIT_NAME/controller/ACTIVE_PHASE_POINTER_v1.json",
      "stopStates": [
        "WAITING_FOR_HUMAN_RESPONSE",
        "WAITING_FOR_SUCCESSOR_AGENT",
        "CLOSED",
        "STOPPED_BY_HUMAN"
      ],
      "stopCampaignStatuses": [
        "COMPLETE",
        "STOPPED_BY_HUMAN"
      ]
    }
  }
}
```

The human-woken bootstrap chat should create this registration **before** submitting the source-fanout request. Initial mode is `create_fresh` and `chatUrl` is empty. After source fan-out reaches PASS, the existing source-fanout workflow launches a dedicated normal ChatGPT Phase-0 conversation, captures its `chatgpt.com/c/...` URL, rewrites the registration to `resume_existing`, and arms its watchdog. The original human-woken bootstrap chat may then retire after verifying that rebound.

## Wake modes

- `resume_existing`: post `wakeMessage` into the stored `chatgpt.com/c/...` conversation.
- `create_fresh`: create a new ordinary ChatGPT web conversation, post `wakeMessage` as its first message, capture the resulting `chatgpt.com/c/...` URL, and rewrite the campaign registration to `resume_existing` using that new URL.

The canonical V7 execution workflow checks for a matching registration only after successful execution. If no registration exists, existing audit execution behavior is unchanged.

## Activity-sensitive watchdog

A successful wake arms `.github/workflows/browser-agent-watchdog.yml`.

The watchdog uses short scheduled sweeps rather than holding a GitHub runner open while it sleeps. `.github/workflows/browser-agent-watchdog.yml` runs every five minutes (offset from the top of the hour), discovers the durable active watchdog states under `process/browser-agent-watchdog/active/`, and supervises each active agent once. A successful wake also dispatches an immediate first sweep, so a newly woken agent does not wait for the next schedule tick.

Each active wake ID has its own workflow concurrency key, preventing an immediate/manual sweep and a scheduled sweep from supervising the same chat simultaneously. Up to four distinct active agents may be checked in parallel.

The productivity rule is unchanged: the watchdog does **not** interrupt a productive agent. A check is productive when ChatGPT is visibly generating or the assistant message count/content has advanced since the preceding observation. Only an idle/stalled conversation receives the configured `GET BACK TO WORK` message.

No watchdog job sleeps between observations and no watchdog self-chains into a four-hour segment. If GitHub's scheduled trigger is briefly delayed, the canonical Audit-Controller state and handoff gates remain authoritative; only the timing of the next observation/poke or successor dispatch is delayed.

## Lite automatic successor launch

The watchdog reuses the campaign's existing Lite controller artifacts instead of introducing another phase gate.

For a Lite registration it reads:

- `controller/CAMPAIGN_STATE_v1.json`
- `controller/ACTIVE_PHASE_POINTER_v1.json`
- the handoff named by `authoritativeHandoff`
- `WAKE_UP_MESSAGE.md` in that same handoff folder

The Phase-0 browser agent is supervised under the gate-only identity `P0_BOOTSTRAP`; when the canonical controller reaches the sealed `P0_TO_P1` successor boundary, reviewer-1 is launched automatically. Later browser agents remain supervised until their expected Lite milestone is machine-sealed. A successor is launched only when all of these are coherent:

1. the expected milestone is terminal in the canonical Lite campaign state;
2. the active pointer says the same milestone is the completed milestone;
3. the completed milestone status is `SEALED`, `COMPLETE`, `COMPLETED`, or `PASS`;
4. the pointer identifies a next milestone;
5. the successor handoff path exists;
6. the exact `WAKE_UP_MESSAGE.md` exists and contains no unresolved placeholder material.

When those checks pass, the watchdog dispatches `browser-agent-wake.yml` in `create_fresh` mode, using the exact filed wake-up message as the first message in a new normal ChatGPT web conversation. The new wake arms a watchdog bound to the successor milestone. The predecessor watchdog then retires.

The final `P8_10` milestone does not spawn another reviewer; once terminal it retires the watchdog.

This is a Lite-only automatic alternative. The existing Full/V26 human-response path is not modified.

## Optional Lite inter-phase mechanical worker

Lite handoffs can request a bounded **extended mechanical batch** without adding another workflow or changing the normal successor path.

Current admitted contract: **v2**.

The authoritative handoff directory may contain:

`MECHANICAL_WORK_PACKET_v2.json`

If it is absent, the existing direct successor launch remains unchanged. If a legacy `MECHANICAL_WORK_PACKET_v1.json` is present, the watchdog fails closed and requires migration to v2.

### v2 workload floor

A v2 packet is intentionally substantial. It must contain:

- `taskClass: MECHANICAL_ONLY`;
- at least **10 independent work units**;
- a unique ID for every work unit;
- distinct output path for every work unit;
- explicit mechanical instructions for every unit;
- an explicit verification rule for every unit;
- one additional final reconciliation output;
- an exact required-output set equal to all unit outputs plus the reconciliation output.

This is a **useful-work floor**, not a timer. The agent must never sleep, loop, or perform fake activity merely to consume time.

All outputs remain confined to the authoritative handoff's `MECHANICAL/` subdirectory.

Example skeleton:

```json
{
  "schemaVersion": "curveyield-lite-interphase-work-packet-v2",
  "campaignId": "example-campaign",
  "completedMilestoneId": "P2_5",
  "handoffPath": "campaigns/example/handoffs/P5_TO_P6/SUCCESSOR_HANDOFF.json",
  "taskClass": "MECHANICAL_ONLY",
  "instructions": "Complete every unit and reconcile the complete mechanical handoff dataset. Do not perform security judgment.",
  "workUnits": [
    {
      "id": "evidence-index-01",
      "instructions": "Reconcile one defined evidence family against the filed evidence ledger.",
      "outputPath": "campaigns/example/handoffs/P5_TO_P6/MECHANICAL/evidence-index-01.json",
      "verification": "Every listed evidence reference must resolve to a filed artifact and preserve the exact recorded digest."
    }
  ],
  "reconciliationOutputPath": "campaigns/example/handoffs/P5_TO_P6/MECHANICAL/FINAL_RECONCILIATION_v2.json",
  "requiredOutputs": [
    {
      "path": "campaigns/example/handoffs/P5_TO_P6/MECHANICAL/evidence-index-01.json"
    },
    {
      "path": "campaigns/example/handoffs/P5_TO_P6/MECHANICAL/FINAL_RECONCILIATION_v2.json"
    }
  ]
}
```

The actual packet must contain at least ten work units; the shortened example above only demonstrates field shape.

The worker completion file is:

`MECHANICAL_WORK_COMPLETION_v2.json`

using schema `curveyield-lite-interphase-completion-v2`.

It must contain:
- exact campaign/milestone/handoff identity;
- exact work-packet path and SHA-256;
- one `workUnitReceipt` for every work unit;
- exact work-unit ID/output-path pairing;
- each unit output SHA-256;
- the complete required-output set and SHA-256 values;
- completion timestamp.

Before the next reviewer launches, the **existing watchdog** verifies:

1. packet is v2 and contains at least ten valid, unique work units;
2. no unresolved placeholder material exists;
3. every unit output and reconciliation output is under the handoff's `MECHANICAL/` directory;
4. the required-output set is exactly the unit-output set plus reconciliation output;
5. the completion receipt is bound to the exact packet bytes;
6. every work unit has exactly one matching receipt;
7. unit IDs/output paths exactly match the packet;
8. every unit receipt hash matches its corresponding output hash;
9. every required output currently exists in Audit-Controller;
10. every required output's current SHA-256 matches the completion receipt.

The web agent is explicitly prohibited from finding promotion/rejection, severity grading, exploit/economic judgment, remediation approval, or residual-risk conclusions.

A fresh mechanical chat does not replace the campaign reviewer-chat registration. When v2 completion is machine-valid, the same watchdog invokes the existing Lite successor-launch path and retires the mechanical worker.

## Successor context after mechanical completion

After `MECHANICAL_WORK_COMPLETION_v2.json` passes the existing machine validation, the same Lite successor-launch path augments the dispatched successor wake message with a compact:

`[VERIFIED_INTERPHASE_MECHANICAL_RESULTS_V2]`

section.

The sealed handoff and stored `WAKE_UP_MESSAGE.md` are **not mutated**. The additional context exists only in the runtime wake message.

The injected section contains:
- exact v2 work-packet path;
- exact v2 completion-receipt path;
- final reconciliation output path;
- verified output count;
- an explicit `MECHANICAL_ONLY` security-meaning warning;
- progressive-disclosure instruction to read the final reconciliation first;
- the ten verified unit-output paths for drill-down only when needed.

This lets the reasoning reviewer benefit from the web worker immediately without rediscovering the files or preloading all unit outputs. A failed, missing, mutated, or otherwise unverified mechanical completion can never produce this verified-results section.

## Qualification efficiency

Changes confined to the browser-agent/control-plane allowlist are qualified through the existing V7 qualification workflow's `CONTROL_LIGHT` lane. That lane runs the relevant browser/auth/bridge regressions plus repository static/build checks without installing the blockchain runner toolchain. Any runner-critical, mixed, unknown, explicit/manual, or qualification-infrastructure change fails safe to the full V7 qualification lane.

## Isolated browser-agent runtime

Wake and watchdog jobs do not install browser libraries into the Contract-Automation root project.

Both existing workflows reuse:

`.github/actions/setup-browser-agent-runtime/action.yml`

The shared action restores or installs only:

`tools/browser-agent-runtime/node_modules`

using exact direct pins from:

`tools/browser-agent-runtime/package.json`

The runtime is intentionally outside the repository's `packages/*` and `apps/*` workspaces, so browser automation does not pull or mutate the contract runner dependency graph.

On a cache hit, no npm install runs. On a cache miss, npm is scoped with `--prefix tools/browser-agent-runtime`; the root Foundry/Forge/solc/ethers dependencies are never part of the browser-runtime install.

The wake script resolves `playwright-core` and `@browserbasehq/sdk` from `BROWSER_AGENT_RUNTIME_ROOT`. The root package remains free of those browser-only dependencies.

## Rolling GitHub-Playwright session persistence

GitHub-hosted runners are ephemeral, so the local Playwright provider maintains a rolling encrypted browser-state cache instead of relying forever on the original bootstrap snapshot.

No additional secret is required. By default the cache encryption key is deterministically derived inside the runner from the already-existing `CHATGPT_STORAGE_STATE_B64` bootstrap secret. The bootstrap value itself is never written to the cache or repository.

An optional independent 32-byte Base64 key may be supplied as `CHATGPT_SESSION_STATE_KEY_B64`. When present it overrides bootstrap-derived keying, which permits independent cache-key rotation.

Runtime behavior:

1. each wake/watchdog job restores the newest cache matching `chatgpt-session-state-v1-`;
2. the browser runtime derives its AES-256-GCM cache key from `CHATGPT_STORAGE_STATE_B64`, unless the optional dedicated key override is present;
3. the authenticated encrypted cache is loaded when valid; if it is absent, unreadable, tampered, or keyed differently, `CHATGPT_STORAGE_STATE_B64` remains the cold-start/bootstrap fallback;
4. after a successful GitHub-hosted Playwright interaction, state is refreshed only when the ChatGPT composer is visibly present on `chatgpt.com`;
5. the refreshed snapshot includes cookies, local storage, IndexedDB, and origin private file-system state supported by the pinned Playwright runtime;
6. the refreshed Playwright state is encrypted in memory and only the authenticated ciphertext envelope is written to the Actions cache;
7. logged-out, malformed, tampered, or otherwise unhealthy states are never promoted as the next generation.

The Actions cache contains ciphertext only. Plain Playwright storage state is not written into the repository or cache. A cache miss or normal GitHub cache eviction is non-fatal because the original `CHATGPT_STORAGE_STATE_B64` secret remains the bootstrap source.

This rolling cache improves session longevity but is not a credential-login mechanism. If both the rolling session and bootstrap state are no longer accepted by ChatGPT, the existing Browserless/Browserbase fallbacks remain available.

## Fresh-runner retry hardening

The GitHub-hosted Playwright provider treats only failures that occur **before any wake message is posted** as eligible for automatic fresh-runner retry. This keeps retries duplicate-safe.

Retryable pre-post states currently include:

- `BROWSER_CHALLENGE`: ChatGPT remains on a browser/security challenge after the bounded composer wait;
- `CHATGPT_UI_UNAVAILABLE`: ChatGPT loads without a login prompt or unavailable-chat marker but the composer never hydrates.

Non-retryable states include authentication-required and unavailable-chat conditions, plus any failure that occurs after message submission begins. The workflow therefore never guesses whether a possibly-posted wake should be sent again.

For a retryable failure, `browser-agent-wake.yml` re-dispatches the exact original wake inputs onto a fresh GitHub-hosted runner. The default retry budget is three fresh-runner retries and is hard-capped at five. The same `wake_id` concurrency group serializes the chain, so only one attempt can execute at a time.

Failed attempts do not create watchdog state, update campaign registrations, save refreshed session state, or arm follow-on observation. Those durable side effects are gated on a verified successful delivery. If the retry budget is exhausted, the final attempt fails with the structured provider failure record.

## Browser-provider redundancy

Wake delivery tries independent providers in this order and stops at the first verified success:

1. GitHub-hosted Chrome + Playwright using the newest encrypted rolling session state, with `CHATGPT_STORAGE_STATE_B64` as cold-start fallback;
2. Browserless using `BROWSERLESS_TOKEN` and persisted profile `BROWSERLESS_PROFILE` (default `chatgpt`);
3. Browserbase using `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, and `BROWSERBASE_CONTEXT_ID`.

The wake ID is durable and the persisted registration/chat URL makes retries safe. Provider failures are retried by later scheduled watchdog sweeps rather than blocking the audit permanently.
