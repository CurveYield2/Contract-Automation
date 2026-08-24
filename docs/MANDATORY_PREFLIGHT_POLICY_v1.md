# Mandatory Preflight Policy v1

## Purpose

Every deterministic GitHub or audit-execution operation must prove that its prerequisites, exact inputs, execution path, expected outputs, and rollback/failure handling are correct **before** the expensive, mutating, or irreversible action begins.

Preflight is the default. An operation is exempt only when a separate preflight would literally duplicate a trivial read-only operation. Exemptions are explicit and machine-allowlisted; an agent may not invent one ad hoc.

## Universal rule

**NO EXECUTION WITHOUT PREFLIGHT.**

Before any workflow, mutation, transfer, compile, fuzz campaign, fork simulation, live probe, publication, branch mutation, request submission, remediation rerun, or cleanup operation:

1. identify the exact operation class;
2. run the class-specific preflight;
3. require terminal `PREFLIGHT_PASS` evidence bound to the exact inputs/ref/source state;
4. execute only the operation covered by that receipt;
5. if inputs/state change, invalidate the receipt and preflight again.

A failed operation returns to `PREFLIGHT_REQUIRED`. A retry is not permission to repeat the same full operation blindly.

## Preflight receipt

Every machine preflight should normalize to:

```json
{
  "schemaVersion": "curveyield-operation-preflight-v1",
  "operationClass": "workflow",
  "status": "PREFLIGHT_PASS",
  "repository": "CurveYield2/Contract-Automation",
  "ref": "...",
  "inputDigest": "...",
  "checks": [],
  "expectedOutputs": [],
  "rollback": null,
  "retryPolicy": "RECHECK_AFTER_FAILURE"
}
```

Terminal states:

- `PREFLIGHT_PASS`
- `PREFLIGHT_FAIL`
- `PREFLIGHT_BLOCKED`
- `PREFLIGHT_EXEMPT` — only for a registry-approved trivial read-only operation.

## Mandatory operation classes

The minimum registry is:

- `workflow`
- `request-submit`
- `file-transfer`
- `file-move`
- `branch-pr`
- `source-staging`
- `compile`
- `slither`
- `medusa`
- `foundry`
- `anvil-simulation`
- `live-read-probe`
- `remediation-rerun`
- `publication`
- `destructive-cleanup`

New deterministic operation types inherit `PREFLIGHT_REQUIRED` until explicitly classified.

## GitHub Actions workflow preflight

Every active workflow must have a preflight job or first-stage preflight step that blocks all substantive jobs on failure. The preflight must check, as applicable:

- correct repository and exact candidate/request ref;
- correct trigger/event and whether secrets are available in that event class;
- canonical workflow identity — not a superseded versioned workflow;
- exact source/request/harness identity;
- required files and schemas exist and parse;
- dependency lock/toolchain prerequisites;
- branch/request atomicity;
- expected evidence/artifact destination;
- concurrency/retry identity;
- operation-specific prerequisites listed below.

Substantive jobs must depend on successful preflight (`needs: preflight`) or execute only after a terminal preflight receipt in the same job.

## Workflow retry gate

After any failed workflow:

1. inspect the failed job/step/log/artifact;
2. classify the failure;
3. run a targeted diagnostic or regression reproducing the proposed cause;
4. repair the cause;
5. run preflight again;
6. only then rerun the full workflow.

Blind full reruns are forbidden. A second failure in the same failure class requires a new diagnosis; do not loop.

If the request semantics are unchanged and only trusted runner infrastructure changed, reuse/reopen the same immutable request PR when the canonical workflow supports it. Do not create `r3/r4/r5/...` request copies merely to pick up newer trusted `main` runner code.

## File transfer / file move preflight

File operations are explicitly **not** exempt.

Before moving or copying any file, verify:

- exact source repository/ref/path exists;
- source blob SHA, byte size, and content digest when exact bytes matter;
- exact destination repository/ref/path;
- whether destination already exists and whether replacement is intentional;
- repository permissions and branch protection constraints;
- selected transfer method preserves exact bytes;
- expected final blob SHA/digest verification;
- rollback/recovery path.

### Same-repository move

Preferred method: one Git tree transaction reusing the existing blob SHA. A rename/move should normally transfer **zero file bytes**.

Do not download/re-encode/re-upload a same-repository file merely to move it.

### Cross-repository transfer

Preferred exact-byte methods:

1. one exact Git blob + tree/commit transaction; or
2. a workflow artifact/file reference when the destination process accepts it.

### Anti-chunking hard rule

Agents must never solve a normal file transfer by splitting one file into hundreds/thousands of chunks and individually moving/reassembling them.

Chunked transport is permitted only when an existing approved subsystem explicitly requires it and provides a tested materializer plus digest verification. The current audit-PDF frozen-reference transport is such a subsystem; agents may not generalize that exception.

If a proposed transfer requires more than a small bounded number of Git mutations, stop and redesign the transfer before writing anything.

## Request-submission preflight

Before `v7:submit`:

- JSON parses;
- schema validates;
- request ID/digest are internally consistent;
- source commit/archive SHA are exact;
- profile/phase are admitted;
- requester-controlled RPC/secrets/shell fields are absent;
- target branch starts from current trusted base;
- resulting branch is predicted to differ by exactly one request payload;
- remote byte verification is planned.

Use the canonical `npm run v7:submit` implementation. Do not manually rebuild its blob/tree/commit/ref sequence during normal work.

## Medusa preflight

Before any substantive Medusa campaign, use the actual staged source and actual audit overlay to prove:

- exact Medusa version is available;
- source snapshot and harness bundle digests match the request;
- crytic-compile can process the actual project view;
- mixed Solidity/Vyper handling is valid for the staged project;
- `propertyTesting.enabled` is true when property/invariant evidence is required;
- `stopOnNoTests` is fail-closed when required;
- intended property/invariant functions are actually discovered;
- coverage mode does not trigger the known empty/disabled coverage failure;
- actual Medusa terminal output can be parsed, including known console framing;
- mutable RPC identity/block/hash are correct when fork mode is required;
- a tiny real target smoke campaign reaches terminal normalized evidence;
- secrets are absent from normalized evidence.

A toy smoke fixture is not sufficient when the failure mode depends on the target project's language/build/harness topology.

## Foundry preflight

Before native Foundry fuzz/invariant execution:

- Medusa terminal gate is satisfied when required by V7;
- same frozen source/fork identity is used;
- target tests/handlers are discovered;
- compile succeeds with the exact audit-only overlay;
- RPC/profile selection is valid;
- declared coverage obligations are machine-readable;
- expected raw/coverage evidence paths are writable.

## Anvil simulation preflight

Before a full lifecycle simulation:

1. exact source/build identity;
2. Ethereum/archive endpoint identity;
3. exact pinned block/hash and historical-state availability;
4. Anvil launcher + requested hardfork;
5. target code exists at every required live address;
6. literal addresses normalize correctly;
7. every ABI/function signature used by the workflow is proven against the target interface/code path;
8. pool/token route orientation and decimals;
9. required balances/principal sources;
10. approvals/allowances and action ordering;
11. roles/permissions/impersonation capability;
12. external dependency readiness;
13. static-call rehearsal for setup/deposit/configuration transactions where possible;
14. snapshot/rollback readiness;
15. expected evidence labels/artifact path.

The full 30-day/reward/economic/manipulation lifecycle may not start until this preflight passes.

## Compile/static-analysis preflight

Before build/Slither execution:

- exact source identity;
- compiler/language matrix;
- exact compiler versions/settings;
- project root/build system;
- mixed-language requirements;
- dependency state;
- expected artifact inventory;
- output/evidence destination.

## Branch/PR preflight

Before branch creation or PR mutation:

- determine whether a new branch is actually required;
- search for an existing active branch/PR for the same operation;
- verify base ref and current main head;
- verify branch naming/lifecycle disposition;
- predict the intended diff;
- ensure the operation will not create another stale request/retry branch unnecessarily.

## Destructive cleanup preflight

Before deletion/archive/branch retirement:

- compare against current `main`;
- inspect unique files/commits;
- preserve useful implementation/tests/evidence/fixtures;
- verify archive destination and exact blob identity where required;
- verify no open PR/campaign depends on the object;
- record final branch/file disposition.

## Exemption policy

A separate preflight may be omitted only when the operation is a trivial read-only inspection and the read itself supplies the prerequisite information. Examples:

- fetch one known file;
- read one PR's metadata;
- inspect one workflow run/job/log.

The exemption does **not** extend to file writes/moves, branch mutations, workflow triggers/reruns, compilation, fuzzing, simulations, publication, or cleanup.

## Failure-history rule

Every resolved failure that cost an execution attempt should become one of:

- a preflight check;
- a regression test;
- a known failure signature with deterministic next action;
- or an explicit explanation why it cannot be detected earlier.

The purpose is cumulative: the infrastructure should become harder to misuse after every failure, not merely recover from the same mistake repeatedly.
