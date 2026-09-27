<!--M:threat-model-attack-trees:4028e9fd370ee5bceaf652e4e749a4f145b7c67fbf5b3cbd196fe4f35ebb8623-->
### `threat-model-attack-trees`
Trigger: Use when mapping attack surfaces, trust boundaries, privilege paths, callbacks, integrations, or adversarial sequences

## Objective

Use the accepted Source Intelligence plus sealed Phase-3 threat model as the structural/semantic baseline. Re-evaluate only the candidate-relevant trust/attack path and contradictions; do not regenerate the raw architecture inventories from scratch.

## Review Contract

- Map custody, authority, accounting, data, callback, upgrade, and dependency flows.
- Create attack trees for theft, insolvency, permanent lock, privilege escalation, price manipulation, griefing, and liveness loss.
- Identify preconditions, observables, mitigations, and residual risk for each path.
- Seal the clean-room result before viewing prior findings.

## Required Output

An architecture map, authority graph, threat model, and attack-tree bundle.
