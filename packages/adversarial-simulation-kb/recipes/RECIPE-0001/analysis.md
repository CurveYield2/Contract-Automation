# RECIPE-0001 — Collateral-solvency bypass adaptation recipe

## Purpose

Translate `PATTERN-0001` into target-bound actions without carrying historical protocol names, deployed addresses, transaction hashes, or historical function names into the reusable recipe.

## Binding contract

The recipe requires eight explicit bindings: target, collateral asset, debt asset, position-setup action, exceptional collateral-reduction action, health metric, liquidation action, and attacker net-value observation. The binding engine reports `BLOCKED` whenever any required binding is unresolved and refuses partial instantiation.

## Mechanical adaptation only

Instantiation performs declarative placeholder replacement. It does not execute arbitrary code, infer a missing target function, decide that a pattern is applicable, assign severity, or convert an assertion failure into a finding. Those judgments remain outside the global recipe.

## Security properties carried from the pattern

The two reusable assertions are:

- collateral reduction against a debt-bearing account must preserve required solvency/health or revert before unsafe state is committed; and
- inconsistent collateral-accounting enforcement must not enable a net-profitable attacker-controlled liquidation sequence.

These properties are already present in `PATTERN-0001`; K09 does not invent a new target-specific invariant.

## Backend boundary

Foundry and Anvil are declared supported because the recipe is deterministic and lifecycle-oriented. Medusa is `ADAPTATION_REQUIRED`; K09 does not create a new Medusa runner or bypass the canonical V7 harness infrastructure.

## Proof boundary

`PROOF-0002` is only `SCHEMA_VALID`. Compilation, controlled execution, historical replay, generalized second-fixture proof, and qualification remain later module obligations.
