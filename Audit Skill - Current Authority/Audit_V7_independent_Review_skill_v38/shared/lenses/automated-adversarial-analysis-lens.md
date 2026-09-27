# Automated Adversarial Analysis Lens v2

**Executor:** `reviewer-1` for Phase-1 Slither; the active Phase-6 subreviewer for Phase-6 fuzz campaigns and triggered replays.  
**Active:** Phase 1 neutral Slither reconnaissance; Phase 6 Medusa/native Foundry campaign tree; triggered replays.

This lens preserves the corresponding Deep Assurance V6.1 role objective without claiming a separate reviewer identity. Use the current phase instruction, applicable domain ledgers, exact evidence bindings, `shared/lenses/SOLO_LENS_ISOLATION_PROTOCOL.md`, and for Phase 6 the complete methodology in `phases/phase-6/resources/PHASE6_FUZZ_CAMPAIGN_METHODOLOGY.md`.

The lens may produce candidates, challenges, reconciliations, models, or evidence validation, but it cannot bypass the current phase, automatic advancement gate, source identity, findings-validation pipeline, or final evidence convergence.

## Phase 6 responsibilities

The lens MUST:

1. create missing audit-only Medusa and native Foundry fuzz/invariant harnesses/scripts/configuration;
2. execute broad Medusa discovery before targeted narrowing;
3. convert sealed Phase-2–5 security properties/hypotheses into executable properties, state machines, boundaries, and attack campaigns;
4. preserve randomized exploration inside semi-targeted/targeted campaigns;
5. perform coverage/security-surface review and mandatory harness/config refinement plus rerun for both engine families;
6. execute dedicated targeted-adversarial campaigns rather than treating broad fuzzing as a substitute;
7. evaluate and execute the trigger-mandatory multi-actor, independent-model, differential, and deep-campaign processes when their objective triggers fire;
8. use `phases/phase-6/resources/PHASE6_FUZZ_CAMPAIGN_LEDGER.md` as the process record;
9. preserve counterexamples and route them to Phase-8 validation; and
10. distinguish process success/failure from finding severity.

Repository omission of a fuzz harness is not an applicability waiver. Harness/model artifacts must remain outside frozen production source and be separately bound to the exact audited source identity.


## Mutable Anvil RPC enforcement

Before accepting any Phase-6 Medusa or Foundry evidence, verify compliance with `phases/phase-6/resources/PHASE6_MUTABLE_ANVIL_RPC_POLICY.md`: existing profile `SIM_ARCHIVE_PRIMARY_ETHEREUM_01`, preflight-frozen Ethereum block number/hash, Medusa fork mode, same Foundry fork identity, no alternate/requester RPC, and no durable secret URL. Failure of this binding is an execution/infrastructure failure even if the fuzz tool itself reports success.


## v29 Phase-6 subreviewer split

- `reviewer-3A`: maps properties/accounting/attack hypotheses to complete campaign/harness plans and executes P6.0 admission only.
- `reviewer-3B`: executes P6.1–P6.6 Medusa-side broad/property/stateful/accounting-chaos/targeted/known-attack/advanced work and seals terminal Medusa evidence.
- `reviewer-3C`: independently executes P6.7 native Foundry, mutation sensitivity, multidimensional coverage closure and P6.8 final reconciliation.

The existing Process 1–11 requirements remain intact. Qualified Historical Exploit KB and six-layer automation are optional accelerators until deployed; manual v29 fallback artifacts are mandatory when those systems are unavailable.
