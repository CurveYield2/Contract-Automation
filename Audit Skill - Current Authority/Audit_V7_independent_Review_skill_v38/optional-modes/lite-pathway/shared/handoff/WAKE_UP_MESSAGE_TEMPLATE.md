# Lite Successor Wake-Up Message

This format is mandatory for **every** Lite fresh-agent boundary: `P0_TO_P1`, `P1_TO_P2`, `P5_TO_P6`, and `P67_TO_P8`. Do not replace it with a generic wake prompt.

## Assignment

- Campaign type: **LITE**
- Campaign name: `<exact campaign folder name>`
- Campaign folder URL: `<exact GitHub URL of the campaign folder>`
- Controller `workspacePath`: `<exact workspacePath>`
- Campaign ID / generation: `<campaignId> / <campaignGenerationId>`
- Boundary: `<P0_TO_P1 | P1_TO_P2 | P5_TO_P6 | P67_TO_P8>`
- Incoming reviewer: `<incoming reviewer>`
- Assigned Lite phase/milestone: `<Phase 1 | Combined Lite Phases 2–5 | Merged Lite Phases 6–7 | Combined Lite Phases 8–10>`

## Current authority — read and follow exactly

The authoritative Lite audit skill is:

- Repository path: `CurveYield2/Contract-Automation/Audit Skill - Current Authority/Audit_V7_independent_Review_skill_v38/optional-modes/lite-pathway/SKILL.md`
- Human-readable URL: `https://github.com/CurveYield2/Contract-Automation/blob/main/Audit%20Skill%20-%20Current%20Authority/Audit_V7_independent_Review_skill_v38/optional-modes/lite-pathway/SKILL.md`

Use the **GitHub connector app** for repository access. The path above is the current authority location; do not substitute an older campaign-copied skill, archived skill, remembered instructions, or another repository path unless controller state contains an explicit valid authority rebind.

## Exact audit identity

- Source identity: `<exact source identity>`
- Build identity: `<exact build identity or typed pending>`
- Authoritative handoff reference / digest: `<reference> / <digest>`
- Milestone/completion report reference / digest: `<reference> / <digest>`

## Locally available inputs when orchestrated

- Skill ZIP: `<filename>` at `<local path>`; SHA-256 `<digest when available>`
- Source ZIP: `<filename>` at `<local path>`; SHA-256 `<digest when available>`

## Required first actions

1. Read the current authority Lite `SKILL.md` at the location above.
2. Read the campaign-local `START_HERE_SUCCESSOR.md` for this boundary.
3. Verify `SUCCESSOR_HANDOFF.json` against the exact campaign/generation/source identity and boundary profile.
4. Create and seal `SUCCESSOR_HANDOFF_RECEIPT.json`.
5. Execute **only** the assigned Lite phase/milestone stated above.
6. Consume sealed predecessor evidence; do not restart completed work for convenience.

Do not infer the campaign, phase, authority file, or reviewer assignment from chat history. Use the exact values in this wake message and durable controller/handoff state.
