# Technical Execution Request Playbook v2

## GitHub Actions Triggering — Mandatory Agent Procedure

Before creating, triggering, retrying, or troubleshooting a GitHub Actions workflow through ChatGPT, read [`GITHUB_ACTIONS_VIA_GITHUB_APP.md`](GITHUB_ACTIONS_VIA_GITHUB_APP.md).

The absence of a direct `workflow_dispatch` / **Run workflow** tool is **not** evidence that GitHub Actions are unavailable. Inspect the workflow's `on:` block and create an authorized matching event through the GitHub connector app. For the canonical V7 execution path, the normal trigger is the request PR/event path defined by the active Contract-Automation workflow, not a manual dispatch.

Do not ask the human to manually run a workflow until the event-trigger procedure and applicable troubleshooting path in the guide have been exhausted or proven unavailable.

## Execution Contract Authority

Operational execution identity is **not hard-coded in this skill packet**. Before constructing any Phase 1/6/7/8/9 technical request, obtain the campaign's admitted execution contract from the Audit Controller and copy its `contractAutomationRelease` and `runnerRelease` exactly.

- Canonical request schema for new work: `deep-assurance-github-request-v2`.
- Canonical operational profiles: `github-native-compile-v2` and `github-native-simulate-v2`.
- `github-native-compile-v1` / `github-native-simulate-v1` and deleted-organization runner identities are **HISTORICAL_PROVENANCE_ONLY / NON_EXECUTABLE**.
- Never substitute `main`, a newer release, an older release, or a remembered commit for the controller-admitted execution contract.
- A runner change after campaign admission requires the formal `RUNNER_REPAIR_REBIND` procedure.

## Required Request Fields

Bind exact campaign, assignment, phase, gate, source repository/40-hex commit/safe project path, runner release, exact compiler descriptors, timeout, analysis configuration, and deterministic request ID/digest. Simulation additionally binds chain, block/fork policy, simulation configuration, and allowlisted workflow.

## Phase Routing

### Phase 1 — neutral reconnaissance

Use `github-native-compile-v2` with exact source inventory/build admission and Slither enabled. Preserve SBOM/provenance and normalized Slither output. Emit `NEUTRAL_SOURCE_RECON_PACKET_v1`. Raw detector observations are non-authoritative.

### Phase 6 — mandatory automated adversarial analysis

Use `github-native-simulate-v2` with the admitted property/harness/action configuration. The controller/card contract is `MEDUSA_THEN_NATIVE_FUZZ_MANDATORY`: Medusa terminal evidence first, native fuzz second. Preserve component failures and coverage without converting them directly into a security verdict.

### Phase 7

Use `github-native-simulate-v2` for the full pinned-fork lifecycle. The currently admitted archive RPC capability is Ethereum only via `SIM_ARCHIVE_PRIMARY_ETHEREUM_01`. A non-Ethereum Phase-7 request MUST remain in `PHASE7_FORK_PREFLIGHT` with `ARCHIVE_RPC_UNAVAILABLE` until the controller admits and repository-qualifies an archive RPC for that chain. Accepted Phase-6 build/analysis evidence may be reused only when exact identity matches.

### Phase 8/9

Use the smallest exact v2 targeted scenario/retest when findings/remediation behavior requires new technical evidence.

## Dispatch

Create exactly one `github-native-sim/requests/<request-id>/request.json` file on the trusted request branch and do not combine it with unrelated repository changes. Validate the atomic request before dynamic source checkout.

## Discovery and Acceptance

Validate classifier/profile selection, workflow run/job identity, exact toolchain, artifact archive and manifest digests, normalized result, source/request binding, `componentStatus`, `failedStepCount`, `completedWithFailedSteps`, analysis component failures, and evidence references. Commit status is navigational only.

A completed normalized `PASSED` result may contain failed steps or analyzer component failures. Preserve those as limitations/evidence; do not automatically turn them into process `FAIL` or security `NO_GO`.
