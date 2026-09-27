# Lite Successor Handoff Protocol

The isolated Lite pathway has exactly four fresh-agent boundaries:

- `P0_TO_P1`: `web-bootstrap-agent` → `reviewer-1`;
- `P1_TO_P2`: `reviewer-1` → `reviewer-2`;
- `P5_TO_P6`: `reviewer-2` → `reviewer-3L`;
- `P67_TO_P8`: `reviewer-3L` → `reviewer-4`.

There is no handoff inside combined Phases 2–5, merged Phases 6–7, or combined Phases 8–10.

## Standard successor assignments

| Boundary | Incoming reviewer | Assigned Lite work |
|---|---|---|
| `P0_TO_P1` | `reviewer-1` | **Phase 1** |
| `P1_TO_P2` | `reviewer-2` | **Combined Lite Phases 2–5** |
| `P5_TO_P6` | `reviewer-3L` | **Merged Lite Phases 6–7** |
| `P67_TO_P8` | `reviewer-4` | **Combined Lite Phases 8–10** |

The assigned work above must appear verbatim or equivalently unambiguously in each `WAKE_UP_MESSAGE.md`.

## Outgoing procedure

1. Complete the active Phase Contract work and freeze the applicable phase/milestone report. **For `P0_TO_P1`, the Phase-0 report is a pre-validation report and MUST be frozen before controller completion validation; do not self-certify controller `PASS` inside it.**
2. Bind exact campaign/generation, exact campaign folder name and URL, controller `workspacePath`, source/build, skill package and accepted Source Intelligence identities.
3. Attach immutable references/digests for every boundary-profile requirement.
4. Transfer the current graph, obligation ledger, invalidation state, limitations, blockers and exact due obligations.
5. Create `SUCCESSOR_HANDOFF.json`, `START_HERE_SUCCESSOR.md` and `WAKE_UP_MESSAGE.md` in `<workspacePath>/handoffs/<PROFILE_ID>/`.
6. Generate `WAKE_UP_MESSAGE.md` from the standard template. Every wake message MUST state: campaign type `LITE`; exact campaign name; exact campaign-folder URL; exact controller `workspacePath`; current authority Lite `SKILL.md` repository path and URL; boundary; incoming reviewer; and the exact Lite phase/milestone assigned to that reviewer.
7. Validate and seal the handoff package.
8. **P0_TO_P1 special order:** only after the handoff package and Phase-1 wake message validate, submit the Phase-0 completion companion, obtain machine-generated completion-validation `PASS`, obtain the retirement-gate `PASS`, then enter `WAITING_FOR_SUCCESSOR_AGENT` and stop.
9. **Later fresh-reviewer boundaries:** follow the active Phase Contract/controller retirement ordering, but retirement still requires a valid standardized wake message and handoff-validation `PASS` before `WAITING_FOR_SUCCESSOR_AGENT`.

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
