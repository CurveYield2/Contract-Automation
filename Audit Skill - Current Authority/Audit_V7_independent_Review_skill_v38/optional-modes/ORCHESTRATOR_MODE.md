# Optional Agent Orchestrator Mode

## Activation and authority

This file is outside the normal audit pathway. Do not open or apply it unless the human explicitly appoints the current Work agent as orchestrator, including with:

> Audit the attached source. You are the orchestrator. Check the skill file for instructions.

The attached source archive and skill packet are the initial authority. Resolve the exact campaign/source identity through the normal audit controls before substantive work. Unless the human also says `use lite mode`, assurance mode is `FULL`.

Orchestrator mode changes who manages the workflow; it does not weaken any normal audit requirement. The orchestrator manages the engagement from Phase 0 through final delivery so the human does not have to deploy, brief, monitor, or transition the individual review agents.

## Orchestrator model

Run the orchestrator as `gpt-5.6-sol` with `max` reasoning. `xhigh` (very high) is permitted only when `max` is unavailable. This is the sole permitted Lite-mode exception to the Lite worker ceiling of `high` reasoning.

## Required agent deployment table

`xhigh` means very-high reasoning. The rows preserve the normal reviewer boundaries. In Lite mode every Sol worker is reduced exactly one reasoning notch from `xhigh` to `high`; no Lite worker may use `xhigh`, `max`, or `ultra`. The Terra reviewer remains unchanged.

| Audit role | Authorized work | Full mode | Lite mode |
|---|---|---|---|
| Orchestrator | Entire engagement coordination and assurance review | `gpt-5.6-sol`, `max` | `gpt-5.6-sol`, `max` |
| `reviewer-1` | Phases 0–1 | `gpt-5.6-terra`, `high` | `gpt-5.6-terra`, `high` |
| `reviewer-2` | Phases 2–5 | `gpt-5.6-sol`, `xhigh` | `gpt-5.6-sol`, `high` |
| `reviewer-3A` | Full Phase 6A | `gpt-5.6-sol`, `xhigh` | Not deployed |
| `reviewer-3B` | Full Phase 6B | `gpt-5.6-sol`, `xhigh` | Not deployed |
| `reviewer-3C` | Full Phase 6C | `gpt-5.6-sol`, `xhigh` | Not deployed |
| `reviewer-3L` | Lite merged Phases 6–7 | Not deployed | `gpt-5.6-sol`, `high` |
| `reviewer-4` | Full Phases 7–8; Lite Phase 8 | `gpt-5.6-sol`, `xhigh` | `gpt-5.6-sol`, `high` |
| `reviewer-5` | Phases 9–10 | `gpt-5.6-sol`, `xhigh` | `gpt-5.6-sol`, `high` |

For a Lite-to-Full upgrade, deploy the Full-mode Phase 6–10 roles and reasoning levels. Do not lower the Full-upgrade workers merely because the original audit began in Lite mode.

## Start-to-finish orchestration

The orchestrator must:

1. Resolve the exact attached skill and source archive, admit the campaign, and bind all deployments to the same accepted campaign/source identity.
2. Record `FULL` or `LITE` before deploying the first worker. Only an explicit human instruction can select Lite mode.
3. Deploy each reviewer at the model/reasoning level above with only its authorized phase instructions and accepted predecessor evidence. Before work begins, place **local copies of the exact skill file and exact source ZIP supplied by the human inside that agent's accessible workspace**, and provide the **exact current campaign-folder link plus controller-resolved `workspacePath`**.
4. Manage every ordinary transition and fresh-reviewer handoff without requiring the human to relay instructions.
5. Receive and examine every phase report, structured filing, evidence index, limitation, obligation, and handoff before authorizing the next deployment.
6. Continue until the final report and evidence package are complete or a genuine irrecoverable external blocker remains after normal recovery is exhausted.

For every agent deployment, copy or attach the same skill-file bytes and the same source-ZIP bytes the human gave the orchestrator into the deployed agent's local accessible workspace; do not substitute an installed, cached, remembered, newer, extracted-only, or similarly named skill/source package. Verify both local paths are readable by that agent and include both filenames, local paths, and SHA-256 digests when available in its assignment. In the same dispatch, provide the exact current campaign-folder link, controller-resolved `workspacePath`, campaign ID, campaign-generation ID, and source identity. The campaign link does not replace either local file. The agent must use the supplied local skill, local source ZIP, and campaign location as its authority before beginning its assigned phase.

## Maximum Assurance / Maximum Coverage review gate

Before accepting a phase submission, the orchestrator independently checks:

- exact campaign, source, build, tool, deployment, and evidence identity;
- completion of every requirement authorized for the selected assurance mode;
- coverage of every in-scope contract, reachable security surface, property, hypothesis, candidate, integration, state transition, and activated specialist domain due in that phase;
- reproducibility and sufficiency of the submitted evidence rather than unsupported completion claims;
- contradictions, unexplained omissions, stale evidence, silent `NOT_APPLICABLE` decisions, unresolved obligations, and material residual coverage gaps;
- correctness and completeness of the proposed next transition and successor package.

If the submission does not meet the applicable Maximum Assurance / Maximum Coverage standard, the orchestrator must return it to the responsible worker with a bounded rework instruction containing:

1. the exact missing or inadequate requirement;
2. the affected artifact, surface, property, hypothesis, candidate, or evidence identity;
3. the additional or adapted analysis/execution required;
4. the objective evidence condition for acceptance.

The orchestrator may help the worker identify better methods, attack paths, simulations, or evidence strategies. It must not fabricate completion, silently waive mandatory work, or convert its own suspicion directly into a validated finding. A new technical concern is routed to the authorized reviewer as a candidate for evidence-backed investigation.

Re-review the corrected submission and repeat the bounded rework loop until it passes or reaches a permitted evidence-backed terminal limitation. Only then deploy the next authorized agent.

## Orchestrating Lite mode

When Lite mode is explicitly active, open and enforce [`LITE_MODE.md`](LITE_MODE.md). Judge maximum coverage against the authorized Lite scope while requiring transparent enumeration of everything reserved for a later Full upgrade. Do not force omitted Full-only Phase 6–7 campaigns into the Lite run, and do not describe Lite evidence as Full assurance.
