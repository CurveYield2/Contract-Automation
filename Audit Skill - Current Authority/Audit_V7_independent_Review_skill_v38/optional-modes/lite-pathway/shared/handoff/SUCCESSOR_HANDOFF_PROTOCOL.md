# Lite Successor Handoff Protocol

The isolated Lite pathway has exactly four fresh-agent boundaries:

- `P0_TO_P1`: `web-bootstrap-agent` → `reviewer-1`;
- `P1_TO_P2`: `reviewer-1` → `reviewer-2`;
- `P5_TO_P6`: `reviewer-2` → `reviewer-3L`;
- `P67_TO_P8`: `reviewer-3L` → `reviewer-4`.

There is no handoff inside combined Phases 2–5, merged Phases 6–7, or combined Phases 8–10.

## Outgoing procedure

1. Complete the active Phase Contract. For `P0_TO_P1`, seal the Phase-0 Web Bootstrap Completion Report and obtain controller validation `PASS`; for later boundaries, seal the applicable milestone report.
2. Bind exact campaign/generation, source/build, skill package and accepted Source Intelligence identities.
3. Attach immutable references/digests for every boundary-profile requirement.
4. Transfer the current graph, obligation ledger, invalidation state, limitations, blockers and exact due obligations.
5. Create `SUCCESSOR_HANDOFF.json`, `START_HERE_SUCCESSOR.md` and `WAKE_UP_MESSAGE.md` in `<workspacePath>/handoffs/<PROFILE_ID>/`.
6. Seal the handoff, enter `WAITING_FOR_SUCCESSOR_AGENT`, and stop the outgoing reviewer.

## Orchestrated deployment packet

When an orchestrator deploys the successor, the successor's local workspace must contain readable copies of the exact human-supplied skill ZIP and source ZIP. The deployment instruction must include their filenames, local paths and SHA-256 digests when available, plus the exact campaign link, controller `workspacePath`, campaign ID/generation and source identity. Repository links do not replace the two local ZIPs.

## Incoming procedure

The successor reads `START_HERE_SUCCESSOR.md` first, verifies the authoritative handoff against the boundary profile/schema and exact campaign identity, then writes `SUCCESSOR_HANDOFF_RECEIPT.json`. It consumes sealed prior work and must not recreate it for convenience.


## Active Artifact Minimization

The skill package is an operational manual, not an archive database. Handoff packages MUST prioritize active operational knowledge.

Transfer only artifacts required for successor execution:
- validated findings
- evidence references
- unresolved obligations
- assumptions
- coverage gaps
- required successor actions

Exploratory notes, superseded explanations, and obsolete instructional material MUST NOT be included unless they directly affect the successor phase decision.
