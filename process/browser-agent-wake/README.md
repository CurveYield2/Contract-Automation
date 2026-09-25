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

The wake ID is durable and the persisted registration/chat URL makes retries safe. Provider failures are retried by later scheduled watchdog sweeps rather than blocking the audit permanently.
