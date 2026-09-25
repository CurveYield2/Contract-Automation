# Historical Exploit + Adversarial Simulation KB — Recovery Start Here v1

This repository state is the handoff. Do not restart completed modules from chat history.

1. Open the active PR for branch `feat/adversarial-simulation-kb-v1`.
2. Read `DEVELOPMENT_RECOVERY_STATE_v1.json` first; it is the machine source of truth.
3. Verify the branch, PR, current GitHub head, `baselineMainSha`, and `lastKnownGoodCommit`.
4. Read `CURRENT_STATUS_v1.md`, then new entries in `DECISION_LOG_v1.md`.
5. Read `TEST_AND_PROOF_INDEX_v1.json` for the current module.
6. Inspect `activeExternalRun` if non-null.
7. Verify `nextExactAction` is still valid against GitHub state.
8. Resume from the recorded exact step. Do not restart completed modules or rerun passing qualification only to reconstruct context.

## Project identity

- Project: `HISTORICAL_EXPLOIT_ADVERSARIAL_SIMULATION_KB`
- Plan: v3
- Primary repository: `CurveYield2/Contract-Automation`
- Working branch: `feat/adversarial-simulation-kb-v1`
- Baseline main SHA: `468b749076fb5b9c166c14a187fdd29a6f967acd`

## Authority boundaries

The KB is reusable public technical execution content. Campaign-specific adaptation/security judgment remains in the controller/campaign evidence plane. Never place private campaign source, secrets, private keys, mnemonic phrases, or literal RPC URLs in this global KB.
