# Phase-0 Simulation Testing Fork Handoff v1

## Scope

This handoff covers the isolated Phase-0 simulation-testing repair for the CurveYield DEX v16 campaign.

Campaign:
- campaign_id: curveyield-dex-v16-source-r1
- campaign_path: campaigns/CurveYield DEX v16 Source r1
- Audit-Controller ref: main

The goal is to repair and validate only deployment simulation, Anvil execution, Medusa randomized testing, and ABI telemetry without rerunning qualification, Phase-0 intelligence, sealing, handoff, reviewer launch, or later audit phases.

## Current repository location

The entire copied/forked implementation has been moved out of repository root into the existing audit-harness hierarchy:

packages/github-native-sim/audit-harnesses/phase0-simulation-testing-v1/

Current contents:
- action.yml
- engine-v1.mjs
- run-v1.mjs
- test-v1.test.mjs
- requests/request-v1.json
- requests/request-v2.json
- requests/request-v3.json
- HANDOFF_v1.md

The only associated file outside that folder is the GitHub Actions discovery wrapper:

.github/workflows/lite-phase0-simulation-testing-v1.yml

That wrapper must remain under .github/workflows so GitHub Actions can discover it.

The previous root-level folder simulation-forks/phase0-simulation-testing-v1/ has been completely removed.

## Canonical simulation files are restored and must remain untouched

The experimental native-deployment changes were accidentally merged into canonical files earlier. Those canonical files have now been restored to their pre-experiment versions:

- .github/workflows/lite-phase0-randomized-simulation-v1.yml
  SHA: ae33aaf370ac2e4de80d3ec4158563a564018a16
- packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs
  SHA: e3afcf83ff6fbb554b0a06f6241f00290ccf7344
- packages/github-native-sim/test/phase0-randomized-simulation-v1.test.mjs
  SHA: 7dea5c2a105405065eb9e3d9f537036d22791105

Do not modify those canonical files while debugging this isolated fork.

## Why the fork exists

The previous canonical fallback tried to reconstruct a very complex deployment graph with regex/static parsing.

For this DEX that produced:
- 32 planned deployments
- 4 successful deployments
- 28 unresolved deployments
- 1 mutable target
- Medusa exit code 6
- 0 Medusa calls

The architectural repair is therefore:

1. Use the deployment script included in the package as the primary deployment executor.
2. Run it against local Anvil.
3. Adapt only local transport/execution requirements.
4. Preserve the script's deployment order, constructor arguments, library linking, nonce sequencing, CREATE-address predictions, configuration transactions, and package-specific logic.
5. Consume the package deployment report as authoritative deployment mapping.
6. Keep the generic parser as fallback only.

## Native package-deployment behavior implemented in the fork

### Anvil signer

The fork generates an ephemeral mnemonic for each run.

It:
1. derives a wallet from that mnemonic;
2. starts Anvil with the same mnemonic;
3. reads eth_accounts[0];
4. verifies that the Anvil account matches the derived wallet;
5. only then provides the verified private key to the temporary package deployment process.

Signer mismatch raises ANVIL_EPHEMERAL_SIGNER_MISMATCH.

### Chain ID

The local simulation runs on Anvil chain ID 1.

The fork creates a temporary copy of the package deployment entrypoint and adjusts only the resolved network object's chainId to 1.

The original campaign source package is never modified.

### Ethereum-fork dependency overrides

The temporary process provides Ethereum-fork-compatible values through explicit environment override points for items such as:
- WETH
- Permit2
- default payout ERC-20
- gas caps

These must remain execution-environment adaptations only and must not change deployment semantics.

### Deployment report

When native package deployment succeeds, the fork reads the package-generated deployment report and uses that report as the authoritative name/address mapping before falling back to bytecode discovery or the generic source-known parser.

## Standalone workflow

Workflow:
.github/workflows/lite-phase0-simulation-testing-v1.yml

Workflow name:
Lite Phase 0 Simulation Testing v1

It supports:
- workflow_dispatch
- request-file push triggers at:
  packages/github-native-sim/audit-harnesses/phase0-simulation-testing-v1/requests/*.json

It invokes the composite action:
./packages/github-native-sim/audit-harnesses/phase0-simulation-testing-v1

The wrapper has been updated for the new folder location.

## Previous request-resolution failure

Run 36698826518 failed before simulation because of malformed shell quoting in the push-request resolver.

That quoting error was repaired.

## First real isolated simulation run

Run:
36699052384

URL:
https://github.com/CurveYield2/Contract-Automation/actions/runs/36699052384

Head SHA:
0f9167cd385df68e1bad684173655f6770be6bcd

Final status:
failure

Important: this run successfully entered and completed the isolated simulation engine. The failure was the final completeness gate, not workflow dispatch.

### What actually happened

The package deployment script was detected and executed through the native adapter:

script:
ops:deploy-curveyield-dex-fresh

entrypoint:
tooling/scripts/deployCurveYieldDexFresh.mjs

temporary adapted entrypoint:
tooling/scripts/.phase0-anvil-deployCurveYieldDexFresh.mjs

localChainId:
1

A verified live-Anvil signer was supplied.

The package script failed immediately in its own preflight with:

Base fee 206241400 exceeds maxFeePerGas 150000000; refusing to send

Therefore native package deployment made no progress and the old fallback parser ran afterward.

Final deployment coverage remained:
- sourcePlanPlanned: 32
- sourcePlanDeployed: 4
- sourcePlanUnresolved: 28
- sourceKnownCompiledTargets: 37
- sourceKnownMissingTargets: 0
- mutableTargets: 1

Medusa:
- status: FAILED
- exit code: 6
- observedCalls: 0

ABI telemetry:
- 4 runs executed
- each reached 1200 calls
- run 1: 54 successes / 1146 reverts
- run 2: 50 successes / 1150 reverts
- run 3: 48 successes / 1152 reverts
- run 4: 56 successes / 1144 reverts

The completeness gate correctly rejected the run.

## Exact next repair #1: gas env names are wrong

The fork currently injects:
- MAX_FEE_PER_GAS
- MAX_PRIORITY_FEE_PER_GAS

The source deployment script actually reads:
- MAX_FEE_PER_GAS_WEI
- MAX_PRIORITY_FEE_PER_GAS_WEI

Specifically:

const MAX_FEE_PER_GAS = envBigInt("MAX_FEE_PER_GAS_WEI", network.maxFeePerGasWei);
const MAX_PRIORITY_FEE_PER_GAS = envBigInt("MAX_PRIORITY_FEE_PER_GAS_WEI", network.maxPriorityFeePerGasWei);

Because the fork used the wrong environment names, the deployment script fell back to the Base network default maxFeePerGasWei of 150000000, which was below the Ethereum fork base fee of 206241400.

Required repair in engine-v1.mjs:
- set MAX_FEE_PER_GAS_WEI instead of MAX_FEE_PER_GAS
- set MAX_PRIORITY_FEE_PER_GAS_WEI instead of MAX_PRIORITY_FEE_PER_GAS
- update the recorded executionOverrides names accordingly
- add a regression assertion for the exact env names

Then create request-v4.json and rerun only Lite Phase 0 Simulation Testing v1.

## Exact next repair #2: retained artifact path is hidden

The diagnostic step successfully read .simulation-testing-output.

However actions/upload-artifact@v4 reported:

No files were found with the provided path: .simulation-testing-output

The directory starts with a dot and upload-artifact defaults to include-hidden-files: false.

Required repair in action.yml:

Under Retain simulation testing output add:

include-hidden-files: true

Do not move completeness enforcement ahead of the upload.

## Next-run procedure

After applying both repairs:

1. Add request-v4.json under:
   packages/github-native-sim/audit-harnesses/phase0-simulation-testing-v1/requests/
2. Let only Lite Phase 0 Simulation Testing v1 run.
3. Do not start the full Phase-0 workflow.
4. Confirm native deployment script exits 0.
5. Confirm its deployment report is detected and consumed.
6. Confirm all expected deployable contracts are represented.
7. Confirm fallback parser is skipped if native deployment is complete.
8. Confirm Medusa status PASS and observedCalls >= 100001.
9. Confirm at least one telemetry run and all telemetry statuses PASS.
10. Confirm the raw .simulation-testing-output artifact is uploaded and downloadable.
11. Only after all above are true should this isolated repair be considered validated.

## Additional validation requirements

### Native deployment safety

Verify that the temporary deployment process:
- connects only to the local Anvil RPC;
- signs only with the verified ephemeral Anvil signer;
- never broadcasts to Base, Katana, or any external RPC;
- preserves source deployment ordering and nonce logic;
- preserves CREATE-address predictions;
- preserves constructor arguments and configuration logic.

### Deployment completeness

The prior 32 planned / 4 deployed state must not be accepted.

Expected success condition:
- no parser-created unresolved dependencies caused by failure to run the package script;
- all intended deployable contracts represented or explicitly classified;
- mutable target set reflects the deployed DEX system.

### Medusa

Required:
- status PASS
- observedCalls >= 100001

If Medusa still exits 6 after full native deployment, diagnose the Medusa harness/configuration separately instead of weakening the gate.

### Telemetry

Required:
- real ABI calls only
- no raw random-byte calls
- cross-contract bursts enabled
- accounting/state-changing action weight >= 80%
- every required telemetry run PASS

## Repository constraints

- Keep all copied/fork implementation files inside:
  packages/github-native-sim/audit-harnesses/phase0-simulation-testing-v1/
- Do not recreate a top-level simulation-forks directory.
- Do not modify the canonical Phase-0 randomized-simulation workflow while debugging.
- Do not modify the canonical randomized-simulation engine while debugging.
- Do not initialize a new audit campaign.
- Do not rerun qualification or Phase-0 intelligence for simulation-only debugging.
- Do not restart sealed/completed audit work.
- Version new request/handoff files by whole-number increments.

## Immediate next action

Patch engine-v1.mjs to use MAX_FEE_PER_GAS_WEI and MAX_PRIORITY_FEE_PER_GAS_WEI.

Patch action.yml to upload the hidden .simulation-testing-output directory with include-hidden-files: true.

Add request-v4.json.

Run only Lite Phase 0 Simulation Testing v1.

Continue from the exact resulting native-deployment failure or success until full deployment, Medusa, and telemetry completeness are achieved.
