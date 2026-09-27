# Audit V7 Assurance Case Ledger v1

Create one record for **every material claim**. Keep this full ledger in the evidence bundle. The client-facing final report contains only the required concise summary defined in `phases/phase-10/resources/ASSURANCE_CASE_AND_EVIDENCE_INDEPENDENCE.md`.

## AC-___

- **Claim ID:** `AC-___`
- **Claim:**
- **Requirement / security property:**
- **Threat / failure mode:**
- **Argument:**
- **Evidence refs:**
  - `EVIDENCE_REF` — evidence class: `MECHANICALLY_INDEPENDENT_TOOL | RUNTIME_EXECUTION | MANUAL_SOURCE_REVIEW | EXTERNAL_LIVE_STATE | PROCEDURAL_INDEPENDENCE_ONLY | CORRELATED_SAME_AGENT | SHARED_HARNESS_EVIDENCE`
- **Evidence diversity:** `SINGLE_SOURCE | CORROBORATED_BUT_CORRELATED | MEANINGFULLY_DIVERSE`
- **Responsible lens:**
- **Exact source identity:**
- **Exact release hash / immutable release identity:**
- **Status:** `SUPPORTED | PARTIALLY_SUPPORTED | UNSUPPORTED | NOT_APPLICABLE | SUPERSEDED`
- **Limitations / assumptions:**
- **Client-report summary required:** `YES | NO`
- **Finding/property linkage:**

## Gate

Do not mark a material claim `SUPPORTED` unless its exact source identity and accepted evidence are present. Release-bound claims also require an exact release hash or equivalent immutable release identity. Same-agent/correlated evidence MUST NOT be described as independent.
