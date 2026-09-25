5. Confirm workspace generation/source identity before writing anything.
6. If no valid matching campaign exists, campaign creation is a **Phase-0 controller action**. Enter [Phase 0](phases/phase-0/START_HERE.md); never create an arbitrary `campaigns/` folder and declare it valid.

## Reviewer lineage & mandatory handoffs

Exactly one reviewer is active at a time:

| Reviewer | Authorized phases | Mandatory fresh-agent boundary after |
|---|---|---|
| `reviewer-1` (`gpt-5.6-terra`, high reasoning) | Phases 0–1 | Phase 1 |
| `reviewer-2` (`gpt-5.6-sol`) | Phases 2–5 | Phase 5 |
| `reviewer-3` | Phase 6 only (`reviewer-3A`/`3B`/`3C`) | Phase 6 |
| `reviewer-4` | Phases 7–8 | Phase 8 |
| `reviewer-5` | Phases 9–10 | none |

Fresh-session handoffs are mandatory after **Phase 1, Phase 5, Phase 6, and Phase 8**. All boundaries use the single generic [`SUCCESSOR_HANDOFF_PROTOCOL`](shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md) plus an exact boundary profile from [`SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json`](shared/handoff/SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json). A successor consumes sealed evidence and does not redo prior phases for convenience. A fresh session/agent lineage does **not** automatically make inherited evidence clean-room independent; use the evidence-independence classifications defined by the audit. The Phase-5 source-first retrace remains explicitly `PROCEDURAL_INDEPENDENCE_ONLY`.

### Find campaign-local handoffs

Use the GitHub connector app inside the exact current campaign `workspacePath`. Resolve the handoff referenced by controller state for the applicable boundary:

- Phase 1 → 2: profile `P1_TO_P2` under `handoffs/P1_TO_P2/`.
- Phase 5 → 6: profile `P5_TO_P6` under `handoffs/P5_TO_P6/`.
- Phase 6 → 7: profile `P6_TO_P7` under `handoffs/P6_TO_P7/`.
- Phase 8 → 9: profile `P8_TO_P9` under `handoffs/P8_TO_P9/`.

At a fresh-reviewer boundary, the successor reads the campaign-local `START_HERE_SUCCESSOR.md` **first**, then verifies the authoritative `SUCCESSOR_HANDOFF.json` and creates `SUCCESSOR_HANDOFF_RECEIPT.json`. The bootstrap packet is routing-only and never replaces the authoritative handoff.

Never substitute another campaign/generation's handoff. Each receiving phase card contains the exact reception checklist and recovery ladder.

