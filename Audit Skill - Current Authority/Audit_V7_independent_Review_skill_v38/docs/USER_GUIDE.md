# Audit V7 Independent Review — User Guide

The runtime is intentionally sequential and progressive-disclosure.

1. Start at `SKILL.md` only.
2. Resolve the exact campaign/current phase using the connected **GitHub connector app**.
3. Open only `phases/phase-<current>/START_HERE.md`.
4. Follow the numbered phase card in order.
5. Open a resource only when the active step links to it or its conditional trigger applies.
6. At phase end, seal the phase-specific structured artifact, file the universal Phase Report, submit it to the human, and stop for response.

GitHub repository access is connector-only. Do not use a web browser, browser connector, generic web search, direct/raw GitHub URL outside the GitHub connector, `curl`, `wget`, or another repository-access route.

Fresh reviewer changes after Phase 5, Phase 6, and Phase 8 are hard sequential handoff boundaries. Sealed prior-phase work is consumed rather than repeated unless controller rework/invalidation explicitly reopens it.


## Phase contracts, traceability and carried obligations
Every phase now has a machine-readable `PHASE_CONTRACT.json` that must be opened before Step 1. The audit also maintains one campaign-global Security Traceability Graph and one Carried-Forward Obligation Ledger. These prevent security properties/hypotheses from disappearing between phases and prevent later-phase promises from being forgotten. Every phase report records immutable checkpoints of both artifacts; fresh-reviewer handoffs carry them forward.
