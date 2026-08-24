# Historical Exploit + Adversarial Simulation KB — Current Status v1

Generated from `DEVELOPMENT_RECOVERY_STATE_v1.json`. Do not edit this projection independently.

- Repository: `CurveYield2/Contract-Automation`
- Branch: `feat/adversarial-simulation-kb-v1`
- Pull request: 131
- Baseline main SHA: `468b749076fb5b9c166c14a187fdd29a6f967acd`
- Last known good commit: `e17a878294ad1d616f60fe5b18f131432883a921`
- Overall status: **IN_PROGRESS**
- Current module: **K10 — Proof Model / Qualification State Machine**
- Current step: **K10-S01 / READY**
- Last completed step: K09-S07

## Last hard gate

K09 PASS on canonical GitHub run `32700421415` at source commit `e17a878294ad1d616f60fe5b18f131432883a921`: 46 tests passed, 0 failed; secret/RPC-literal gate PASS. `RECIPE-0001` is generalized, uses eight explicit target bindings, blocks incomplete instances, mechanically resolves complete bindings, rejects undeclared placeholders and literal onchain identities, and remains only `SCHEMA_VALID` through `PROOF-0002`.

## Next exact action

Write failing K10 proof state-machine tests, then implement exact proof tiers and allowed advancement, evidence/run requirements, executable-change requalification, `REFERENCE_ONLY` scheduling rejection, and fail-closed manual `QUALIFIED` prevention.

## Open blockers

- None
