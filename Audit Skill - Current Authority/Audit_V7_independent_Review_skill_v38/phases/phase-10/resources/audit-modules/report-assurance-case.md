<!--M:report-assurance-case:6f140f97213a7b3175ffb4fc8b878112e467daffbbd7062f1c82d7a6222035cf-->
### `report-assurance-case`
Trigger: Use for every engagement producing conclusions, client-facing reports, or final evidence.

## Authority

This module is mandatory when its trigger is true. It cannot weaken `shared/controller/AI_Auditor_Controller.md` or the Deep Assurance phase-status/security-verdict policy.

## Required Work

- Map every material claim to requirement, threat/failure mode, argument, accepted evidence, responsible lane, exact source identity, and status.
- Separate raw observations, candidates, validated findings, dismissed noise, limitations, and recommendations.
- Apply `phases/phase-10/resources/REPORTING_AND_OUTCOMES.md` literally for client-facing report structure, writing, evidence separation, and delivery requirements.
- Use `phases/phase-10/resources/FINAL_REPORT.md` plus `phases/phase-10/resources/FINAL_REPORT_SUPPLEMENT.md` for the client-facing final report.

### Mandatory client-facing methodology reconciliation

Before final report publication, build a methodology reconciliation from the sealed Phase 0–10 evidence. The final report MUST contain a dedicated `Audit Methodology & Security Processes` section. This is a structural publication requirement, not optional narrative.

For every substantive process below, either document the executed method/results or state typed `NOT_APPLICABLE` with the evidence-bound reason:

- exact-source admission, reproducible build, SBOM/coverage reconciliation;
- Phase-1 neutral Slither reconnaissance;
- source-first specification/threat-model work;
- Phase-4 manual implementation, line/flow, privilege, and integration review;
- Phase-5 economic/accounting/mathematical review and procedural-independent retrace;
- Phase-6 layered fuzz-campaign methodology: broad randomized Medusa discovery; human-derived property/invariant fuzzing; semi-targeted randomized fuzzing; stateful transaction-sequence fuzzing; mandatory coverage-guided refinement/reruns; dedicated targeted-adversarial campaigns; boundary/dictionary-directed fuzzing; objective trigger decisions and any executed multi-actor, independent-model, differential, or advanced corpus/deep-campaign escalation; plus terminal Medusa and native Foundry evidence in the required order;
- deterministic candidate reproduction and invariant/regression suites;
- Phase-7 pinned-fork lifecycle, repeated-state simulations, and external-integration validation;
- remediation diff review and fix regression verification;
- release/deployment verification and live-state attestation when performed.

For each executed process record in client-readable form: method/tool, exact tool version where applicable, why it was used, final execution status, meaningful quantitative results (for example detector observations, fuzz calls/cases, functions/ranges reviewed, test counts, fork block), security properties/findings it supported, and material limitations. Do not dump raw logs.

**Finalization gate:** if an executed/accepted substantive process is absent from this methodology section, or if an inapplicable process lacks typed `NOT_APPLICABLE` evidence, Phase 10 is incomplete and the final report MUST NOT be marked complete. The compact `Deep Assurance Results` table does not satisfy this requirement by itself.


### Mandatory material-claim assurance case and evidence independence\n\nBefore final publication, complete `phases/phase-10/resources/ASSURANCE_CASE.md` for every **material claim** under `phases/phase-10/resources/ASSURANCE_CASE_AND_EVIDENCE_INDEPENDENCE.md`. Each record must map: material claim → requirement/security property → threat/failure mode → argument → immutable evidence references → **evidence independence/diversity classification** → responsible lens → exact source identity → **exact release hash** or equivalent immutable release identity when release-bound → status → limitations.\n\nThe client-facing final report MUST include a concise top-level `Security Claims & Assurance Evidence` section. The full assurance-case ledger belongs in the evidence bundle and does not replace the client-facing summary; the summary does not replace the full ledger.\n\nDo not call correlated same-agent/model passes, `PROCEDURAL_INDEPENDENCE_ONLY` retraces, or shared-harness tests independent evidence. Record whether evidence is single-source, corroborated-but-correlated, or meaningfully diverse.\n\n**Finalization gate:** a material conclusion without an assurance-case record, a release-bound claim without an exact release hash/identity, a stale-source/release evidence binding, or a false evidence-independence claim makes Phase 10 incomplete. Report polish cannot override this gate.\n- Keep controller state, scheduling, leases, error ledgers, frozen sets, hashes, and publication receipts in the evidence/publication packet rather than the client-facing final report.
- Do not add Maximum Assurance v5-only process displays for work that Deep Assurance v6 did not execute.
- Do not let report polish override a process `FAIL`, missing accepted evidence, or the final High/Critical-only security-verdict rule.


## Required Output

Produce the polished client-facing Markdown final report plus the separate evidence/publication packet required by Deep Assurance v6. Include the concise client assurance summary in the final report and the full material-claim assurance-case ledger in the evidence bundle. Bind every conclusion to the exact scope, accepted evidence, and exact release identity when applicable.

**Mandatory separate client deliverable:** serve the completed `shared/reporting/Contract_Deployment_Gas_Report.md` **alongside the final audit report** and the other final audit information. It must contain one reconciled row for every independently deployable production contract using the compiler deployment-gas estimate captured during the existing Phase-7 simulation/deployment lifecycle. A missing file, a missing deployable-contract row, or an estimate taken from a different source/compiler/optimizer configuration blocks Phase-10 completion.
