# Lite Successor Handoff Reception Checklist

Use only for `P0_TO_P1`, `P1_TO_P2`, `P5_TO_P6`, or `P67_TO_P8`.

- [ ] Read campaign-local `START_HERE_SUCCESSOR.md` first.
- [ ] Verify the boundary profile, campaign ID/generation, `workspacePath`, source/build identity, outgoing reviewer and incoming reviewer.
- [ ] Verify every required evidence/seed item is present, exact and digest-bound or explicitly typed as empty/not-applicable/blocked.
- [ ] Verify current graph, obligation ledger, invalidation state and due receiving obligations.
- [ ] Verify `WAKE_UP_MESSAGE.md` is present and standardized: campaign type `LITE`, exact campaign name, exact campaign-folder URL, controller `workspacePath`, current authority Lite `SKILL.md` location, boundary, incoming reviewer, and assigned Lite phase/milestone all match durable controller/handoff state.
- [ ] In orchestrator mode, verify local readable copies of the exact skill ZIP and source ZIP plus the current campaign link/workspace path.
- [ ] For `P0_TO_P1`, verify Phase-0 controller validation `PASS`, Bootstrap Audit Surface Manifest, accepted Source Intelligence Bundle, exact build/static evidence, automation run/artifact identities and the explicit semantic-authority exclusion.
- [ ] For `P1_TO_P2`, verify the accepted risk grade, Phase-0 Bootstrap Audit Surface Manifest and Source Intelligence bundle identities.
- [ ] For `P5_TO_P6`, verify complete property/hypothesis/domain/manual/candidate inputs and candidate-specific execution targets.
- [ ] For `P67_TO_P8`, verify the build/deploy-config evidence, every target disposition, omitted Full-only scope and Phase-7 completion marker.
- [ ] Create and seal `SUCCESSOR_HANDOFF_RECEIPT.json` before entering the receiving phase.

If an item is missing or corrupt, exhaust campaign/controller recovery and return only the defective handoff field. Do not redo predecessor work or ask the human for facts already present in durable evidence.
