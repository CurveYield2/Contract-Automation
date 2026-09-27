# Deep Assurance v6 Severity Calibration v2

## Purpose

Severity is based on the **maximum credible economic impact and operational blast radius** reachable under production conditions. Economic severity MUST be calibrated against the total deposited funds of the affected contract/system and, where strategy yield is implicated, against the annual strategy yield generated from those deposits. The existence of stranded value, cross-user value transfer, an accounting discrepancy, or technically capturable value does not by itself establish Medium severity.

The quantitative thresholds below are authoritative for economic findings. Apply the **highest severity threshold reached by the maximum credible production impact**: **Critical overrides High; High overrides Medium; Medium overrides Low/Informational.** Do not down-grade an issue merely because exploitation is difficult when the maximum credible impact satisfies a higher threshold; record likelihood and constraints separately.

## Quantitative Severity Thresholds

### Critical

An issue is **Critical** when a reachable event or exploit could result in **total or near-total loss of deposited value** in the affected contract/system. This includes conditions capable of destroying, stealing, irrecoverably diverting, or otherwise eliminating all or nearly all economic value represented by deposited funds.

Critical takes precedence over every lower severity even when the same condition also satisfies the High threshold.

### High

An issue is **High** when the maximum credible production impact can cause **5% or more of the total deposited funds in the affected contract/system** to be **lost, exploited, stolen, irrecoverably diverted, or stranded/frozen**.

If the same issue can cause total or near-total loss of deposited value, grade it **Critical**, not High.

### Medium

For economic findings, **material** means the maximum credible production impact has the potential to cause **at least one** of the following:

1. loss, exploitation, theft, irreversible diversion, dilution, misallocation, or stranding/freezing of **at least 0.5% of the total deposited funds in the affected contract/system**; or
2. loss, exploitation, theft, irreversible diversion, dilution, misallocation, or stranding/freezing of value equal to **at least 5% of the annual strategy yield generated from deposits** in the affected strategy/system.

An economic issue satisfying either materiality test is **at least Medium**, unless it meets the High or Critical threshold above. Therefore, absent Critical conditions, an issue exposing **0.5% or more but less than 5% of total deposited funds** is Medium when no higher threshold is reached. A yield-only issue that reaches **5% or more of annual strategy yield** is Medium unless its effect on deposited funds independently reaches High or Critical.

### Low

A concrete economic, ownership, accounting, reward-allocation, or minor correctness defect is **Low at most** when its maximum credible production impact remains **below both Medium materiality thresholds** — less than **0.5% of total deposited funds** and less than **5% of annual strategy yield generated from deposits** — and it does not independently create a High or Critical outcome.

Use **Low** when the defect causes real but quantitatively sub-material user/protocol harm. Use **Informational / Note** when the effect is economically negligible and does not create meaningful user harm.

## Measurement and Denominator Rules

For severity calibration:

- **Total deposited funds** means the aggregate economic value of funds deposited in the affected contract or directly affected system at the credible production state used for the impact analysis. Use the narrowest defensible affected contract/system denominator; do not inflate the denominator with unrelated protocol assets.
- **Annual strategy yield generated from deposits** means the economic value of strategy yield reasonably expected to be generated over one year by the affected deposits under the evidence-backed production baseline used by the audit. This is a value denominator, not merely the quoted APY percentage.
- Use the **maximum credible production exposure**, not an intentionally tiny proof-of-concept fixture, synthetic dust balance, or arbitrary test balance.
- When current TVL or annual-yield values fluctuate, record the evidence-backed value/range used and show the severity calculation against that value/range.
- If an exploit can be repeated or accumulated, measure the maximum credible aggregate impact under realistic production conditions rather than only a single iteration.
- If an issue affects only a subset of contracts or deposits, use the funds of the actually affected contract/system as the denominator and document why that scope is correct.

## Bounded Economically Immaterial Loss Rule

A value-loss, residue, reward-allocation, rounding, dust, or cross-user capture condition is **Low at most** when executable evidence or a hard code/economic bound establishes all of the following:

- user principal remains safe and the condition does not create insolvency, undercollateralization, unauthorized minting, or loss of core protocol control;
- the maximum credible affected value remains below **0.5% of total deposited funds** in the affected contract/system;
- where strategy yield is affected, the maximum credible affected yield remains below **5% of annual strategy yield generated from deposits**;
- the exposure is bounded to a narrow transient value slice, such as a single harvest interval of ordinary yield, a bounded fee interval, or similarly limited non-principal accrual;
- the condition does not create a practical path to scale or accumulate into a Medium, High, or Critical threshold under realistic production conditions; and
- it does not otherwise cause 5% or more of deposited funds to be stranded/frozen or total/near-total loss of deposited value.

When these conditions hold, use **Low** when there is a concrete ownership, accounting, or minor economic correctness defect. Use **Informational / Note** when the effect is economically negligible and does not create meaningful user harm. A condition satisfying this rule **must not be graded Medium solely because value is stranded, later recaptured, inherited by another depositor, or otherwise transferred to a different user** when the quantified exposure remains below the Medium thresholds.

**Cross-user capture alone does not make an issue Medium.** Capture establishes a correctness/ownership defect; severity still depends on the maximum credible amount of value exposed under the quantitative thresholds above.

## Medium Economic Materiality Floor

The explicit Medium economic materiality floor is:

Operational inconvenience, deployment difficulty, release-process failure, or deployment-script defects without economic/security impact do not satisfy Medium severity and do not independently create security NO_GO.

- **at least 0.5% of total deposited contract/system funds**, or
- **at least 5% of annual strategy yield generated from deposits**.

If neither threshold can be reached under maximum credible production conditions, the reviewer MUST NOT assign Medium solely because a nonzero amount can be lost, stranded, recaptured, inherited, or reassigned.

A large percentage inside an intentionally tiny proof-of-concept fixture does not establish Medium severity. Likewise, an absolute token amount such as 100 reward tokens does not establish Medium severity without showing that the amount reaches one of the quantitative thresholds against the real affected production denominator.

## True De Minimis Dust

Strictly bounded token-base-unit dust or value below practical recovery/exchange cost remains **normally Informational / Note** and **at most Low**. The broader bounded-economic-loss rule above also covers non-dust amounts that remain below both Medium materiality thresholds.

## Economic Review Requirement

For every economic finding, record:

- maximum credible affected value and the evidence for that bound;
- total deposited funds in the affected contract/system and the resulting affected percentage;
- annual strategy yield generated from deposits when yield is implicated and the resulting affected percentage of annual yield;
- whether principal or solvency is affected;
- whether the impact can accumulate or scale across the 0.5% Medium, 5% High, or total/near-total Critical thresholds;
- whether another actor can capture the value, while explicitly treating capture as a correctness factor rather than an automatic severity escalator;
- whether deposited value can be stranded/frozen and what percentage of total deposited funds can be affected;
- whether the condition can cause total or near-total loss of deposited value; and
- the resulting severity classification with explicit threshold calculation and rationale.

If a reviewer cannot establish that an economic issue reaches **0.5% of total deposited funds** or **5% of annual strategy yield generated from deposits**, the reviewer MUST NOT assign Medium on economic-materiality grounds. If the issue can affect **5% or more of deposited funds**, it MUST be at least High. If it can cause **total or near-total loss of deposited value**, it MUST be Critical.
