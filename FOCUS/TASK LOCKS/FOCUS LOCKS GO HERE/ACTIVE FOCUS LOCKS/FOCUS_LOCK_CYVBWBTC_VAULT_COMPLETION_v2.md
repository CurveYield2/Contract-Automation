# Focus Lock — cyvbWBTC Vault Completion v2

## END-STATE INVARIANT

Complete the remaining cyvbWBTC vault work without repeating closed work:

1. identify and bind the vault to the correct live Katana f(x) stack for Katana fxUSD `0x4c03ff0f44A55e7098a09016E02a01d3cdC2FDF9`;
2. preserve all already-verified cyvbWBTC fee, accounting, LTV, gateway, and IPOR integration behavior unless new live evidence proves one is broken;
3. configure the CurveYield router only inside the isolated Katana Anvil simulation, through the owner Safe, for both `fxUSD -> vbUSDC` and `vbUSDC -> fxUSD`, using Sushi pool `0x2d43e7931329dbb709f33d7049c937c6794bae10`, with global/admin fee 0 and per-route fee 0;
4. use only the Katana-network-specific simulator added in Contract-Automation for this work; do not modify any pre-existing primary simulation workflow without explicit human permission;
5. finish compile, focused tests, deployment validation, and end-to-end Katana Anvil lifecycle simulation on the corrected candidate;
6. stop only when the corrected candidate is verified and no implementation delta remains.

## CURRENT MAIN

- Smart-Contracts main last checked: `314a4e7fb1f4119b55c8a90f05c4513e9adb2ca4`
- Contract-Automation main last checked: `039b14b7e3f6f78f7062a0542438cef303d7c8a3`

## AUTHORITY

- Focus/task-lock protocol: `FOCUS/TASK LOCKS/TASK_LOCK_PROTOCOL_v1.md`
- Focus-lock precedent: `FOCUS/TASK LOCKS/FOCUS LOCKS GO HERE/RETIRED FOCUS LOCKS/FOCUS_LOCK_UPGRADE_AGENT_LAUNCHER_IMPLEMENTATION_v1.md`
- Explicit human instructions in the active cyvbWBTC task are controlling for the remaining implementation details.
- Live repository state outranks stale handoffs or predecessor summaries.

## SATISFIED

- Stale handoff was discarded; live repository state is the working authority.
- cyvbWBTC onboarding fee behavior was corrected so the 0.55% onboarding fee remains in the vault and increases PPS.
- cyvbWBTC non-final instant-exit fee behavior was corrected so the 0.35% fee remains in the vault and increases PPS.
- Final-share exit handling was added so no fee assets are stranded after total supply reaches zero.
- cyvbWBTC accounting was moved from custom market ID `7001` to official IPOR ERC20 vault-balance market ID `7`.
- Gateway/pre-hook enforcement and configurable LTV work are already implemented and must not be redesigned without contrary live evidence.
- Fresh f(x) capital deployment was changed from collateral-only initialization to atomic collateral + target-debt opening.
- Focused cyvbWBTC tests reached 7/7 PASS.
- Solidity compilation passed on the last verified candidate before the wrong-Katana-fxUSD stack issue was isolated.
- Live Katana topology/preflight checks passed for the previously tested candidate.
- Correct Katana fxUSD is identified as `0x4c03ff0f44A55e7098a09016E02a01d3cdC2FDF9`.
- Correct Katana fxUSD PoolManager is identified as `0x27b3eE81DF2Dd7356D5ac282e2416991A616f96a`.
- Correct Katana fxBASE is identified as `0xdE2E0736Ee813C425b0eE1a6e0627233B3B1EeF8`.
- Correct Katana PoolManager configuration is identified as `0x1aB308fc322b1f24f5615D70A40453D81184667A`.
- Sushi V3 pool `0x2d43e7931329dbb709f33d7049c937c6794bae10` is confirmed as the intended Katana `vbUSDC / 0x4c03...FDF9 fxUSD` pool at fee tier 100 (0.01%).
- CurveYield router `0x01F9894f92ea9224fECc8C35482E20a05De13582` is confirmed Safe-owned by `0x47623C62f281807D615eeb4A2CEee9d97F9D3C49`; Safe threshold is 1.
- Router write ABI has been identified: `setRoute(address,address,bytes)`, `setRouteFeeBps(address,address,uint16)`, and `setRouteTwapGuard(address,address,uint32,uint16)`.
- No production route writes or production vault transactions have been made.
- No pre-existing primary Contract-Automation simulation workflow was modified by this cyvbWBTC effort.
- The earlier generic cyvbWBTC Contract-Automation simulator files were removed in favor of a Katana-network-specific simulator path.
- Duplicate Katana simulator versions v1-v7 and obsolete cyvbWBTC direct-Anvil/result artifacts were removed; the current Katana-specific simulator is v8.
- Live Katana fxUSD `getMarkets()` returned an empty array, so the prior assumption that this getter would directly identify the vbWBTC market is closed as false.

## REMAINING DELTA

1. Identify the exact live Katana vbWBTC f(x) market using the confirmed Katana PoolManager / market registration state or another authoritative live read, because `fxUSD.getMarkets()` returned `[]`.
2. Update only the stale f(x)/fxUSD-related addresses or configuration in the current cyvbWBTC production candidate. Do not reopen satisfied fee, gateway, accounting, or LTV work unless live verification disproves it.
3. In the isolated Katana Anvil simulator only, configure the router through the owner Safe:
   - `fxUSD -> vbUSDC` using pool `0x2d43e7931329dbb709f33d7049c937c6794bae10`;
   - `vbUSDC -> fxUSD` using the same pool in reverse;
   - global/admin fee = 0;
   - per-route fee = 0;
   - use the exact current router write ABI/input encoding.
4. Run the corrected cyvbWBTC lifecycle simulation on a Katana Anvil fork.
5. Repair only failures that directly prevent that lifecycle from passing.
6. Re-run compile, focused tests, deployment validation, and the Katana-specific lifecycle simulation against the final candidate.
7. Mark the task complete only when all required verification passes and the remaining delta is empty.

## PARKED OBSERVATIONS

- Repository-wide cleanup or organization unrelated to cyvbWBTC completion.
- Generic simulation-framework redesign.
- Changes to any pre-existing primary Contract-Automation simulation workflow.
- Audit automation work.
- Additional router or protocol modernization not required by the cyvbWBTC lifecycle.
- Historical intermediate cyvbWBTC workflow/version cleanup unless it directly interferes with final verification.

## ACTIVE BLOCKER

The exact vbWBTC f(x) market address belonging to the confirmed Katana fxUSD / PoolManager stack is still unresolved; `fxUSD.getMarkets()` returned `[]`, so the market must be resolved from authoritative PoolManager/market registration state instead.

## NEXT ACTION

Resolve the exact vbWBTC f(x) market from authoritative live PoolManager / market-registration state for PoolManager `0x27b3eE81DF2Dd7356D5ac282e2416991A616f96a`, and verify that its collateral is vbWBTC `0x0913DA6Da4b42f538B445599b46Bb4622342Cf52` and its fxUSD is `0x4c03ff0f44A55e7098a09016E02a01d3cdC2FDF9`. Record that address once. Do not repeat router, Safe, Sushi-pool, fee, gateway, market-ID, or prior test discovery.

## ANTI-DRIFT CHECK

Before every meaningful action answer:

`Which REMAINING DELTA item does this action eliminate or verify?`

If the answer is none, do not perform the action.

Hard prohibitions while this lock is active:

- Do not repeat a SATISFIED investigation unless new live evidence directly contradicts it.
- Do not create parallel implementation paths.
- Do not create another generic simulator.
- Do not modify an existing primary simulation workflow without explicit human permission.
- Do not restart completed cyvbWBTC design work.
- Do not treat a harness failure as authorization to rediscover already-verified protocol facts.
