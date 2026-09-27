<!--M:threat-model-attack-trees:4028e9fd370ee5bceaf652e4e749a4f145b7c67fbf5b3cbd196fe4f35ebb8623-->
### `threat-model-attack-trees`
Trigger: Use when mapping attack surfaces, trust boundaries, privilege paths, callbacks, integrations, or adversarial sequences

## Objective

Use the accepted Phase-1 Source Intelligence structural maps as the architecture baseline, then generate the **semantic** architecture/trust model and attack trees that drive manual and technical review. Do not recreate raw contract/function/inheritance/call/interface inventories.

## Review Contract

- Map custody, authority, accounting, data, callback, upgrade, and dependency flows.
- Create attack trees for theft, insolvency, permanent lock, privilege escalation, price manipulation, griefing, and liveness loss.
- Identify preconditions, observables, mitigations, and residual risk for each path.
- Seal the clean-room result before viewing prior findings.

## Required Output

An architecture map, authority graph, threat model, and attack-tree bundle.
