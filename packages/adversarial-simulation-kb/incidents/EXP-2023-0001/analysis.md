# EXP-2023-0001 — Euler V1 donateToReserves solvency-check exploit

## Verification status

**VERIFIED historical incident.** This status means the incident facts and root-cause basis are supported by primary protocol, primary onchain, and primary security-report evidence. It does **not** mean the historical exploit has already been reproduced by this KB.

## Source-bound factual core

Euler's own historical account states that Euler V1 was exploited on 13 March 2023 for approximately $197M and identifies the critical issue as the absence of an account health check in `donateToReserves`. Euler further explains that the attacker used that omission to donate collateral, deliberately become eligible for liquidation, and self-liquidate to capture a liquidation bonus greater than the donation loss. See `SOURCE-0001`.

Euler's account links the first exploit transaction directly. `SOURCE-0002` preserves that transaction as `0xc310a0affe2169d1f6feec1c63dbc7f7c62a887fa48795d327d4d2da2d6b111d`; onchain explorer evidence records it on Ethereum at block `16817996` at `2023-03-13T08:50:59Z`. The transaction uses a 30M DAI Aave V2 flash loan and is the representative DAI exploit anchor for later historical reproduction work.

Omniscia's incident postmortem independently attributes the vulnerability to donations being possible without a proper account health check and ties the flaw to the `donateToReserves` change introduced through eIP-14. See `SOURCE-0003`.

`SOURCE-0004` preserves verified deployed source for the Euler V1 main protocol contract at `0x27182842E098f60e3D576794A5bFFb0777E025d3`. Euler V1 is modular, so this address is recorded as the stable affected protocol anchor rather than as a claim that every vulnerable implementation line lives in that one source file.

## Mechanism decomposition

1. Temporary liquidity lets the attacker establish a large leveraged Euler position.
2. The attacker uses `donateToReserves` to reduce collateral supporting outstanding debt.
3. The vulnerable path does not reject the resulting unhealthy account with the required solvency/health check.
4. A second attacker-controlled account liquidates the deliberately unhealthy account.
5. The liquidation incentive exceeds the economic loss from the donation, creating attacker profit redeemable against real Euler liquidity.
6. The broader incident repeats the exploit shape across multiple assets/transactions.

## Primitive classification

- `FLASH_LIQUIDITY` — amplifies the position and supplies temporary attack capital.
- `DONATION` — the direct state transition used to remove collateral value.
- `ACCOUNTING_DESYNC` — collateral/debt economic state can be driven into an exploitable mismatch across the donation/liquidation sequence.
- `SOLVENCY_BYPASS` — the critical collateral-reducing path lacks the health enforcement that should prevent committing an unhealthy state.
- `COLLATERAL_MANIPULATION` — the attacker intentionally manipulates collateral backing its own debt to enter liquidation.

`FLASH_LIQUIDITY` is an enabling capability, not the root cause. The root cause remains the missing health enforcement on the relevant donation path combined with liquidation economics.

## False-positive boundary

A target is not matched merely because it has a donation function, reserves, leverage, or liquidations. Later generalized matching must prove that the candidate collateral-reducing path can affect debt-bearing account health without equivalent solvency enforcement and that an attacker-controlled liquidation can produce net extractable value.

## Current proof boundary

At K07 this incident may reach `SCHEMA_VALID` knowledge proof only. Historical fork replay, reproduced economic effect, generalized pattern proof, and `QUALIFIED` status remain separate later obligations. The representative DAI transaction must not be treated as the complete multi-asset incident.
