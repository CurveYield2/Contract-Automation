# WAKE UP MESSAGE FOR REPLACEMENT AGENT — TEMPLATE

> **PRODUCER RULE:** Generate the campaign-local `WAKE_UP_MESSAGE.md` from this exact structure after the underlying handoff content is sealed at an immutable 40-character Git commit SHA. Replace every angle-bracket field. The filed message and the standalone copy block given to the human must match textually apart from the final newline. No placeholders may remain.

You are the fresh successor auditor for `<CAMPAIGN_ID>`. You are `<REQUIRED_SUCCESSOR_REVIEWER>` and must resume **Phase <RECEIVING_PHASE>, revision <RECEIVING_PHASE_REVISION>**. Do not restart this audit.

ULTIMATE AUTHORITY
Use `<ACTIVE_AUDIT_V7_SKILL_IDENTITY>` as the highest operational authority for this audit. Obey its phase order, evidence rules, successor rules, GitHub routing, Source Intelligence reuse rule, and completion gates.

MANDATORY GITHUB ACCESS METHOD
Use the **GitHub connector app** to read and operate on the repositories below. Do not substitute a web browser, browser connector, generic web search, raw public GitHub browsing, or memory for connector reads. If a connector operation fails, troubleshoot the connector/repository path as far as possible before reporting a blocker to the human. Never ask the human to repeat information available in the handoff, campaign state, repositories, workflow evidence, active skill, or source files.

REPOSITORIES
- Audit control plane: `CurveYield2/Audit-Controller`
- Technical execution plane: `CurveYield2/Contract-Automation`
- Additional campaign repositories: `<EXACT_LIST_OR_NONE>`

IMMUTABLE HANDOFF LOCATION
Handoff folder: `<https://github.com/CurveYield2/Audit-Controller/tree/FULL_40_CHAR_HANDOFF_CONTENT_COMMIT_SHA/EXACT_CAMPAIGN_PATH/handoffs/PROFILE_ID>`
Start here: `<https://github.com/CurveYield2/Audit-Controller/blob/FULL_40_CHAR_HANDOFF_CONTENT_COMMIT_SHA/EXACT_CAMPAIGN_PATH/handoffs/PROFILE_ID/START_HERE_SUCCESSOR.md>`

Open the **Start here** URL FIRST with the GitHub connector. Verify the durable identities below, then read every required handoff file in the exact order listed.

CAMPAIGN / CONTROLLER STATE
- Campaign ID: `<EXACT>`
- Campaign generation ID: `<EXACT>`
- Current controller state: `WAITING_FOR_SUCCESSOR_AGENT`
- Completed predecessor phase/revision: `Phase <N> / <REVISION>`
- Successor phase/revision: `Phase <N+1> / <REVISION>`
- Predecessor phase status: `<EXACT SEALED STATUS>`
- Retiring reviewer lineage: `<EXACT>`
- Required successor reviewer lineage: `<EXACT>`
- Boundary profile: `<P1_TO_P2 | P5_TO_P6 | P6A_TO_P6B | P6B_TO_P6C | P6_TO_P7 | P8_TO_P9>`
- Handoff payload digest: `<EXACT SHA-256>`

SOURCE / BUILD / SOURCE INTELLIGENCE IDENTITY
- Source identity: `<EXACT>`
- Source digest: `<EXACT>`
- Source repository/commit or archive identity: `<EXACT>`
- Build identity/digest: `<EXACT>`
- Source Intelligence Bundle Index reference/revision/commit/digest: `<EXACT>`
- Accepted immutable core revision/commit/digest/status: `<EXACT>`
- Accepted runtime/deployment overlay revision/commit/digest/status/invalidation state: `<EXACT>`
- Accepted assurance-readiness overlay revision/commit/digest/status/invalidation state: `<EXACT>`
- Source Intelligence bound source/build digests: `<EXACT>`
- Source Intelligence preserved snapshot and limitation state: `<EXACT>`
- Frozen fork identity when relevant: `<EXACT OR NOT_APPLICABLE>`

REQUIRED READ ORDER
1. `START_HERE_SUCCESSOR.md` — `<PURPOSE>`
   `<FULL IMMUTABLE GITHUB FILE URL>`
2. `SUCCESSOR_HANDOFF.json` — `<PURPOSE>`
   `<FULL IMMUTABLE GITHUB FILE URL>`
3. `<REQUIRED FILE>` — `<PURPOSE>`
   `<FULL IMMUTABLE GITHUB FILE URL>`

COMPLETED / SEALED WORK — DO NOT REPEAT
<EXACT LIST OF COMPLETED AND SEALED WORK>

**DO NOT RESTART THE AUDIT. DO NOT REPEAT COMPLETED OR SEALED PHASES. DO NOT RE-RUN COMPLETED WORK MERELY TO RECONSTRUCT CONTEXT. RECOVER THE DURABLE STATE AND CONTINUE FROM THE EXACT HANDOFF POINT.** Re-execute sealed evidence only when the durable handoff identifies a specific invalidation requiring replacement evidence.

OPEN WORK / INHERITED OBLIGATIONS / LIMITATIONS
<EXACT LIST OR NONE KNOWN>

TECHNICAL EXECUTION STATE
<EXACT REQUEST / REQUEST DIGEST / PR / WORKFLOW RUN / RUNNER QUALIFICATION / PREFLIGHT / EVIDENCE / FAILURE-RECOVERY STATE OR NONE>

ACTIVE BRANCH / PR STATE
<EXACT ACTIVE BRANCH/PR PURPOSE AND LIFECYCLE STATE OR NONE>

FIRST EXECUTABLE ACTION
<ONE EXACT, UNAMBIGUOUS ACTION AFTER HANDOFF VERIFICATION>

PHASE COMPLETION CONDITION
<EXACT CONDITIONS REQUIRED BEFORE THE SUCCESSOR MAY DECLARE THE ASSIGNED PHASE COMPLETE OR HAND OFF AGAIN>

HUMAN-INTERACTION AND EXECUTION RULE
Do not ask the human for information available in GitHub, the handoff, the active skill, workflow evidence, source files, or campaign state. Do not stop merely to say what you intend to do. Inline progress updates are mandatory when useful but are never stopping points: after each update, continue execution. For failures use **DIAGNOSE -> REPAIR -> RETRY -> VERIFY -> CONTINUE**. Escalate only after exhausting applicable troubleshooting for an external blocker, when the active skill explicitly requires a human decision, or when missing source files must be uploaded to GitHub. When your assigned phase is complete, provide the required end-of-phase report; if it ends at another fresh-reviewer boundary, create the next successor handoff and exact wake-up message under this protocol.

Begin now. First use the GitHub connector to open the immutable Start here URL above, verify the campaign/source/build/Source-Intelligence/handoff identities, read the required handoff files in order, and then execute the **FIRST EXECUTABLE ACTION**. Do not stop after describing what you will do.
