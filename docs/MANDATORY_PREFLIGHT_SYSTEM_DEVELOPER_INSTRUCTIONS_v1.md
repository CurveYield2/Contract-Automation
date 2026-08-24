# Mandatory Preflight System — Developer Implementation Instructions v1

> **Mission:** Implement a complete, machine-enforced preflight system for every deterministic operation used by CurveYield agents across `CurveYield2/Audit-Controller` and `CurveYield2/Contract-Automation`, plus a canonical configuration manual for every operation class. The system must prevent repeated blind failures, improvised file-transfer schemes, malformed workflow execution, and simulation/fuzzer trial-and-error loops.

## 0. Source of truth and continuation point

Do **not** restart this work from scratch.

Existing work already lives on branch:

```text
CurveYield2/Contract-Automation
  policy/mandatory-preflight-v1
```

Existing files on that branch include:

```text
docs/MANDATORY_PREFLIGHT_POLICY_v1.md
packages/github-native-sim/src/operation-preflight-v1.mjs
packages/github-native-sim/test/operation-preflight-v1.test.mjs
AGENTS.md                    # policy upgraded to v10
```

A companion policy branch exists in:

```text
CurveYield2/Audit-Controller
  policy/mandatory-preflight-v1
```

with:

```text
docs/agent-guides/MANDATORY_PREFLIGHT_POLICY_v1.md
AGENTS.md                    # policy upgraded to v5
```

Treat the current `main` branches as the implementation baseline and these policy branches as the work-in-progress design baseline.

## 1. Core rule

The target architecture is:

```text
INTENT
  -> OPERATION CLASSIFICATION
  -> CONFIGURATION VALIDATION
  -> PREFLIGHT
  -> PREFLIGHT_PASS RECEIPT
  -> EXECUTION
  -> EXECUTION EVIDENCE
  -> POST-EXECUTION VERIFY
```

After any execution failure:

```text
EXECUTION_FAILED
  -> FAILURE CLASSIFICATION
  -> TARGETED DIAGNOSTIC / REGRESSION
  -> REPAIR
  -> PREFLIGHT_REQUIRED
```

**Blind full reruns are forbidden.**

Every deterministic operation defaults to `PREFLIGHT_REQUIRED` unless it is an explicitly allowlisted trivial read-only inspection.

## 2. Why this project exists

Workflow history shows repeated agent failures caused by discoverable prerequisites being checked only after full execution:

- Medusa CLI/output parsing incompatibility;
- Unicode/console framing issues;
- Medusa property testing disabled;
- no-tests/coverage failure modes;
- mixed Solidity/Vyper build-info/source-map incompatibility;
- Anvil launcher/configuration mistakes;
- archive/fork identity mistakes;
- address normalization mistakes;
- target code not existing at the requested pinned state;
- incorrect ABI/function signatures;
- pool/token route direction mistakes;
- missing balances/approvals/roles;
- transaction ordering mistakes;
- repeated immutable request copies created only to pick up runner fixes;
- agents manually splitting files into hundreds/thousands of pieces, transferring each piece, and trying to reconstruct the file;
- stale branches and workflows being reused instead of canonical paths.

The implementation must convert each recurring failure class into an earlier machine check wherever possible.

## 3. Non-negotiable implementation principles

1. **Preflight is machine-enforced, not advisory prose.**
2. **Every operation class has a configuration contract.**
3. **Every operation class has a configuration manual entry.**
4. **Every operation class has tests.**
5. **Every operation class has proof-of-function evidence.**
6. **An operation that has never successfully executed in its current implementation is NOT considered proven.**
7. **High-risk operations require positive and negative proof.**
8. **Secret-dependent or live-fork operations require trusted GitHub qualification, not only mocked/local unit tests.**
9. **No test may mutate real production contracts or private campaign source.**
10. **No security judgment is automated.** Preflight verifies mechanics, identity, prerequisites, and execution readiness only.
11. **No target-specific audit property may be fabricated by the runner.** Target-specific properties/harnesses are auditor-authored inputs.
12. **No silent fallback.** Unsupported state must fail closed with a typed reason.
13. **No manual chunk-transfer fallback.** Normal file transfer must remain atomic/bounded.
14. **Existing canonical CLI/workflow paths are extended, not duplicated.**
15. **Historical workflows are failure evidence, not current execution entrypoints.**

## 4. Required final operation inventory

The current minimum operation registry is:

```text
workflow
request-submit
file-transfer
file-move
branch-pr
source-staging
compile
slither
medusa
foundry
anvil-simulation
live-read-probe
remediation-rerun
publication
destructive-cleanup
```

This list is a minimum, not an assumption that it is complete.

### Mandatory discovery phase

Before implementing additional preflights, inventory both repositories and identify every deterministic operation reachable through:

```text
.github/workflows/**
.github/actions/**
package.json scripts
packages/**/src/*cli*
packages/**/src/*execution*
packages/**/src/*submit*
packages/**/src/*simulation*
packages/**/src/*preflight*
packages/**/src/*deploy*
packages/**/src/*publish*
scripts/**
audit-generator/**
GitHub connector operational instructions in AGENTS/docs
```

Create:

```text
process/OPERATION_REGISTRY_v1.json
```

Each registry entry must include:

```json
{
  "operationClass": "medusa",
  "ownerRepository": "CurveYield2/Contract-Automation",
  "riskLevel": "HIGH",
  "mutating": false,
  "external": true,
  "expensive": true,
  "preflightRequired": true,
  "canonicalEntrypoints": [],
  "configurationSchema": "...",
  "manualSection": "...",
  "proofRequirement": "TRUSTED_GITHUB",
  "negativeProofRequired": true
}
```

Every deterministic operation found in the repositories must map to exactly one active registry entry.

If an action is truly obsolete, archive/remove it rather than adding a new preflight for obsolete code.

## 5. Required architecture

### 5.1 Generic preflight envelope

Preserve and extend:

```text
packages/github-native-sim/src/operation-preflight-v1.mjs
```

Canonical receipt:

```json
{
  "schemaVersion": "curveyield-operation-preflight-v1",
  "operationClass": "medusa",
  "status": "PREFLIGHT_PASS",
  "repository": "CurveYield2/Contract-Automation",
  "ref": "...",
  "inputDigest": "...",
  "configurationDigest": "...",
  "checks": [],
  "expectedOutputs": [],
  "rollback": null,
  "proofIdentity": null,
  "retryPolicy": "RECHECK_AFTER_FAILURE"
}
```

Terminal statuses:

```text
PREFLIGHT_PASS
PREFLIGHT_FAIL
PREFLIGHT_BLOCKED
PREFLIGHT_EXEMPT
```

### 5.2 Per-operation configuration schemas

Create a schema/validator for every operation class. Prefer one directory:

```text
packages/github-native-sim/src/preflight/
  registry-v1.mjs
  workflow-v1.mjs
  request-submit-v1.mjs
  file-transfer-v1.mjs
  file-move-v1.mjs
  branch-pr-v1.mjs
  source-staging-v1.mjs
  compile-v1.mjs
  slither-v1.mjs
  medusa-v1.mjs
  foundry-v1.mjs
  anvil-simulation-v1.mjs
  live-read-probe-v1.mjs
  remediation-rerun-v1.mjs
  publication-v1.mjs
  destructive-cleanup-v1.mjs
```

Do not put every operation's logic into one giant switch statement.

### 5.3 CLI

Extend the existing V7 CLI instead of creating a separate operational CLI.

Required command family:

```bash
npm run v7 -- preflight --operation <class> --config <config.json>
```

Convenience commands are allowed, for example:

```bash
npm run v7 -- preflight:medusa --request ... --bundle ...
npm run v7 -- preflight:simulation --request ...
npm run v7 -- preflight:transfer --config ...
```

But all must use the same registry/receipt system.

### 5.4 Execution gate

Execution commands must consume or internally generate a current passing preflight receipt.

For high-risk operations, execution must reject:

```text
missing receipt
wrong operation class
wrong input digest
wrong source digest
wrong ref
expired/stale runner identity
PREFLIGHT_FAIL
PREFLIGHT_BLOCKED
```

A receipt cannot be reused after material configuration/input changes.

## 6. Configuration manual requirement

Create canonical:

```text
docs/AGENT_OPERATION_CONFIGURATION_MANUAL_v1.md
```

The manual must contain one complete section for **every registry entry**.

Each operation section must contain exactly these headings:

```text
Purpose
When to use
When NOT to use
Canonical entrypoint
Required configuration
Automatically discovered configuration
Forbidden configuration
Preflight checks
Execution behavior
Expected evidence/output
Post-execution verification
Failure classes
Recovery procedure
Retry rule
Proof-of-function requirement
Examples: valid
Examples: invalid
```

### Critical rule

The manual and registry must be mechanically cross-validated.

Add a test that fails when:

- a registry operation has no manual section;
- the manual describes an operation not present in the registry;
- an operation has no configuration validator;
- an operation has no test file;
- an operation has no declared proof requirement.

## 7. Testing and proof-of-function standard

This requirement is critical because many operation paths have not yet been used in production.

### 7.1 Four evidence levels

Use these levels:

#### Level A — static/schema proof

Proves:

```text
configuration shape
required fields
forbidden fields
registry/manual coverage
receipt determinism
input binding
```

Required for every operation.

#### Level B — unit proof

Uses temporary/mocked/local fixtures to prove actual preflight logic.

Required for every operation.

#### Level C — integration proof

Runs the operation against a representative repository/project/Git fixture without touching production state.

Required for every operation that performs Git mutation, source staging, build, analysis, runner orchestration, publication preparation, or cleanup.

#### Level D — trusted GitHub proof-of-function

Runs the actual workflow/toolchain/external dependency in GitHub Actions with the same trust/secret model used in production.

Required for:

```text
workflow
request-submit
medusa
foundry when fork-dependent
anvil-simulation
live-read-probe
secret-dependent publication
any operation whose correctness depends on GitHub event/secrets/permissions
```

### 7.2 Historical successful run rule

An existing successful workflow run may satisfy proof-of-function only if all are true:

```text
same current implementation or proven equivalent commit
same active entrypoint
same configuration/schema generation
same essential toolchain/runtime
run artifacts/logs are still inspectable
success actually exercises the required path
```

Otherwise run a new controlled proof.

### 7.3 Never-used action rule

For every operation/preflight/action with no qualifying historical success:

**A new proof-of-function run is mandatory before the project can be declared complete.**

Do not mark it `SUPPORTED` merely because unit tests pass.

### 7.4 Negative proof

For HIGH-risk operations, prove at least one representative failure is caught **before** expensive execution.

Examples:

```text
file transfer -> reject 1000-piece plan
request submit -> reject secret/rpc field
Medusa -> reject property-required config with no discovered properties
Anvil simulation -> reject wrong ABI/target-code missing before lifecycle
branch/PR -> reject unnecessary duplicate retry branch
cleanup -> reject deletion when unique unarchived content exists
```

### 7.5 Proof receipts

Create:

```text
process/PREFLIGHT_PROOF_STATUS_v1.json
```

One record per operation:

```json
{
  "operationClass": "medusa",
  "implementationCommit": "...",
  "proofLevel": "D",
  "status": "PASS",
  "workflowRunId": "...",
  "testedAt": "...",
  "positiveProof": "...",
  "negativeProof": "...",
  "knownLimitations": []
}
```

Static checks must reject a runner manifest that claims an operation `SUPPORTED` without the required proof level.

## 8. Workflow-level preflight requirement

Every current active GitHub workflow must be classified.

### Canonical audit workflows

At minimum:

```text
.github/workflows/audit-controller-execution.yml
.github/workflows/v7-execution-infrastructure-qualification.yml
```

must have an explicit preflight job/stage.

The substantive job must depend on the preflight.

Pattern:

```yaml
jobs:
  preflight:
    ...

  execute:
    needs: preflight
    if: needs.preflight.result == 'success'
```

A same-job preflight is permitted only when job-level separation is technically inappropriate and the substantive step cannot execute before preflight completion.

### Other workflows

Inventory every workflow currently in `.github/workflows`.

For each one decide:

```text
ACTIVE + PREFLIGHT REQUIRED
ACTIVE + EXEMPT (rare, justified)
SUPERSEDED -> ARCHIVE/REMOVE
CAMPAIGN-SPECIFIC HISTORICAL -> ARCHIVE/REMOVE from active surface
```

Do not preserve dozens of one-off audit workflows as active simply to satisfy this project.

## 9. File-transfer system

This is a high-priority operation because agents repeatedly fail at it.

### 9.1 Same repository

A move/rename must normally:

```text
read source blob SHA
create new tree referencing same SHA at destination
remove source tree path
commit once
verify destination blob SHA == source blob SHA
```

Expected bytes transferred: **zero**.

### 9.2 Cross repository

Preferred paths:

```text
one exact Git blob + tree transaction
OR
approved artifact/file-reference handoff
```

### 9.3 Chunking guard

Normal operation must reject:

```text
plannedChunkCount > 1
```

unless configuration declares an allowlisted subsystem ID.

Approved exception registry must be explicit. Start with only:

```text
audit-pdf-frozen-reference-transport
```

Do not allow free-form `approvedChunkedSubsystem: true` forever. Replace the current prototype boolean with a stable allowlisted subsystem ID.

### 9.4 Proof

Must demonstrate:

```text
same-repo binary move preserves exact blob SHA
cross-repo binary transfer preserves SHA-256
large normal transfer succeeds without chunking
1000-part transfer plan is rejected
existing-destination overwrite requires explicit intent
rollback path works in fixture repo
```

## 10. Branch/PR preflight

Before branch creation:

- search for existing branch/PR with same task/request identity;
- verify current base SHA;
- declare intended changed paths;
- declare branch lifecycle state;
- determine if immutable request PR can be reused/reopened;
- reject redundant retry branch creation when request semantics are unchanged.

### Proof

Create fixture tests showing:

```text
new feature branch allowed
same-task duplicate branch rejected/warned
unchanged immutable request retry -> reuse existing PR
changed request semantics -> new request identity allowed
merged branch -> lifecycle cleanup required
```

## 11. Medusa preflight

This is HIGH risk and requires Level D proof.

Use the **actual staged project and actual audit overlay**, never only a toy smoke fixture.

Preflight must prove:

```text
Medusa == 1.5.1
actual staged source digest
actual harness bundle digest
crytic-compile succeeds
mixed Solidity/Vyper topology supported if present
propertyTesting.enabled correct
stopOnNoTests fail-closed when properties required
expected properties/invariants discovered
coverage configuration does not trigger known no-test/coverage failure
actual Medusa CLI output parser handles real output framing
fork RPC identity correct
frozen block/hash correct
tiny real-target smoke reaches terminal normalized evidence
RPC secret absent from evidence
```

### Historical failure regressions

At minimum add regression fixtures/signatures for:

```text
MEDUSA_CLI_PARSE
MEDUSA_CONSOLE_PREFIX
MEDUSA_PROPERTY_TESTING_DISABLED
MEDUSA_NO_PROPERTIES
MEDUSA_COVERAGE_NO_TESTS
MEDUSA_MIXED_VYPER_SOURCEMAP
```

If workflow history reveals additional Medusa failures, add them before completion.

### Proof

Run a trusted-main qualification that:

1. stages a representative mixed or complex target fixture;
2. applies a real harness overlay;
3. runs the new Medusa preflight;
4. proves at least one property is discovered;
5. executes a tiny real Medusa smoke;
6. preserves normalized evidence;
7. proves a deliberately broken fixture is stopped in preflight.

Only after this passes may Medusa preflight status be `SUPPORTED`.

## 12. Foundry preflight

Preflight must prove:

```text
Medusa predecessor gate when required
same exact snapshot/fork identity
Forge 1.7.1
actual test/handler discovery
compile success
RPC/profile correctness
coverage obligations parse
artifact/evidence path writable
```

### Proof

Must include:

```text
positive fuzz test
positive invariant/handler test where supported
no-tests negative fixture
stale snapshot negative fixture
fork identity mismatch negative fixture
```

If fork-dependent, Level D GitHub proof is mandatory.

## 13. Anvil simulation preflight

This is HIGH risk and requires Level D proof.

Before a long lifecycle, prove:

```text
exact source/build identity
Ethereum/archive RPC identity
exact pinned block/hash
historical state availability
Anvil engine
exact requested hardfork
target code at every live address
address normalization
actual ABI/function signatures used by workflow
pool/token route orientation
token decimals
principal/balances
allowances/approvals
roles/permission model inputs
impersonation/balance-control capability
external dependency readiness
static-call rehearsal for setup/deposit/configuration where possible
snapshot/revert readiness
expected evidence labels/path
```

### Transaction rehearsal rule

When a state-changing transaction can be meaningfully simulated with `eth_call`/`staticCall` first, do so in preflight.

Do not wait for the full lifecycle to discover a basic revert.

### Historical failure regressions

At minimum preserve/add:

```text
ANVIL_LAUNCHER_FAILURE
RPC_IDENTITY_MISMATCH
PINNED_STATE_UNAVAILABLE
TARGET_CODE_MISSING
ADDRESS_NORMALIZATION
ABI_SIGNATURE_MISMATCH
POOL_ROUTE_DIRECTION
TOKEN_DECIMALS
BALANCE_PRINCIPAL_MISSING
APPROVAL_ORDER
ROLE_OR_IMPERSONATION_FAILURE
STATIC_REHEARSAL_REVERT
```

### Proof

A controlled trusted GitHub proof must execute:

```text
preflight PASS on representative lifecycle
short setup/deposit smoke after preflight
preflight rejection for deliberately wrong ABI
preflight rejection for target-code-missing fixture
preflight rejection for wrong route/orientation fixture where feasible
```

Do not run a 30-day lifecycle merely to prove preflight plumbing.

## 14. Compile preflight

Support:

```text
Solidity
Vyper
mixed Solidity/Vyper
native build mode when admitted
```

Preflight verifies exact compiler/settings/dependency/project-root identity before build.

### Proof

At minimum:

```text
Solidity fixture PASS
Vyper fixture PASS
mixed fixture PASS
wrong compiler FAIL
missing dependency/project root FAIL
```

## 15. Slither preflight

Preflight requires accepted build + exact Slither 0.11.6.

### Proof

```text
valid Solidity target PASS
wrong Slither version FAIL
build failure prevents Slither
normalized result remains non-authoritative
```

## 16. Source-staging preflight

Must prove exact checkout/archive integrity and safe extraction.

### Negative proof fixtures

```text
wrong archive SHA
path traversal ZIP
symlink/unsafe entry
wrong project root
oversized extraction
commit mismatch
```

## 17. Live-read-probe preflight

For live calls/probes:

```text
chain ID
block identity
code presence
ABI signature
call mutability expectation
address checksum/normalization
secret redaction
```

Proof must include one real trusted read-only live probe plus wrong-ABI rejection.

## 18. Remediation rerun preflight

Must prove:

```text
prior source identity
new source identity
explicit changed files/artifacts
invalidation set
required retests
current harness/workflow compatibility
replacement evidence destination
```

Reject rerun when source delta/invalidation mapping is absent.

## 19. Publication preflight

This operation is split by repository responsibility.

### Audit PDF publication

Owner: `CurveYield2/Audit-Controller`.

Preflight must cover current private PDF generator/publication/resolver workflows and must not expose private campaign data/secrets.

The separate PDF-generator agent may modify its detailed internal implementation. Coordinate rather than overwrite active work.

### Generic public artifacts

If Contract-Automation publishes technical artifacts, define separate registry configuration and proof.

## 20. Destructive cleanup preflight

Required before:

```text
branch deletion
archive migration
file removal
workflow retirement
cleanup of historical/superseded infrastructure
```

Preflight proves:

```text
compare with current main
unique commits/files inspected
useful content preserved
open PR/campaign dependency checked
archive destination verified
post-cleanup active references checked
rollback identity available
```

Negative proof: fixture containing unique unarchived file must block deletion.

## 21. Failure classifier / doctor

Create a deterministic failure-classification layer.

Suggested files:

```text
packages/github-native-sim/src/failure-doctor-v1.mjs
packages/github-native-sim/test/failure-doctor-v1.test.mjs
process/KNOWN_FAILURE_SIGNATURES_v1.json
```

Command:

```bash
npm run v7 -- doctor --evidence <path-or-run-artifact>
```

Output:

```json
{
  "schemaVersion": "v7-failure-doctor-v1",
  "failureClass": "MEDUSA_NO_PROPERTIES",
  "knownSignatureId": "MEDUSA-004",
  "confidence": "EXACT_SIGNATURE",
  "doNotRerunFullOperation": true,
  "nextDiagnostic": "...",
  "requiredPreflightClass": "medusa"
}
```

Do not build an AI classifier. Start with deterministic signatures/structured evidence.

## 22. Historical workflow failure mining

Use workflow history as a regression corpus.

For every unique recurring failure found:

1. assign stable ID;
2. record original workflow/run/PR evidence if available;
3. identify earliest point it could have been detected;
4. add preflight check or regression;
5. mark `NOT_EARLY_DETECTABLE` only with explicit explanation.

Create:

```text
docs/PREFLIGHT_FAILURE_CORPUS_v1.md
process/KNOWN_FAILURE_SIGNATURES_v1.json
```

Do not attempt to manually read tens of thousands of runs one by one. Sample/group by workflow, conclusion, failure step, log signature, PR title/version lineage, and recurring error string.

## 23. GitHub workflow integration

### Contract-Automation

Current canonical V7 workflows must be converted first:

```text
.github/workflows/audit-controller-execution.yml
.github/workflows/v7-execution-infrastructure-qualification.yml
```

The repository currently also contains many campaign-specific workflows. Inventory them and classify them. Do not add preflight jobs to superseded one-off workflows just to preserve clutter; archive/remove superseded workflows under existing archive policy.

### Audit-Controller

Only current private PDF workflows are permitted. The PDF agent may own their detailed preflight; this project must still register them and enforce that they declare a preflight path or approved integration contract.

## 24. Static enforcement

Extend `scripts/check.mjs` in Contract-Automation to fail when:

```text
registry operation missing validator
registry operation missing manual section
registry operation missing tests
active workflow not classified
active high-risk workflow lacks preflight dependency/stage
unsupported versioned one-off workflow remains active
normal operation permits uncontrolled chunking
SUPPORTED operation lacks required proof receipt
```

Extend Audit-Controller checks as appropriate without interfering with the PDF agent's active branch.

## 25. Qualification workflow

Upgrade V7 infrastructure qualification to include preflight-system qualification.

Required qualification matrix:

```text
registry/manual/schema consistency
file move exact blob proof
cross-repo transfer fixture proof
branch/PR preflight fixture
source staging safety fixtures
Solidity compile
Vyper compile
mixed compile
Slither
Medusa target preflight + smoke
Foundry preflight + smoke
Anvil lifecycle preflight + short smoke
live read probe
failure doctor known signatures
negative preflight fixtures
secret redaction
```

The qualification artifact must record exact implementation commit and proof status per operation.

## 26. Rollout strategy

Implement in this order:

### Phase A — inventory and contracts

1. inventory deterministic operations;
2. build `OPERATION_REGISTRY_v1.json`;
3. finish configuration manual;
4. finish generic receipt/schema/validator architecture;
5. add registry/manual/test cross-validation.

### Phase B — Git operations

6. file move;
7. file transfer;
8. branch/PR;
9. request submit;
10. source staging.

These are prioritized because agent Git mistakes can consume days and corrupt repository state.

### Phase C — build and analysis

11. compile;
12. Slither.

### Phase D — Phase 6 execution

13. Medusa;
14. Foundry;
15. failure doctor/signature corpus.

### Phase E — Phase 7/live execution

16. Anvil simulation;
17. live-read probe;
18. remediation rerun.

### Phase F — publication/cleanup

19. publication integration contract;
20. destructive cleanup.

### Phase G — qualification and enforcement

21. proof-of-function runs for every never-proven action;
22. qualification status generation;
23. static enforcement;
24. end-to-end synthetic workflow;
25. merge and retire working branches.

## 27. Test-first requirement

For every operation class:

1. create failing test proving current gap;
2. implement minimal preflight logic;
3. pass unit test;
4. add integration fixture;
5. run proof-of-function at required level;
6. record proof receipt;
7. only then mark operation supported.

Do not write all implementation first and attempt one giant qualification at the end.

## 28. End-to-end synthetic test

Create a synthetic operation sequence that performs:

```text
branch/PR preflight
-> source staging
-> compile
-> Slither
-> Medusa preflight/smoke
-> Foundry preflight/smoke
-> Anvil preflight/short lifecycle
-> evidence transfer
-> remediation-rerun preflight
-> cleanup preflight
```

Then create negative variants where one prerequisite is wrong at each stage and prove the expensive downstream action never starts.

## 29. Proof that expensive work was blocked

Negative tests must not merely return `FAIL`. They must prove the expensive/mutating action did not run.

Examples:

```text
Medusa preflight fails -> Medusa full campaign invocation counter remains 0
Anvil ABI preflight fails -> lifecycle step count remains 0
file transfer chunk guard fails -> no destination commit created
cleanup preflight fails -> branch/file still exists
workflow preflight fails -> substantive job skipped
```

## 30. Performance target

Preflight should be much cheaper than the operation it protects.

Targets:

```text
Git/file/branch preflight: seconds
compile/static preflight: minimal prerequisite build where necessary
Medusa preflight: tiny smoke, not full campaign
Anvil preflight: readiness + transaction rehearsal, not long lifecycle
```

Do not accidentally make preflight equal to running the entire expensive operation twice.

## 31. Pull request and branch lifecycle

Both policy branches currently have no PR. Create PRs immediately when implementation work begins, satisfying branch lifecycle policy.

Use descriptive PR bodies including:

```text
operation classes implemented
proof levels completed
proof runs
known limitations
remaining work
```

Do not merge partial infrastructure claiming universal coverage.

## 32. Required developer handoff/status file

Maintain:

```text
docs/PREFLIGHT_IMPLEMENTATION_STATUS_v1.md
```

Table:

```markdown
| Operation | Validator | Manual | Unit | Integration | Trusted Proof | Negative Proof | Enforced | Status |
```

Allowed status:

```text
NOT_STARTED
IN_PROGRESS
UNIT_PROVEN
INTEGRATION_PROVEN
QUALIFIED
BLOCKED
```

No operation is complete until its required proof level is achieved.

## 33. Completion criteria

Project is complete only when:

- [ ] every deterministic active operation is inventoried;
- [ ] every operation maps to one registry entry;
- [ ] every registry entry has a configuration manual section;
- [ ] every registry entry has a validator;
- [ ] every registry entry has unit tests;
- [ ] every applicable entry has integration tests;
- [ ] every never-used action has a successful proof-of-function run;
- [ ] every HIGH-risk action has negative proof;
- [ ] every secret/live/fork-dependent action has trusted GitHub proof;
- [ ] every active workflow is classified;
- [ ] every active expensive workflow has a blocking preflight stage;
- [ ] file transfer chunk abuse is machine-blocked;
- [ ] same-repo moves use blob reuse by default;
- [ ] redundant retry branch/request creation is prevented;
- [ ] Medusa known failure history is represented in regressions;
- [ ] Anvil/simulation known failure history is represented in regressions;
- [ ] failure doctor returns deterministic next action for known signatures;
- [ ] blind full rerun state is prohibited by control logic/policy;
- [ ] proof status file identifies exact qualifying commit/run;
- [ ] full repository tests/lint/build pass;
- [ ] V7 infrastructure qualification passes on exact final commit;
- [ ] no production source or historical campaign evidence was modified to make tests pass;
- [ ] both working branches have final lifecycle dispositions.

## 34. Final report required from implementing agent

Return:

```text
Contract-Automation final commit:
Contract-Automation PR:
Audit-Controller final commit:
Audit-Controller PR:

Operations inventoried:
Operations QUALIFIED:
Operations BLOCKED:
Never-before-used operations newly proof-tested:
Trusted GitHub proof runs:
Negative proofs:
Known failure signatures encoded:

Medusa preflight proof:
Foundry preflight proof:
Anvil preflight proof:
File transfer proof:
Branch/request reuse proof:

Full test result:
Lint result:
Build result:
Qualification run:

Historical campaign evidence modified: NONE
Known limitations:
```

If any required operation has not reached its proof level, do **not** state that the universal preflight system is complete.
