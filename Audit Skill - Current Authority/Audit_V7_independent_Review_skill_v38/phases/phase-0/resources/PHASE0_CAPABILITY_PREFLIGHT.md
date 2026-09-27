# Phase 0 Capability Preflight

## Identity
- Campaign / generation:
- Exact source identity:
- Reviewer lineage/session:
- Controller contract/release identity:

## Capability admission table
| Capability | Required? | Admitted implementation/profile/version | Status `PASS | BLOCKED | NOT_APPLICABLE` | Durable evidence reference | Limitation / recovery path |
|---|---|---|---|---|---|
| Controller/state authority | | | | | |
| GitHub connector app — live read of `CurveYield2/Audit-Controller` | YES | GitHub connector app | | | Connector outage ladder + mandatory human outage report if unresolved |
| GitHub connector app — live read of `CurveYield2/Contract-Automation` | YES | GitHub connector app | | | Connector outage ladder + mandatory human outage report if unresolved |
| Source acquisition/inventory | | | | | |
| Exact build/compiler | | | | | |
| Neutral static analysis | | | | | |
| Medusa fuzz execution | | | | | |
| Native Foundry fuzz/invariant execution | | | | | |
| Mutable/archive fork simulation | | | | | |
| Durable evidence storage | | | | | |
| Phase-report delivery | | | | | |

## Admission conclusion
- Blocking capabilities:
- Carried limitations:
- Evidence invalidation triggers:
- Phase-1 admission status:

## Campaign-global synchronization
Before phase sealing, mirror every material stable ID/relationship created or changed by this artifact into the campaign-local `SECURITY_TRACEABILITY_GRAPH`, and mirror every deferred/later-phase-required action into the canonical `CARRIED_FORWARD_OBLIGATION_LEDGER` with a stable `OBL-*` ID. Record the current immutable graph/ledger references and digests in the Phase Report. Narrative reminders do not replace these global artifacts.
