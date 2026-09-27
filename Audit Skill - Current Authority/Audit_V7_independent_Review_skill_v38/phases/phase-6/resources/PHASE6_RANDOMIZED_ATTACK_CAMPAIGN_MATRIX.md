# Phase 6 Randomized Accounting Attack Campaign Matrix — Exact Fill Template

## Target-bound action vocabulary

Only include reachable actions; bind each to exact function/interface/source refs.

| Action class | Exact target binding | Actors | Preconditions | Value classes | Enabled |
|---|---|---|---|---|---|
| DEPOSIT | | | | | |
| WITHDRAW/REDEEM | | | | | |
| STAKE/UNSTAKE | | | | | |
| CLAIM/HARVEST | | | | | |
| BORROW/REPAY/LIQUIDATE | | | | | |
| DONATE/DIRECT_TOKEN_TRANSFER | | | | | |
| TRANSFER_SHARES/RECEIPT | | | | | |
| CHECKPOINT/SYNC | | | | | |
| ADVANCE_TIME/BLOCKS | | | | | |
| PRICE/ORACLE_PERTURB | | | | | |
| FLASH_LIQUIDITY | | | | | |
| CALLBACK/EXTERNAL_SYNC | | | | | |
| EMERGENCY/PAUSE/ROLE CHANGE | | | | | |

## Required motif dispositions

Use `EXECUTE | NOT_APPLICABLE_WITH_EVIDENCE | CARRY_TO_PHASE7_RUNTIME_ONLY`.

| Motif | Disposition | Target-bound sequence family | Invariants checked during sequence | Engine/campaign ID |
|---|---|---|---|---|
| DONATION_THEN_CONVERT | | | | |
| ROUND_TRIP_EXTRACTION | | | | |
| MULTI_USER_ORDERING | | | | |
| CLAIM_TRANSFER_CLAIM | | | | |
| CHECKPOINT_REORDER | | | | |
| TIME_BOUNDARY_ACCRUAL | | | | |
| PARTIAL_FULL_WITHDRAW_ORDERING | | | | |
| REPEATED_DUST_CAPTURE | | | | |
| FEE_BOUNDARY_CYCLE | | | | |
| BORROW_PERTURB_LIQUIDATE | | | | |
| PRICE_PERTURB_ACCOUNTING_ACTION | | | | |
| FLASH_STATE_PERTURB_UNWIND | | | | |
| REWARD_NOTIFY_STAKE_CLAIM_ORDERING | | | | |
| DIRECT_TRANSFER_SYNC_DESYNC | | | | |
| EMERGENCY_NORMAL_PATH_INTERLEAVE | | | | |
| ROLE_CHANGE_ACCOUNTING_ACTION | | | | |

## Diversity requirements
- Actor permutations:
- Random + boundary-biased value classes:
- Sequence depths/repetition counts:
- Time/block deltas:
- Valid-flow mode setup strategy:
- Hostile-input mode strategy:
- Meaningful-state-change metric:
- Revert/discard metric and repair threshold:
- Corpus/seeds preserved at:
