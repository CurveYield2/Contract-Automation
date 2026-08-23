# V7 Execution Infrastructure Qualification v1

V7 technical infrastructure is qualified at the Contract-Automation repository level, outside individual audit campaigns.

A candidate runner release is not admissible to a new campaign until `.github/workflows/v7-execution-infrastructure-qualification-v1.yml` succeeds for the exact candidate commit/ref and its immutable qualification identity is recorded in the Solo Audit Controller admitted execution contract.

The qualification covers V2 request/evidence validation, exact compiler-profile handling, Anvil launch, Anvil-only full simulation policy, requested hardfork compatibility including Cancun, archive RPC identity handling, historical state/target code probes, impersonation/balance control, allowlisted workflow validation, artifact collection, and normalized result generation.

Campaign reviewers MUST consume the admitted qualified release. They MUST NOT repair these repository-level capabilities as ordinary Phase 6/7 audit work. A defect discovered after admission enters the controller's `RUNNER_REPAIR_REBIND` state, preserves the failed attempt, prohibits target-source changes, requalifies the repaired runner, and then rebinds before retry.

The qualification workflow is `workflow_dispatch` only so qualification is an explicit release action rather than a campaign side effect.
