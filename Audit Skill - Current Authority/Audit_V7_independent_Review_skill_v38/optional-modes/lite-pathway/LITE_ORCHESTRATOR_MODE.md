# Lite Pathway Orchestrator

## Activation

Use this file only when the human explicitly appoints the current Work agent as orchestrator and selects Lite mode. Run the Lite orchestrator as `gpt-5.6-sol` with `medium` reasoning.

The Lite orchestrator is a workflow controller, not the primary security analyst. Its responsibilities are:
- phase routing
- evidence integrity checks
- worker coordination
- packet validation
- escalation decisions

The orchestrator must not independently duplicate full security analysis. Deep reasoning is reserved for specialist reviewers and conditional adversarial verification when a trigger below actually applies.

Before every worker starts, place local readable copies of the exact human-supplied skill ZIP and source ZIP in that worker's accessible workspace. Include both filenames, local paths and SHA-256 digests when available. Also provide the exact current campaign-folder link, controller `workspacePath`, campaign ID, campaign-generation ID, and source identity. A repository link does not replace either local ZIP.

## Web bootstrap plus four semantic reviewer deployments

| Milestone | Reviewer | Model / reasoning | Required packet |
|---|---|---|---|
| Phase 0 | `web-bootstrap-agent` | ChatGPT web chat + GitHub connector; mechanical only | Exact skill/source, admission authority, campaign folder |
| Phase 1 | `reviewer-1` | `gpt-5.6-terra`, `high` | Sealed P0_TO_P1 bootstrap packet, accepted Source Intelligence and automation evidence |
| Combined Phases 2–5 | `reviewer-2` | `gpt-5.6-sol`, `high` | Sealed Phase 0–1 evidence and P1_TO_P2 handoff |
| Merged Lite Phases 6–7 | `reviewer-3L` | `gpt-5.6-sol`, `high` | Combined analytical packet, candidate/property/hypothesis indexes, exact build/deployment inputs |
| Combined Phases 8–10 | `reviewer-4` | `gpt-5.6-sol`, `high` | Merged 6–7 evidence, all candidates, remediation artifacts if any, final release identity |

Do not deploy reviewers 3A, 3B, 3C, reviewer-5, or a separate Phase-7 agent in the initial Lite audit.

## Four milestone reviews

The orchestrator reviews only these completed milestone packets:

1. Phase 0–1 packet: Phase-0 web-bootstrap completion/automation evidence + Phase-1 semantic scope and risk grade.
2. Combined Phase 2–5 specification, threat/domain model, complete manual/specialist coverage, economic/math work, and contradiction/candidate reconciliation.
3. Merged Lite Phase 6–7 deployment/configuration simulation and candidate-specific deterministic/targeted-fuzz evidence.
4. Combined Phase 8–10 candidate validation, conditional remediation disposition, concise evidence index, limitations, and final Lite verdict.

Do not reread and regrade every intermediate segment or require duplicate phase reports. Expand raw evidence only when the milestone packet exposes a contradiction, missing identity, unexplained omission, unsupported disposition, open due obligation, or material coverage gap.

If a retained Lite requirement is inadequate, return one bounded rework instruction identifying the exact gap, affected artifact/surface/candidate, required additional work, and objective acceptance condition. Recheck only the corrected packet and affected dependencies. Full-only work expressly omitted by this Lite pathway is recorded as residual assurance scope; it is not a Lite rework requirement.

The orchestrator must not fabricate completion, silently waive retained work, or convert its own suspicion into a finding. Route a new technical concern to the authorized worker as a candidate for evidence-backed investigation.

## Full upgrade

When the human orders Full extensive testing, stop Lite routing and follow [`LITE_TO_FULL_UPGRADE.md`](LITE_TO_FULL_UPGRADE.md). Deploy the standard Full-path roles at their Full reasoning levels and reuse every valid Lite artifact rather than restarting the audit.



## Conditional Final Adversarial Assurance Review

Do **not** deploy an additional reviewer routinely. Trigger one independent final adversarial review only when at least one of these conditions exists: a validated High/Critical finding; a material unresolved contradiction; low-confidence closure on a high-risk economic/privilege surface; a materially complex interaction whose residual risk is not adequately challenged by the four normal reviewer lineages; or an explicit human request. Otherwise record `CONDITIONAL_FINAL_ADVERSARIAL_REVIEW_NOT_TRIGGERED` and proceed without the extra model call.

Reviewer: `gpt-5.6-sol`
Reasoning: `max`

Purpose:
- independently challenge findings
- identify missed attack surfaces
- verify severity classifications
- detect false positives
- reconstruct multi-step exploit chains
- review unresolved contradictions

When triggered, the reviewer receives the existing Phase 0 Source Intelligence bundle and only the downstream packets relevant to the trigger. It must reuse sealed Source Intelligence artifacts and must not recreate duplicate structural inventories.

The adversarial reviewer must not merely summarize previous work. It must attempt independent discovery of material missing risks.


## Source Intelligence Compression and Reuse

The Phase 0 Source Intelligence bundle is the canonical compression layer. Do not create a second parallel contract intelligence package.

All later reviewers must reuse the sealed Phase 0 bundle, including structural inventory, reachable surfaces, dependency information, and overlays. Generate only incremental deltas when new evidence requires them.

## Finding Consolidation Layer

- merge duplicate findings
- preserve evidence lineage
- remove unsupported claims
- group related attack paths
- retain disagreements for adversarial review

Reviewer-4—and any conditional adversarial reviewer when triggered—evaluates unique security hypotheses rather than repeated worker output.

