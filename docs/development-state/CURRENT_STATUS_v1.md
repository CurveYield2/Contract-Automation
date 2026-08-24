# Historical Exploit + Adversarial Simulation KB — Current Status v1

Generated from `DEVELOPMENT_RECOVERY_STATE_v1.json`. Do not edit this projection independently.

- Repository: `CurveYield2/Contract-Automation`
- Branch: `feat/adversarial-simulation-kb-v1`
- Pull request: 131
- Baseline main SHA: `468b749076fb5b9c166c14a187fdd29a6f967acd`
- Last known good commit: `3abcb3be66cfeb2ade3d303384fb3b2bd7776acc`
- Overall status: **IN_PROGRESS**
- Current module: **K12 — Foundry Vertical-Slice Reproduction**
- Current step: **K12-S01 / READY**
- Last completed step: K11-S05

## Last hard gate

K11 PASS on canonical GitHub run `32703124345` at source commit `3abcb3be66cfeb2ade3d303384fb3b2bd7776acc`: 58 tests passed, 0 failed; secret/RPC-literal gate PASS. The backend-neutral executable contract now binds incident/pattern/recipe by stable ID + explicit revision + canonical SHA-256 digest, distinguishes controlled and historical execution obligations, rejects literal RPC/credential/shell escape fields, and represents never-qualified executables with `lastQualification: null`.

## Next exact action

Reuse the canonical `packages/github-native-sim` Foundry infrastructure to implement a reduced controlled reproduction for `PATTERN-0001`, run preflight and GitHub execution, capture normalized initial/final state and effect, record proof run IDs/digests, and prove a deliberately broken negative fixture fails as expected.

## Open blockers

- None
