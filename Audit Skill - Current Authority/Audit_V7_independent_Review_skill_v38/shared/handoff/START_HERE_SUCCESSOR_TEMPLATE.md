# Successor Start Packet

> **GENERATED CAMPAIGN ARTIFACT — READ THIS FIRST.** This packet is intentionally tiny. It routes a fresh reviewer into the exact sealed handoff without exposing unnecessary predecessor context.

- Campaign ID: `<exact>`
- Campaign generation: `<exact>`
- Exact source identity: `<exact>`
- Boundary profile: `<P1_TO_P2 | P5_TO_P6 | P6A_TO_P6B | P6B_TO_P6C | P6_TO_P7 | P8_TO_P9>`
- Outgoing phase/revision: `<exact>`
- Receiving reviewer: `<exact>`
- Receiving phase: `<exact>`
- Authoritative handoff: `<exact campaign path>`
- Handoff payload digest: `<exact>`
- Receipt output: `<exact campaign path>`
- Security Traceability Graph: `<reference + digest + revision>`
- Carried-Forward Obligation Ledger: `<reference + digest + revision>`
- Domain Applicability Registry: `<reference + digest + revision>`
- Source Intelligence Bundle Index: `<reference + revision + commit SHA + SHA-256>`
- Accepted Source Intelligence components: `<core/runtime/readiness revisions + commits + SHA-256 + invalidation states>`
- OBL-* due in receiving phase: `<IDs or PRESENT_EMPTY>`
- Carried blockers/limitations relevant now: `<IDs or PRESENT_EMPTY>`
- Unresolved `INV-*` invalidation/rebind work relevant now: `<IDs or PRESENT_EMPTY>`
- Boundary-specific terminal state: `<P6_TO_P7 = PHASE6_SUBGATE_STATE ref/digest; otherwise NOT_APPLICABLE>`
- Exact next skill file after accepted receipt: `<phases/phase-N/START_HERE.md>`

## Execute

1. Use the GitHub connector app only.
2. Verify this packet against controller state; do not infer anything from prior chat.
3. Open the generic `SUCCESSOR_HANDOFF_RECEPTION_CHECKLIST.md`, selected boundary profile, and authoritative handoff.
4. Exhaust the recovery ladder before any missing-information claim.
5. Create the exact receipt. If accepted, open the exact next phase card above and continue immediately.
6. Verify any used mutable Source Intelligence path against its accepted component identity; do not redo predecessor phases for convenience or ask the human for narrative context.
