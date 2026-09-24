# Browser-Agent Wake Registration

This directory is the durable control surface for ordinary ChatGPT web-agent wake/resume behavior.

One registration file is used per active audit campaign:

`process/browser-agent-wake/registrations/<SAFE_CAMPAIGN_ID>.json`

The safe campaign ID is the campaign ID with any character outside `A-Za-z0-9._-` replaced by `_`.

## Registration schema

```json
{
  "schemaVersion": "curveyield-browser-agent-wake-registration-v1",
  "campaignId": "example-audit-r1",
  "mode": "resume_existing",
  "chatUrl": "https://chatgpt.com/c/...",
  "wakeMessage": "[AUDIT_AUTOMATION_WAKE_V1]\nResume the admitted audit from the latest completion evidence. Do not restart completed work.",
  "watchdog": {
    "enabled": true,
    "idleMessage": "[AUDIT_AGENT_WATCHDOG_V1]\nGET BACK TO WORK. Resume from durable campaign state. Do not restart completed work.",
    "completion": {
      "repository": "CurveYield2/Audit-Controller",
      "ref": "main",
      "path": "campaigns/<AUDIT_NAME>/evidence/<TERMINAL_COMPLETION_REPORT>.json",
      "statusField": "status",
      "terminalValues": ["PASS", "COMPLETE", "COMPLETED", "SEALED"]
    }
  }
}
```

`mode` may be:

- `resume_existing`: post the wake message into `chatUrl`.
- `create_fresh`: create a fresh normal ChatGPT web conversation, post `wakeMessage` as its first message, capture the resulting `chatgpt.com/c/...` URL, then rewrite this registration to `resume_existing` with that URL for subsequent wakes.

The canonical V7 execution workflow checks for a matching registration only after successful execution. If no registration exists, execution behavior is unchanged.

## Watchdog

A successful wake arms `.github/workflows/browser-agent-watchdog.yml`.

The watchdog runs every five minutes. Before sending anything it:

1. checks the configured terminal completion report;
2. observes the normal ChatGPT web conversation;
3. does not interrupt when the chat is visibly generating or has advanced since the previous observation;
4. sends the configured idle message only when the chat is idle/stalled;
5. retries naturally on later five-minute cycles if all browser providers fail;
6. retires its active state as soon as terminal completion is observed.

Wake delivery is provider-redundant in this order:

1. GitHub-hosted Playwright using `CHATGPT_STORAGE_STATE_B64`;
2. Browserless using `BROWSERLESS_TOKEN` and authenticated profile `BROWSERLESS_PROFILE` (default `chatgpt`);
3. Browserbase using `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, and `BROWSERBASE_CONTEXT_ID`.

All wake and watchdog automation lives in Contract-Automation. No workflow is added to Audit-Controller or Audits.
