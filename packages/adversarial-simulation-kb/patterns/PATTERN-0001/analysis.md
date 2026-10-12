# PATTERN-0001 — Collateral reduction without post-action solvency enforcement

## Mechanism

This pattern describes a collateralized-debt system in which an exceptional accounting, reserve-transfer, donation, or equivalent state transition can reduce backing for an account with outstanding debt without enforcing the same post-action solvency condition required by ordinary collateral-reducing paths.

The exploitable shape requires more than an unhealthy state. The attacker must also be able to convert that deliberately created unhealthy state into net value through an attacker-controlled liquidation or equivalent settlement path. Temporary liquidity may amplify the position but is not the root cause.

## Normalized root-cause dimensions

The canonical machine fingerprint is stored in `fingerprint.json`. It captures the v3 dimensions for topology, state-variable class, asset-accounting model, attacker capabilities, trigger, incorrect assumption, violated invariant, extraction mechanism, external dependency role, and primitive references.

## Applicability boundary

Apply this pattern only when source intelligence and/or runtime probes establish both:

1. a target-specific action can materially reduce collateral backing outstanding debt without equivalent post-action health enforcement; and
2. the resulting unhealthy state can be converted into measurable attacker-controlled value through liquidation or settlement economics.

A function name containing terms such as donation, reserve, collateral, or liquidation is never sufficient evidence by itself.

## Historical provenance

`EXP-2023-0001` is the first historical example linked to this generalized mechanism. The pattern intentionally contains no historical protocol name, deployed address, transaction hash, or historical function binding. Those facts remain in the incident record and must not become assumptions when adapting this pattern to another target.

## Proof boundary

K08 proves only that the root-cause representation and generalized pattern are machine-valid, guarded, and linked to the historical incident. It does not prove historical replay, target applicability, generalized exploitability, or qualification. Those require later recipe, executable, matcher, and reproduction modules.
