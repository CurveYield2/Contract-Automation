# Phase 0 — Web Bootstrap, Source Intelligence & Execution Readiness

> **EXECUTOR:** `web-bootstrap-agent` — a ChatGPT web-chat agent with the GitHub connector. This actor performs only neutral/mechanical/repetitive work. It has **no authority** to make security findings, threat judgments, risk/severity decisions, exploitability conclusions, standards-conformance conclusions, dependency trust judgments, or remediation decisions.

> **ONE-SESSION OBJECTIVE:** Complete every safely front-loadable mechanical task and supervise all required existing GitHub/Contract-Automation bootstrap execution to terminal validated evidence in this Phase-0 session. Do not leave routine setup for reviewer-1.

> **CURRENT-PHASE READ BOUNDARY:** Read this card first. Do **not** open another phase folder. Open only the resource linked by the active step below; conditional resources are opened only when their trigger applies.

> **PHASE CONTRACT HARD GATE:** Before executing Step 1, open [`PHASE_CONTRACT.json`](PHASE_CONTRACT.json). It is the machine-readable contract for this phase. Complete every Phase-0 contract step and sealing criterion, including the fully validated `P0_TO_P1` successor package and Phase-1 wake message, **before** submitting the completion companion for controller validation. Controller `PASS` is produced after those inputs are complete and is never an input to its own validation.

> **UNIVERSAL RULE IDS:** `U-EXEC-001`, `U-GITHUB-001`, `U-STATE-001`, `U-EVIDENCE-001`, `U-REPAIR-001`, `U-HUMAN-001`, `U-DISCLOSURE-001`, `U-SOURCEINTEL-001`, `U-UPDATES-001`, and `U-HUMANCOMMS-001` remain binding.

## Phase card

| Step | Action | What to do | Open only when this step is active |
|---:|---|---|---|
| 1 | **Initialize or bind the exact Lite campaign and source** | For a fresh campaign, the agent supplies only one direct ZIP-file URL to the `Audit Source Initialization` workflow. The workflow derives the filename/hash/size/slug, allocates the next `rN` campaign and `g1` generation, creates `campaigns/<campaign>/source/`, stores the ZIP there, safely unpacks it into the same `source/` folder, writes the initial controller state + active pointer, publishes `.deep-assurance/active/<slug>.json`, and arms the Lite monitor. Repeated ZIP submissions create a new `rN`; exact workflow retries reuse the same result. For an existing campaign, bind its exact durable state instead of creating a new one. | [AUDIT_CONTROLLER_AND_GITHUB_PROTOCOL.md](../../shared/controller/AUDIT_CONTROLLER_AND_GITHUB_PROTOCOL.md) · [GITHUB_ACTIONS_VIA_GITHUB_APP.md](../../shared/execution/GITHUB_ACTIONS_VIA_GITHUB_APP.md) |
| 2 | **Verify the initialized source fence and extraction** | Verify the workflow-produced campaign/source state: exact URL-derived archive identity, SHA-256, byte length, Git blob, admission commit, canonical `source/` path, and unpacked-tree digest. Do not manually repeat source inventory; the Phase-0 intelligence automation performs the mechanical inventory in Step 4. | [SOLO_AUDIT_STATE.json](../../shared/controller/SOLO_AUDIT_STATE.json) |
| 3 | **Prove GitHub and execution-plane readiness** | Prove live GitHub-connector reads against `CurveYield2/Audit-Controller` and `CurveYield2/Contract-Automation`. Inspect the currently admitted Contract-Automation qualification. If qualification/admission is stale or absent, trigger the **existing** qualification/bridge path, observe it to terminal state, retrieve evidence and repair only by existing recovery routes. | [PHASE0_CAPABILITY_PREFLIGHT.md](resources/PHASE0_CAPABILITY_PREFLIGHT.md) · [GITHUB_ACTIONS_VIA_GITHUB_APP.md](../../shared/execution/GITHUB_ACTIONS_VIA_GITHUB_APP.md) · [INSTRUCTION_READ_PROOF.json](resources/INSTRUCTION_READ_PROOF.json) |
| 4 | **Initiate and supervise all required existing bootstrap automation** | Use only existing Contract-Automation/bridge capabilities. Trigger the exact build/static/SBOM/structural execution required by the accepted source; observe each required run to terminal state, capture request/run/job/artifact identities, retrieve evidence, diagnose mechanically recoverable failures and retry. Starting a workflow is not completion. | [TECHNICAL_EXECUTION_REQUEST_PLAYBOOK.md](../../shared/execution/TECHNICAL_EXECUTION_REQUEST_PLAYBOOK.md) · [EXECUTION_PREFLIGHT_AND_REPAIR_PROTOCOL.md](../../shared/execution/EXECUTION_PREFLIGHT_AND_REPAIR_PROTOCOL.md) |
| 5 | **Admit the exact build/compiler identity** | Establish the exact compiler/build/toolchain identity and accepted compiler artifacts for the frozen source using the returned execution evidence. | [supply-chain-build.md](../../../../shared/domain-modules/supply-chain-build.md) |
| 6 | **Generate and seal the canonical Source Intelligence core** | Fill the exact supplied template from the admitted source/build. Populate structural source/build facts, ABI/callable surfaces, storage/inheritance/interface facts, external-call topology, raw privilege/access candidates, structural protocol topology and preliminary compiler gas estimates. No semantic security conclusions. | [SOURCE_INTELLIGENCE_TEMPLATE.json](../../shared/source-intelligence/SOURCE_INTELLIGENCE_TEMPLATE.json) · [SOURCE_INTELLIGENCE_SCHEMA.json](../../shared/source-intelligence/SOURCE_INTELLIGENCE_SCHEMA.json) · [SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) |
| 7 | **Attach neutral static reconnaissance and SBOM** | Attach exact neutral Slither/static/SBOM/tool evidence and candidate indexes to Source Intelligence. Analyzer output is machine evidence/candidate input, never a finding. | [supply-chain-build.md](../../../../shared/domain-modules/supply-chain-build.md) · [SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) |
| 8 | **Initialize overlays and pin the accepted Source Intelligence Bundle** | Initialize runtime/deployment and assurance-readiness overlays with discovery/readiness facts only; commit accepted revisions and the Bundle Index with exact revision/commit/digest/status/invalidation/preserved-snapshot identities. Do not accept Phase-6 adequacy or Phase-7 runtime/gas conclusions. | [Runtime overlay](../../shared/source-intelligence/RUNTIME_DEPLOYMENT_OVERLAY_TEMPLATE.json) · [Readiness overlay](../../shared/source-intelligence/ASSURANCE_READINESS_OVERLAY_TEMPLATE.json) · [Bundle index](../../shared/source-intelligence/SOURCE_INTELLIGENCE_BUNDLE_TEMPLATE.json) |
| 9 | **Front-load neutral specification/dependency/standards inputs** | Mechanically index documented actors/roles, declared intent, interfaces, explicit exclusions, dependency identities/addresses/interfaces/upgrade facts and claimed standards. Do **not** determine protected-asset priority, trust assumptions, failure propagation, standards applicability/conformance, or negative security requirements. | [PHASE0_BOOTSTRAP_AUDIT_SURFACE_MANIFEST.md](resources/PHASE0_BOOTSTRAP_AUDIT_SURFACE_MANIFEST.md) |
| 10 | **Precompute reusable later-phase structural indexes** | Ensure Phase 0 leaves reusable ABI/function/event/error/selector, storage, inheritance/interface, call/create/delegate, raw privilege, deployment-script/config-field, test/script/harness availability and bytecode/runtime-size references wherever the current source/tooling supports them. Reuse Source Intelligence rather than creating parallel inventories. | [SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md](../../shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md) |
| 11 | **Complete the frozen Bootstrap Audit Surface Manifest** | Reconcile exact source/build/dependency/deployable/neutral-recon/Source-Intelligence identities and the neutral documented-input indexes into the Phase-0 manifest. | [PHASE0_BOOTSTRAP_AUDIT_SURFACE_MANIFEST.md](resources/PHASE0_BOOTSTRAP_AUDIT_SURFACE_MANIFEST.md) |
| 12 | **Reconcile campaign-global mechanical state** | Update the Security Traceability Graph with source/structural roots, reconcile obligations due in Phase 0, create stable later-phase obligations for unresolved required work, and classify every material observed change under the Evidence Invalidation Matrix. Do not create semantic security conclusions. | [SECURITY_TRACEABILITY_GRAPH.json](../../shared/controller/SECURITY_TRACEABILITY_GRAPH.json) · [CARRIED_FORWARD_OBLIGATION_LEDGER.json](../../shared/controller/CARRIED_FORWARD_OBLIGATION_LEDGER.json) · [EVIDENCE_INVALIDATION_MATRIX.json](../../shared/controller/EVIDENCE_INVALIDATION_MATRIX.json) |
| 13 | **Freeze the Web Bootstrap Completion Report** | File the concise immutable Phase-0 evidence report with every automation/request/run/artifact identity and every required pre-handoff output/status. Mark it `READY_FOR_HANDOFF_CONSTRUCTION`. Do **not** include P0_TO_P1 handoff validation/digests or wake-message hashes in this report; those are Step-14 outputs and must never require rewriting this frozen report. | [PHASE0_WEB_BOOTSTRAP_COMPLETION_REPORT.md](resources/PHASE0_WEB_BOOTSTRAP_COMPLETION_REPORT.md) |
| 14 | **Create and validate P0_TO_P1 successor package and Phase-1 wake message** | Using the already-frozen Step-13 report digest, create and validate `handoffs/P0_TO_P1/SUCCESSOR_HANDOFF.json`, `START_HERE_SUCCESSOR.md`, and the standardized `WAKE_UP_MESSAGE.md` for fresh high-reasoning `reviewer-1`. Never rewrite the frozen Step-13 report after binding its digest. The wake message must identify the current Lite authority, exact Lite campaign name/folder URL, controller workspace, source identity, reviewer-1, and Phase 1 responsibility. | [SUCCESSOR_HANDOFF_PROTOCOL.md](../../shared/handoff/SUCCESSOR_HANDOFF_PROTOCOL.md) · [SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json](../../shared/handoff/SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json) · [WAKE_UP_MESSAGE_TEMPLATE.md](../../shared/handoff/WAKE_UP_MESSAGE_TEMPLATE.md) |

## Post-contract controller validation and retirement

After Steps 1–14 and all Phase-0 sealing criteria are complete:

1. Submit the `audit-phase-completion-report-v1` companion bound to the frozen Step-13 Phase-0 report **and** the independently validated Step-14 P0_TO_P1 package/wake-message evidence, plus output digests, terminal step dispositions, sealing-criterion evidence, campaign generation, actor lineage and exact source identity.
2. The controller runs the completion validator and must generate `PHASE_COMPLETION_VALIDATION_v1.json` with `status: PASS`. The auditor cannot self-certify this result.
3. The retirement gate must then verify the bound completion-validation `PASS`, the required automation-completion `PASS`, and the already-created `P0_TO_P1` handoff-validation `PASS`.
4. If any controller check fails, remain active, repair only the failed prerequisite, regenerate/rebind stale evidence as required, and resubmit validation.
5. Only after the retirement gate reports `PASS` may controller state enter `WAITING_FOR_SUCCESSOR_AGENT`; the web-bootstrap agent then retires.

This order is mandatory: **finish Phase 0 → create/validate P0_TO_P1 + Phase-1 wake message → request machine completion validation → retirement-gate PASS → `WAITING_FOR_SUCCESSOR_AGENT` → retire.**

## Phase-0 semantic prohibition

The web-bootstrap agent may extract and organize neutral facts, but it MUST NOT decide or file authoritative conclusions about:
- protected-asset priority or maximum credible loss;
- trust assumptions or dependency failure significance;
- threat hypotheses or attack feasibility;
- standards applicability/conformance;
- invariant/property correctness;
- candidate validity, finding status or severity;
- remediation adequacy; or
- final security verdict.

Those begin with reviewer-1 in Phase 1 or later authorized reviewers.

## Required work

- Finish all current-infrastructure mechanical preparation in one web-bootstrap session wherever technically possible.
- Trigger **and verify** required existing GitHub/Contract-Automation automation; never leave a merely-started run for reviewer-1.
- Generate the accepted Source Intelligence system in Phase 0 so later reviewers consume rather than reconstruct structural facts.
- Leave exact durable evidence identities for every build/static/automation result.
- File the concise Phase-0 completion report, create and validate `P0_TO_P1` including the standardized Phase-1 wake message, then obtain controller validation `PASS` and retirement-gate `PASS`; only then enter `WAITING_FOR_SUCCESSOR_AGENT` and retire.
