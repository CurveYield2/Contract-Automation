# Phase 6 Known/Historical Attack Disposition — Exact Fill Template

## Mode
- Historical Exploit KB: `QUALIFIED_AVAILABLE | AVAILABLE_NOT_QUALIFIED | UNAVAILABLE_USE_MANUAL_FALLBACK`
- KB query/result refs when qualified:

When the qualified KB is unavailable, this built-in checklist is the mandatory transitional fallback. It is a **minimum taxonomy, not a claim of exhaustive historical coverage**.

## Attack-family disposition

Use `EXECUTE_ADAPTED_ATTACK | TARGETED_REVIEW_AND_TEST | NOT_APPLICABLE_WITH_EVIDENCE | PHASE7_RUNTIME_REQUIRED | TYPED_LIMITATION`.

| Family | Applicability signal / exact source refs | Disposition | Attack/campaign/reproduction ID | Evidence / reason |
|---|---|---|---|---|
| Reentrancy / callback / read-only reentrancy | | | | |
| Access control / role escalation / initialization | | | | |
| Upgrade/proxy/storage collision | | | | |
| Donation / share-price / first-depositor inflation | | | | |
| Rounding / precision / repeated dust extraction | | | | |
| Reward-index / reward-debt / checkpoint ordering | | | | |
| Debt/interest/solvency/liquidation accounting | | | | |
| Oracle / price manipulation / stale price | | | | |
| Flash-liquidity amplified state manipulation | | | | |
| Direct balance vs internal accounting desync | | | | |
| Fee/tax/withdraw/performance accounting | | | | |
| Token quirks: fee-on-transfer/rebase/callback/nonstandard | | | | |
| Signature / permit / replay / authorization domain | | | | |
| AMM/pool index/orientation/slippage/sandwich-sensitive state | | | | |
| Governance / voting / flash influence | | | | |
| Cross-chain message/replay/finality | | | | |
| External dependency / keeper / off-chain automation | | | | |
| DoS / grief / gas / state-locking | | | | |

## Non-substitution proof
- Broad fuzzing does not satisfy this checklist: YES/NO
- Randomized accounting chaos is separately planned: YES/NO
- Runtime-only attacks carried to Phase 7 with OBL-* IDs:
