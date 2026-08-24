# Historical Exploit + Adversarial Simulation KB — Current Status v1

Generated from `DEVELOPMENT_RECOVERY_STATE_v1.json`. Do not edit this projection independently.

- Repository: `CurveYield2/Contract-Automation`
- Branch: `feat/adversarial-simulation-kb-v1`
- Pull request: 131
- Baseline main SHA: `468b749076fb5b9c166c14a187fdd29a6f967acd`
- Last known good commit: `874e49e78f0840ebb6e6fe1d8e3a76de6c21101b`
- Overall status: **IN_PROGRESS**
- Current module: **K13 — Historical Reproduction Path**
- Current step: **K13-S01 / IN_PROGRESS**
- Last completed step: K12-S07

## Last hard gate

K12 PASS. Final KB qualification run `32709590393` at candidate `3f08213fc9b4ff8f9258024cbbf1c55c2921e5b7` passed 63/63 tests and the repository secret/RPC-literal gate. Authoritative protected RED run `32708299604` failed exactly at Forge `[FAIL: SOLVENCY]` with `HARD_FAILURE / FAILED / STOP_EXECUTION`; authoritative vulnerable GREEN run `32708603994` passed 1/1 Foundry assertion and recorded health `20000 -> 14000` bps, attacker net value `100 -> 110`, and protocol liquidity `1000 -> 890`.

`EXEC-0001` is now bound to the exact `PATTERN-0001` and `RECIPE-0001` revisions/digests, exact controlled fixture source digests, Forge 1.7.1, and `PROOF-0003` at tier `CONTROLLED_REPRODUCTION`. `EXP-2023-0001` and `RECIPE-0001` remain `SCHEMA_VALID`; K12 does **not** claim historical reproduction or production-target exploitability.

During K12, canonical V7 evidence exposed a Forge-wrapper false-positive where failed Forge output could be returned with process exit code 0. PR #144 added a RED regression, repaired `native-fuzz.mjs` to fail closed on explicit Forge failed-suite output, passed canonical qualification run `32708011530`, and merged to `main` as `bb8637f31b891b5b995019dbc09db5a4f5107b33` before K12 RED/GREEN evidence was accepted.

## Next exact action

Inspect the K13 GREEN plan qualification. If it passes, add the exact historical executable/proof artifacts and bind them to canonical archive/Anvil preflight before requesting historical execution.

## Open blockers

- None
