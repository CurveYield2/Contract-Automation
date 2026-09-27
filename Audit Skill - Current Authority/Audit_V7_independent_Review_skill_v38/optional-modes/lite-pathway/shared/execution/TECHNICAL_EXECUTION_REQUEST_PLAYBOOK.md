# Lite Technical Execution Request Playbook

Each request records:

- campaign/generation/workspace path;
- exact source/build/toolchain/configuration identity;
- retained action: `BUILD`, `DEPLOY_CONFIG_SIMULATION`, `CANDIDATE_DETERMINISTIC_SIMULATION`, or `BASIC_TARGETED_FUZZ`;
- candidate/property/hypothesis IDs and exact oracle;
- environment/fork identity and non-secret inputs;
- bounded parameters, limits and expected evidence outputs.

Preserve request/job/run/artifact/result identities and component failures. A runner result never decides finding severity by itself.

For targeted fuzzing, constrain the request to one or more already identified material candidates and their immediate relevant boundaries. Broad exploration, stateful random campaigns, chaos, Medusa, mutation, differential/reference, corpus/deep, known-attack sweeps and coverage-guided closure are not valid Lite request types.
