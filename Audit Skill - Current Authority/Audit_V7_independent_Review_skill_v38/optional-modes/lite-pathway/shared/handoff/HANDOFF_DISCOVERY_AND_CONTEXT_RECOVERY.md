# Lite Handoff Discovery & Context-Recovery Routing

Open this file only when entering a fresh-reviewer boundary, locating a campaign-local handoff, or recovering from reviewer/context loss.

## Find campaign-local handoffs

Use the GitHub connector app inside the exact current campaign `workspacePath`. Resolve the handoff referenced by controller state for the applicable boundary:

- Phase 0 web bootstrap → Phase 1: profile `P0_TO_P1` under `handoffs/P0_TO_P1/`.
- Phase 1 → 2: profile `P1_TO_P2` under `handoffs/P1_TO_P2/`.
- Phase 5 → 6: profile `P5_TO_P6` under `handoffs/P5_TO_P6/`.
- Merged Lite Phase 6–7 → Phase 8: profile `P67_TO_P8` under `handoffs/P67_TO_P8/`.

At a fresh-reviewer boundary, the successor reads the campaign-local `START_HERE_SUCCESSOR.md` **first**, then verifies the authoritative `SUCCESSOR_HANDOFF.json` and creates `SUCCESSOR_HANDOFF_RECEIPT.json`. The bootstrap packet is routing-only and never replaces the authoritative handoff.

Never substitute another campaign/generation's handoff. Each receiving phase card contains the exact reception checklist and recovery ladder.

## Repository recovery/context-loss handoff folder

For fresh-reviewer or context-loss handoffs, use the exact **campaign-local successor handoff** referenced by the current campaign state / Phase Contract. Current repository-level agent guidance lives under `docs/agent-guides/` in `CurveYield2/Audit-Controller`. Material under `archive/recovery/` is historical provenance only and MUST NOT be treated as active handoff authority.
