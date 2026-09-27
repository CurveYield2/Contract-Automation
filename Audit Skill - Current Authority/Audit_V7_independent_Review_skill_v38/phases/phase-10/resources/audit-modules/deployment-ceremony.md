<!--M:deployment-ceremony:f11cfcaed06b20eec4269ff53071f30db954f4d75ff4da0291fab3b5a45b9244-->
### `deployment-ceremony`
Trigger: Use when preparing the exact release candidate, ownership transfer, initialization, configuration, verification, or launch decision

## Objective

Bind the audited source and accepted configuration to the release manifest.

## Review Contract

- Freeze exact commit, compiler configuration, constructor and initializer inputs, addresses, chains, and ownership targets.
- Review deployment order, role transfer, timelocks, post-deploy checks, and rollback.
- Reject release drift from the audited source or configuration.
- Do not sign or broadcast transactions from browser audit sessions.


## Required Output

An exact release manifest and deployment-ceremony checklist.

## Conditional Live Deployment Attestation

`LIVE_DEPLOYMENT_ATTESTATION_REQUIRED` applies when the frozen campaign manifest says `deploymentMode: LIVE_DEPLOYED` or `MIXED`. Create the live-deployment release attestation directly under the requirements in `shared/policy/ASSURANCE_PRECISION_CONTROLS.md`; no separate legacy auxiliary-template library is required.

Compare each in-scope deployed runtime/proxy/implementation identity to the exact audited release and capture only security-critical configuration identified by the accepted authority graph/threat model. A runtime/source mismatch requires source revision/rerun rather than a claim that the deployed code was audited. `UNATTESTABLE` after recovery exhaustion is a process failure. For `PRE_DEPLOYMENT`, do not create this artifact.
