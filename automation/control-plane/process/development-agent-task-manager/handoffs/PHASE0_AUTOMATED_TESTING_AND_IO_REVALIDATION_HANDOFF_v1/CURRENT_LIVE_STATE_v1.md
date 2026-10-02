# Current Live State v1

## Production authority and code

At handoff creation, the production Lite authority is \`Audit_Litemode_v10.3\`.

### Audit-Controller

Main SHA:

\`27d23ee9995600f068832a4511d7e9c4a543632e\`

Live authority:

\`Audit Skill - Current Authority/Audit_Litemode_v10.3/\`

ZIP:

\`Audit Skill - Current Authority/Audit_Litemode_v10.3.zip\`

PR #100 is merged. That consistency upgrade formalized and repaired the reviewer/automation interfaces.

### Contract-Automation

Main SHA:

\`85c47a8b2dbdcdc6e8a1ba2ef744996f0889ea5c\`

PR #434 is merged.

Qualification status:

- V7 Execution Infrastructure Qualification \`36605563062\`: PASS
- Lite Structured Phase Regression v2 \`36605563140\`: PASS
- Sync Lite Authority ZIP v1 \`36608247000\`: PASS

## What v10.3 already repaired

The next agent MUST preserve these repairs:

- Phase-0 finalizer-required machine artifacts are formally declared.
- Controller-generated outputs are represented explicitly in authority schemas.
- Phase-7 substantive domain work is not routed to the automation-only marker phase; merged 6–7 execution scope belongs to Phase 6.
- Fresh-reviewer handoff no longer requires an incoming controller-generated final report to already exist.
- Wake language says the controller owns packets/reports; reviewers invoke validation.
- Controller-prefilled/read-only values are integrity-bound to controller assignment state.
- Phase-5 request refs collected/resolved by the controller become controller-owned.
- Phase-9 initial prefills are validated before controller-collected rerun evidence is added.
- Earlier limitations/unresolved information are carried into the final evidence view.
- Formal obligations use a canonical due → disposition → carry/close lifecycle rather than being mixed with arbitrary graph/candidate data.
- Phase-5 target execution is structurally bound to exact campaign/source/candidate/reproduction/expected-observation identity before it can be treated as machine evidence.
- Phase 6 retains semantic review of whether the exact request/harness actually implements the AI-designed transaction sequence, oracle and fuzz bounds.

## Existing Phase-0 automation

Relevant existing machine outputs include:

- \`evidence/build/BUILD_AND_SOURCE_IDENTITY_v1.json\`
- \`evidence/readiness/PROJECT_READINESS_AUTOMATED_v1.json\`
- \`evidence/phase0/PHASE0_DEPLOY_CONFIG_EXECUTION_v1.json\`
- \`evidence/dependencies/SBOM_v1.json\`
- \`evidence/static-analysis/SLITHER_v1.json\`
- \`evidence/source-intelligence/SOURCE_INTELLIGENCE_AUTOMATED_v1.json\`
- canonical \`SOURCE_INTELLIGENCE_v1.json\`
- Source Intelligence bundle/index artifacts
- \`work/phase-06/LITE_DEPLOY_CONFIG_MATRIX.md\`
- Phase-0 receipt and Phase-1 assignment

Existing Phase-0 logic is spread across the bootstrap/intelligence/finalization path and the github-native-sim package. The new testing system must plug into that existing path rather than creating an independent audit engine.

## What is NOT yet implemented

The postponed project is **broad Phase-0 automated security exploration**.

Required properties:

- random exploration uses real ABI-visible functions, not meaningless arbitrary bytes;
- typed arguments are generated for actual function signatures;
- stateful simulation composes actual callable functions into transactions/sequences;
- coverage guidance is always active;
- deterministic seeds make every retained failure reproducible;
- corpus growth is based on new coverage/state-transition/anomaly value;
- counterexamples are minimized;
- generic machine signals are neutral evidence only;
- candidate-specific semantic attacker testing remains a Phase-5 design responsibility;
- Phase-0 results are routed downstream without forcing later agents to rediscover or manually transcribe machine results.

## Tooling/session operational note

During the preceding upgrade session, long-lived poll/stream operations periodically expired in the chat harness. This was not a repository failure.

Successor guidance:

- prefer bounded GitHub status reads;
- inspect workflow runs/jobs/logs with short deterministic calls;
- do not depend on one long-lived streaming poll;
- after a tool expiry, resume from durable GitHub state rather than restarting work;
- repository commits, PR state, action-run state and campaign artifacts are the durable truth.
