# Phase-0 Automated Testing Implementation Plan v1

## Implementation strategy

Use the existing trusted execution architecture.

Do not build a parallel “Phase0 fuzzer service.”

Prefer additions/refactors under existing:

- \`automation/runtime/github-native-sim/\`
- Phase-0 bootstrap/intelligence/finalize automation/scripts/workflows
- existing V7 runner/tool adapters
- existing evidence rendering/ingestion patterns
- existing qualification workflow

## Stage 1 — Inventory and exact environment binding

Inputs:

- build/source identity;
- automated/canonical Source Intelligence;
- project readiness;
- deploy/config execution;
- SBOM/static analysis.

Produce \`PHASE0_TEST_INVENTORY_v1.json\`.

The inventory must prove a one-to-one accounting from admitted callable surfaces to:

- testable;
- intentionally excluded with reason;
- deployment/environment blocked.

Acceptance: zero silent callable omissions.

## Stage 2 — Generic real-function harness layer

Create deterministic adapters that can invoke real functions with typed arguments.

Required capabilities:

- ABI type generation;
- actor pool;
- msg.value control;
- snapshot/reset;
- stateful sequence execution;
- trace capture;
- coverage capture;
- seed replay.

Do not embed protocol-specific security conclusions.

## Stage 3 — Coverage-guided function fuzz

Execute function campaigns with coverage feedback.

Required retained outputs:

- corpus;
- coverage;
- neutral signals;
- minimized reproductions.

## Stage 4 — Coverage-guided sequence simulation

Add stateful transaction sequences.

Required feedback:

- new coverage;
- new function-transition edge;
- new state-transition signature;
- new reproducible signal.

Start short; grow depth based on feedback.

## Stage 5 — Artifact renderers and schemas

Add canonical structured artifacts listed in the data-contract document.

Reuse the style of current Phase-0 machine evidence and Lite boundary artifact renderers.

## Stage 6 — Controller/authority integration

Update live authority in Audit-Controller and automation in Contract-Automation as paired branches.

Required sync:

- Phase-0 required outputs;
- controller/finalizer required-file list;
- Phase-0 receipt evidence refs;
- Phase-4 machine signal input;
- final evidence routing;
- recovery semantics;
- validator expectations.

## Stage 7 — Qualification and negative testing

Add unit and integration tests before merge.

Mandatory negative cases:

- source SHA mismatch;
- build identity mismatch;
- missing callable inventory entry;
- arbitrary bytes falsely counted as function coverage;
- coverage provider missing;
- coverage feedback disabled;
- unreproducible signal;
- stale corpus from another source;
- execution trace missing;
- Phase-0 signal incorrectly assigned severity/finding status;
- downstream Phase-4 input pointing to absent signal;
- deployment/config blocked environment;
- sequence replay mismatch.

## Stage 8 — Cross-phase I/O revalidation

After Phase-0 testing works, do NOT immediately declare completion.

Run the complete playbook in \`CROSS_PHASE_AGENT_AUTOMATION_IO_AUDIT_PLAYBOOK_v1.md\`.

This second audit must inspect every phase 0–10 and every fresh-reviewer boundary.

## Expected code-touch areas

Likely Contract-Automation files/modules to inspect first:

- \`.github/workflows/lite-phase0-bootstrap-v1.yml\`
- \`.github/workflows/lite-phase0-intelligence-v1.yml\`
- \`automation/scripts/lite-phase0-finalize-v1.mjs\`
- \`automation/runtime/github-native-sim/src/lite-phase0-skill-outputs-v1.mjs\`
- \`automation/runtime/github-native-sim/src/lite-boundary-artifacts-v1.mjs\`
- V7 runner/native fuzz/Medusa/Foundry support
- \`automation/scripts/validate-lite-authority-v1.py\`
- relevant \`automation/runtime/github-native-sim/test/\` tests
- V7 Execution Infrastructure Qualification workflow

Likely Audit-Controller files:

- current authority \`SKILL.md\`
- Phase-0 contract/card
- Phase-4 schema/card/form if machine-signal inputs are added
- Phase-5 context only where selected machine signals matter
- Phase-10/final-index references
- shared controller/schema policy if new generated artifacts are declared
- package manifest/provenance via the existing authority sync process

## Branch/merge discipline

Use paired branches with the same logical purpose in both repos.

Recommended next branch:

\`upgrade/phase0-real-function-testing-v1\`

Open paired PRs.

Run Contract-Automation PR qualification against the matching Audit-Controller branch.

Merge Audit-Controller first only when paired cross-repo checks are green, then Contract-Automation, then verify authority ZIP synchronization on main.

## No-progress anti-patterns

Do not:

- spend time writing another conceptual spec without implementing/test-driving it;
- create a second controller;
- create a second evidence ingestor;
- create a generic random-calldata campaign and call it complete;
- use AI in Phase 0 merely to choose calls;
- move AI-guided candidate testing out of Phase 5;
- create duplicate final summaries when an existing canonical artifact can hold the data.
