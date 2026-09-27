# Reporting and Outcomes v5

This file is the complete current reporting authority. No earlier Reporting and Outcomes generation is required for execution.

This file preserves the client-facing reporting contract inherited by Maximum Assurance v5. The text below is copied from the pre-V5 authoritative reporting instructions and changed only where Deep Assurance v6 requires different process names, status semantics, or omission of Maximum-Assurance-only work that V6 did not execute.

---

## Internal phase-report durability requirement

The human-facing final report rules below are separate from internal phase reporting. At every Phase 0–10 boundary, the active reviewer MUST complete the phase-specific structured artifact named by `SKILL.md` / `SOLO_WORKFLOW_STATE_MACHINE.json` and then complete `shared/reporting/PHASE_REPORT.md`. The phase report must carry immutable references/digests for canonical outputs and explicitly record new canonical audit facts, carried-forward obligations, and evidence invalidation triggers. Missing structured filing blocks `EVIDENCE_SEALED` even when the narrative report is otherwise complete.


## Mandatory Final Report Section Order

1. Cover Page
2. Table of Contents
3. Summary
4. Scope
5. Overview or System Overview
6. Security Considerations and Threat Model
7. Deep Assurance Results
8. Critical Severity, if any
9. High Severity, if any
10. Medium Severity, if any
11. Low Severity, if any
12. Notes & Additional Information
13. Client-Reported Issues
14. Recommendations
15. Conclusion

Omit an empty detailed section only when it is genuinely inapplicable. The Summary must still report zero counts for empty severity tiers.

---

## Classification and Numbering

Every item belongs to exactly one class:

- `C-XX` — Critical
- `H-XX` — High
- `M-XX` — Medium
- `L-XX` — Low
- `N-XX` — Notes & Additional Information
- `CR-XX` — Client-Reported Issues
- `R-XX` — Recommendations

Do not collapse Notes, Client-Reported Issues, or Recommendations into one informational category.

### Launch Gate

- Unresolved Critical or High findings block sign-off and produce `securityVerdict: NO_GO`.
- Unresolved Medium findings remain fully reported but do not produce `NO_GO`.
- Low, Note, Client-Reported, and Recommendation items do not automatically produce `NO_GO` unless they combine into a larger systemic risk.
- A Deep Assurance process `FAIL` is not a finding severity and blocks finalization until repaired; do not generate a final `COMPLETE` client report while any process `FAIL` remains.

Consult the Deep Assurance v6 severity policy for expanded severity guidance.

---

## Summary Requirements

Include:

- engagement type
- timeline
- language or stack
- exact audited commit(s)
- `completionStatus` and `securityVerdict`
- highest unresolved validated severity
- total issue count
- count by Critical, High, Medium, Low, Note, and Client-Reported class
- resolved and partially resolved counts, when remediation was reviewed
- short overall assessment
- whether a remediation review was performed

Recommendations should be tracked separately and should not inflate the formal issue count.

---

## Scope Requirements

Include:

- repository name and URL
- exact commit(s)
- in-scope file tree or file list
- explicit exclusions
- distinction between full-file review and diff-only review
- phase-specific commits and files when the audit is staged
- deployed addresses when live-state validation is relevant

---

## Overview Requirements

Explain:

- what the system does
- how the main components interact
- primary user and administrator flows
- important architectural choices
- upgradeability and ownership model
- key integrations and dependencies
- material design tradeoffs
- for a diff audit, what changed and why the changes matter

Write polished narrative prose, not raw internal notes.

---

## Security Considerations and Threat Model Requirements

Explain:

- trusted, semi-trusted, and untrusted actors
- assets and invariants
- major attack surfaces
- privilege and upgrade risks
- liveness and external-dependency assumptions
- composition, extension, override, and integration risks
- important economic and time-based assumptions
- review priorities established before detailed audit work
- the severity model used in the report

---

## Deep Assurance Results

Include a compact client-readable table for the ten Deep Assurance phases and a compact client-readable table for the seven required lanes.

For each phase, state the phase name, its final successful status (`PASS`, `INFORMATIONAL_ISSUE_FOUND`, `LOW_ISSUE_FOUND`, `MEDIUM_ISSUE_FOUND`, `HIGH_ISSUE_FOUND`, or `CRITICAL_ISSUE_FOUND`), a one-line result, and a concise immutable evidence reference. For each lane, state the role, accepted result, and concise immutable evidence reference.

Do not include controller mailbox history, lease history, worker scheduling, raw error ledgers, frozen-set internals, or other orchestration exhaust in the client-facing final report. Keep those records in the evidence bundle.

Do not add Maximum Assurance v5-only process displays or imply execution of formal-engine counts, dual fuzz engines, mutation scores, repeated-lifecycle gates, dual clean-build environments, deployment ceremonies, or other processes unless that exact work was actually executed and accepted in the Deep Assurance v6 campaign.

---

## Finding Write-Up Format

Each finding must contain:

1. Identifier and descriptive title
2. Intended behavior or relevant context
3. Description of the defect or risk
4. Security or operational consequence
5. Concrete scenario, exploit path, or numerical example where useful
6. Direct recommendation
7. `Update:` block after remediation review, when applicable

Use file and line references where useful. Keep the prose continuous and professional rather than presenting a large metadata form.

Full PoC code, traces, and exhaustive reproduction steps belong in the evidence bundle unless essential to explain the finding.

---

## Remediation Status Language

Use one of these outcomes:

- Resolved in pull request `#...`
- Resolved in commit `...`
- Partially resolved
- Acknowledged, not resolved
- Acknowledged, will resolve
- Resolved; determined not to be an issue
- Mitigated through documentation
- Unresolved
- Risk accepted

Separate the client’s statement from the auditor’s verification conclusion. Never mark an item resolved solely because the client says it was fixed.

---

## Notes, Client-Reported Issues, and Recommendations

### Notes & Additional Information

Use for useful non-material observations involving documentation, readability, code quality, consistency, events, interfaces, maintainability, or gas.

### Client-Reported Issues

Use for issues disclosed by the client. Independently review each one and state whether the audit confirms it and whether the supplied remediation is effective.

### Recommendations

Use for broader hardening guidance such as additional invariants, monitoring, operational controls, design simplification, compatibility improvements, or future research.

Do not use Recommendations as a dumping ground for weak findings.

---

## Conclusion Requirements

State:

- what was reviewed
- overall security posture
- important strengths
- material unresolved concerns
- whether fixes were reviewed
- engagement limitations
- deployment conditions or risk-acceptance requirements
- that an audit improves assurance but cannot guarantee the absence of vulnerabilities

Do not repeat every finding.

---

## Evidence Bundle

Include, as applicable. Under Deep Assurance v6, include only evidence for work that was actually executed and accepted; do not require Maximum Assurance v5-only artifacts for processes that were not part of the campaign:

- scope manifests
- tool versions and commands
- static-analysis output
- coverage and gas artifacts
- added tests
- fuzz and invariant artifacts
- PoCs
- fork and replay scripts
- traces
- architecture and threat-model materials
- triage notes
- severity rationale
- remediation diffs and verification notes

---

---

## Anti-Drift and Anti-Clutter Rules

- This file controls. The reference manual only explains.
- Do not restate the methodology repeatedly in the final report.
- Do not include raw logs or tool spam in the final report.
- Do not turn every observation into a finding.
- Do not add optional appendices unless they materially help the reader.
- Do not invent a chain, deployment model, threat, result, or remediation status.
- Do not use generic filler such as “best practices should be followed.”
- Do not claim complete security or guaranteed safety.
- Do not import Maximum Assurance v5-only process sections, metrics, or evidence displays for work that Deep Assurance v6 did not execute.

---

## Definition of Done

The audit is complete only when:

- scope is frozen and reproducible
- architecture and trust assumptions are documented
- automated output is triaged
- all ten Deep Assurance phases are successfully terminal with `PASS` or the highest applicable `*_ISSUE_FOUND` status
- all seven required Deep Assurance lanes are accepted
- no process `FAIL` remains
- findings are validated, deduplicated, and severity-reviewed
- the final report follows the required section order
- Notes, Client-Reported Issues, and Recommendations are separated
- remediation is verified where fixes were supplied
- unresolved launch blockers are explicit
- the evidence bundle is complete
- the final report is polished and externally presentable

---

## Deep Assurance v6 Publication Binding

This subsection governs finalization mechanics and is **not** a client-facing report section.

Publication QA is a mandatory finalization gate. The authoritative final report must reconcile to the same report ID, frozen snapshot, section order, canonical findings, statuses, counts, `completionStatus`, and `securityVerdict`. Store publication receipts, controller records, process errors, and fetch-back verification in the evidence/publication packet rather than adding them as client-facing report sections.


---

## Current Markdown delivery rules

## Client-facing report authority

The required client-facing artifact is the final audit report in Markdown. Audit V7 does not require or generate a PDF. Use `phases/phase-10/resources/FINAL_REPORT.md` plus `phases/phase-10/resources/FINAL_REPORT_SUPPLEMENT.md` for content structure. This file contains the complete substantive reporting rules.

## Client-facing vocabulary

Internal skill/package/controller versions are not client-report metadata. Do not print `Audit V7`, the skill ID, package revision, phase-controller jargon or equivalent internal implementation branding unless the client explicitly asks for it.

## Factual separation

Every project-specific statement must be regenerated from the sealed current audit evidence. Do not copy facts, findings, hashes, deployment claims or version identifiers from unrelated or prior reports.

## Mandatory report QA

Before delivery, reconcile the final report against the sealed Phase 0–10 evidence, validated findings, remediation states, exact source/release identity, methodology reconciliation, assurance-case summary, completion status, and security verdict. A polished report cannot override missing evidence or a process failure.

The substantive section requirements, finding classes, severity semantics, source/release binding, methodology reconciliation, assurance-case requirements and finding write-up rules in this file are authoritative.

## Separate deployment-gas deliverable

The final client delivery MUST include `shared/reporting/Contract_Deployment_Gas_Report.md` as a separate Markdown file alongside the final audit report and other final audit information. The file is populated from the compiler deployment-gas estimates recorded during the existing Phase-7 deployment/simulation lifecycle; it is not a second gas-analysis workflow. Reconcile the table against every independently deployable production contract in the frozen scope. Missing rows block finalization.
