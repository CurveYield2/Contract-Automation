# Browser-Agent Wake Registration

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

The watchdog is one long-lived four-hour segment that checks the agent about every five minutes. It does **not** interrupt a productive agent. A check is productive when ChatGPT is visibly generating or the assistant message count/content has advanced since the preceding observation. Only an idle/stalled conversation receives the configured `GET BACK TO WORK` message.

If work is still active near the end of a four-hour segment, the watchdog self-dispatches the next four-hour segment. No hourly Scheduled Task or ChatGPT Work dependency is used.

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

Lite handoffs can now request a bounded mechanical web-agent pass **without adding another workflow or changing the normal successor path**.

The feature is opt-in per handoff. If the handoff directory contains:

`MECHANICAL_WORK_PACKET_v1.json`

the existing watchdog inserts a fresh `interphase_mechanical` ChatGPT worker before launching the next reviewer. If the file is absent, the existing direct successor launch remains unchanged.

The work packet uses schema:

`curveyield-lite-interphase-work-packet-v1`

and binds:
- exact campaign ID;
- exact completed milestone ID;
- exact authoritative handoff path;
- explicit `taskClass: MECHANICAL_ONLY`;
- deterministic mechanical instructions with no unresolved placeholders;
- exact required output paths, all confined to the handoff's `MECHANICAL/` subdirectory.

Example:

```json
{
  "schemaVersion": "curveyield-lite-interphase-work-packet-v1",
  "campaignId": "example-campaign",
  "completedMilestoneId": "P2_5",
  "handoffPath": "campaigns/example/handoffs/P5_TO_P6/SUCCESSOR_HANDOFF.json",
  "taskClass": "MECHANICAL_ONLY",
  "instructions": "Reconcile the filed evidence index and carried-forward obligation references. Do not make security findings or severity decisions.",
  "requiredOutputs": [
    {
      "path": "campaigns/example/handoffs/P5_TO_P6/MECHANICAL/MECHANICAL_EVIDENCE_INDEX_v1.json",
      "purpose": "Exact evidence-reference projection for the successor reviewer"
    }
  ]
}
```

The mechanical worker is instructed to perform only deterministic/repetitive work and is explicitly prohibited from making, promoting, rejecting, grading, or remediating security findings.

When finished, it writes:

`MECHANICAL_WORK_COMPLETION_v1.json`

in the same handoff directory using schema:

`curveyield-lite-interphase-completion-v1`

Example:

```json
{
  "schemaVersion": "curveyield-lite-interphase-completion-v1",
  "status": "PASS",
  "campaignId": "example-campaign",
  "completedMilestoneId": "P2_5",
  "handoffPath": "campaigns/example/handoffs/P5_TO_P6/SUCCESSOR_HANDOFF.json",
  "workPacketPath": "campaigns/example/handoffs/P5_TO_P6/MECHANICAL_WORK_PACKET_v1.json",
  "workPacketSha256": "<64 lowercase hex>",
  "outputs": [
    {
      "path": "campaigns/example/handoffs/P5_TO_P6/MECHANICAL/MECHANICAL_EVIDENCE_INDEX_v1.json",
      "sha256": "<64 lowercase hex>"
    }
  ],
  "completedAt": "2026-09-25T00:00:00Z"
}
```

Before launching the normal successor reviewer, the existing watchdog verifies:

1. the completion receipt is bound to the exact campaign, milestone, handoff, and work-packet path;
2. the work-packet SHA-256 matches the exact filed packet bytes;
3. the completion output set exactly matches the work packet's required-output set;
4. every required output is confined to the authoritative handoff's `MECHANICAL/` subdirectory;
5. every required output still exists in Audit-Controller;
6. every required output's current SHA-256 matches the completion receipt.

A fresh mechanical chat does **not** replace the campaign's registered reviewer chat URL. Only reviewer-role fresh chats update the campaign registration.

The mechanical worker is supervised by the same five-minute productivity-aware watchdog. Once its completion receipt is machine-valid, the watchdog reuses the existing Lite successor-launch path and retires the mechanical worker.

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

## Browser-provider redundancy

Wake delivery tries independent providers in this order and stops at the first verified success:

1. GitHub-hosted Chrome + Playwright using `CHATGPT_STORAGE_STATE_B64`;
2. Browserless using `BROWSERLESS_TOKEN` and persisted profile `BROWSERLESS_PROFILE` (default `chatgpt`);
3. Browserbase using `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, and `BROWSERBASE_CONTEXT_ID`.

The wake ID is durable and the persisted registration/chat URL makes retries safe. Provider failures are retried by later watchdog cycles rather than blocking the audit permanently.
