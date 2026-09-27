# Lite Execution Preflight and Repair

Before retained technical execution, bind exact source, dependency lock, compiler/toolchain, configuration, deployment/fork state and requested action. Reuse prior build evidence only when all identities remain exact.

For merged Lite Phase 6–7, preflight must establish:

1. readable exact source and build configuration;
2. compiler/runner/tool identities and invocation route;
3. clean deploy/config simulation environment;
4. required deployables, constructor/initializer inputs, dependencies, roles, approvals and wiring inputs;
5. candidate-specific deterministic targets and basic targeted-fuzz oracles/bounds; and
6. evidence output locations and immutable run identifiers.

On failure: preserve the failed attempt, diagnose, repair the smallest affected tool/configuration/harness, rebind the new identity, rerun the affected action and record the limitation. Do not expand repair into an excluded Full campaign. Do not modify frozen production source merely to make an audit harness pass.

Fork/RPC values are runtime secrets when applicable. Persist only the approved profile name, chain, frozen block number/hash and non-secret identity evidence—never the secret endpoint.
