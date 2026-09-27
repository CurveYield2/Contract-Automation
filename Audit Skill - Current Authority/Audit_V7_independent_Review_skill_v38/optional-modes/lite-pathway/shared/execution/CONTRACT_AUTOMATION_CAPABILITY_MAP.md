# Lite Contract Automation Capability Map

Use only capabilities needed for retained Lite execution:

| Capability | Lite use | Required evidence |
|---|---|---|
| Exact build/compile | build admission or repair after identity change | source/toolchain/config command and artifact identities |
| Deploy/config simulation | complete release deployment and wiring | ordered actions, inputs, roles/config, assertions, traces/results |
| Deterministic simulation | candidate-specific proof or disproof | exact setup, actors, sequence, oracle and result |
| Basic targeted fuzzing | bounded candidate-relevant input variation | generator bounds, oracle, run identity, minimized counterexample/result |
| Neutral static analysis | Phase-1 structural reconnaissance only | exact tool version, findings/limitations, source identity |

Do not request broad/stateful random discovery, chaos, Medusa, mutation, differential/reference, corpus/deep, exhaustive known-attack or coverage-closure capabilities in Lite mode.
