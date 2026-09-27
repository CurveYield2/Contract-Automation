# Phase 0 Capability Preflight

## Identity
- Campaign / generation:
- Exact source identity:
- Executor/session: `web-bootstrap-agent` /
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
| Complete deploy/config simulation | | | | | |
| Deterministic candidate simulation | | | | | |
| Basic targeted fuzz execution | | | | | |
| Mutable/archive fork simulation when required by deployment/candidates | | | | | |
| Durable evidence storage | | | | | |
| Lite milestone-report delivery | | | | | |


## Existing automation supervision
- Contract-Automation admitted/qualified runner identity:
- Qualification evidence/run identity:
- Qualification refresh triggered in this session: `YES | NO | NOT_REQUIRED`
- Required bootstrap workflows/requests observed to terminal status: `YES | NO`
- Any still-running routine bootstrap automation: **must be 0 before retirement**
- Retrieved/verified bootstrap artifact references:

## Admission conclusion
- Blocking capabilities:
- Carried limitations:
- Evidence invalidation triggers:
- Phase-0 bootstrap completion status:
- Fresh reviewer-1 admission status:

## Campaign-global synchronization
Before milestone sealing, mirror every material stable ID/relationship created or changed by this artifact into the campaign-local `SECURITY_TRACEABILITY_GRAPH`, and mirror every deferred/later-segment-required action into the canonical `CARRIED_FORWARD_OBLIGATION_LEDGER` with a stable `OBL-*` ID. Record immutable graph/ledger references and digests in the Lite Milestone Report.
