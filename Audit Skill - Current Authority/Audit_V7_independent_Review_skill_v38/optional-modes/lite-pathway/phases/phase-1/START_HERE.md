# Phase 1 — Semantic Scope, Dependency/Standards Analysis & Security Risk Grade

> **EXECUTOR:** fresh `reviewer-1` — `gpt-5.6-terra`, `high` reasoning. Phase 0 was performed by the mechanical `web-bootstrap-agent`; consume its sealed outputs and do not repeat neutral build/recon/Source-Intelligence work for orientation.

> **CURRENT-PHASE READ BOUNDARY:** Read this card first. Open only resources linked by the active step.

> **PHASE CONTRACT HARD GATE:** Before Step 1, open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json). Verify the `P0_TO_P1` successor receipt and the Phase-0 controller validation `PASS`. If either is absent/invalid, repair the boundary; do not silently reconstruct Phase 0.

> **UNIVERSAL RULE IDS:** `U-EXEC-001`, `U-GITHUB-001`, `U-STATE-001`, `U-EVIDENCE-001`, `U-REPAIR-001`, `U-HUMAN-001`, `U-DISCLOSURE-001`, `U-SOURCEINTEL-001`, `U-UPDATES-001`, and `U-HUMANCOMMS-001` remain binding.

## Phase card

| Step | Action | What to do | Open only when this step is active |
|---:|---|---|---|
| 1 | **Accept P0_TO_P1 and the sealed bootstrap baseline** | Verify campaign/source/build/skill identities, Phase-0 completion `PASS`, Bootstrap Audit Surface Manifest, accepted Source Intelligence Bundle, automation evidence and current global-control checkpoints. Consume them; do not regenerate them for convenience. | [Handoff checklist](../../shared/handoff/SUCCESSOR_HANDOFF_RECEPTION_CHECKLIST.md) · [SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) |
| 2 | **Perform semantic specification/scope interpretation** | Starting from the Phase-0 documented-input and structural indexes, determine protected assets, meaningful actor authority, units/bounds/state transitions, trust boundaries, prohibited outcomes, reviewer-derived requirements and unresolved specification ambiguity. Verify raw source/docs only where semantic judgment requires it. | [specification-assurance.md](../../../../shared/domain-modules/specification-assurance.md) · [scope-specification-lens.md](../../shared/lenses/scope-specification-lens.md) |
| 3 | **Analyze external-dependency trust and failure semantics** | Use the Phase-0 structural dependency inventory; determine trust assumptions, upgrade/authority implications, nonstandard behavior, failure propagation and evidence required later. Update the dependency ledger semantically instead of rebuilding identities/interfaces. | [external-dependencies.md](../../../../shared/domain-modules/external-dependencies.md) · [EXTERNAL_DEPENDENCY_LEDGER.md](../../shared/domain-ledgers/EXTERNAL_DEPENDENCY_LEDGER.md) |
| 4 | **Determine standards applicability and conformance requirements** | Use Phase-0 claimed-standard/interface inventory as baseline; determine which standards materially apply and what mandatory/optional behavior later review must test. Do not repeat interface enumeration. | [standards-conformance.md](../../../../shared/domain-modules/standards-conformance.md) · [STANDARDS_CONFORMANCE.md](../../shared/policy/STANDARDS_CONFORMANCE.md) |
| 5 | **Enter the bounded risk-grading lens** | Enter the isolated scope/specification lens using the accepted Phase-0 structural evidence plus the semantic conclusions from Steps 2–4. | [SOLO_LENS_ISOLATION_PROTOCOL.md](../../shared/lenses/SOLO_LENS_ISOLATION_PROTOCOL.md) · [scope-specification-lens.md](../../shared/lenses/scope-specification-lens.md) |
| 6 | **Set and seal the evidence-based security risk grade** | Grade protected assets, authority, accounting/value flows, dependency exposure, credible loss/impact, assumptions and promotion triggers. Complete the risk-grade manifest. | [security-risk-grading.md](../../../../shared/domain-modules/security-risk-grading.md) · [PHASE1_SECURITY_RISK_GRADE_MANIFEST.md](resources/PHASE1_SECURITY_RISK_GRADE_MANIFEST.md) |
| 7 | **Reconcile campaign-global security state** | Add semantic SCOPE/RISK/requirement relationships to the Security Traceability Graph, reconcile obligations due in Phase 1, add stable later-phase OBL-* work and classify material evidence changes. | [SECURITY_TRACEABILITY_GRAPH.json](../../shared/controller/SECURITY_TRACEABILITY_GRAPH.json) · [CARRIED_FORWARD_OBLIGATION_LEDGER.json](../../shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json) · [EVIDENCE_INVALIDATION_MATRIX.json](../../shared/controller/EVIDENCE_INVALIDATION_MATRIX.json) |
| 8 | **File the single P0_1 milestone report and obtain completion PASS** | Combine the sealed Phase-0 bootstrap evidence with Phase-1 semantic/risk outputs into the single immutable P0_1 milestone report. The current controller/Phase-Contract completion validation must report `PASS`; if not, remain active and repair only the identified gap. | [PHASE_REPORT.md](../../shared/reporting/PHASE_REPORT.md) · [AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md](../../shared/controller/AUTOMATIC_PHASE_ADVANCEMENT_PROTOCOL.md) |
| 9 | **Create and validate P1_TO_P2 successor package** | Create/validate `SUCCESSOR_HANDOFF.json`, `START_HERE_SUCCESSOR.md`, and `WAKE_UP_MESSAGE.md` for fresh reviewer-2; enter `WAITING_FOR_SUCCESSOR_AGENT` and retire only after the phase and handoff gates pass. | [SUCCESSOR_HANDOFF_PROTOCOL.md](../../shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md) · [SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json](../../shared/handoff/SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json) |

## No-repeat rule

Phase 1 MUST NOT redo Phase-0 exact build admission, neutral Slither/static/SBOM execution, structural Source Intelligence generation, dependency/interface enumeration, or generic structural indexing merely for orientation. Reopen raw source where required for semantic judgment, contradiction checking, or a material discrepancy.

## Mandatory end-of-phase structured filing

Complete `PHASE1_SECURITY_RISK_GRADE_MANIFEST.md`, the semantically enriched external-dependency/standards conclusions, campaign-global graph/obligation/invalidation updates, and one combined P0_1 milestone report. The report references the sealed Phase-0 Bootstrap Audit Surface Manifest and Source Intelligence identities rather than creating replacements.

A fresh `reviewer-2` must receive and accept `P1_TO_P2`; reviewer-1 must not execute Phase 2.
