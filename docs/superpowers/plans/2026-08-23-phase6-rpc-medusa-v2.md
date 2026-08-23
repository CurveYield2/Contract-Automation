# Phase 6 RPC + Medusa v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route all Phase-6 RPC consumers through one existing `rpc-identity-proxy-v1` lifetime and make Medusa 1.5.1 a qualified shared V7 toolchain component.

**Architecture:** The V2 Phase-6 runner starts one identity-normalizing proxy before preflight, freezes that localhost endpoint, passes the same endpoint to preflight, Medusa, and Foundry, and closes it after the Phase-6 execution exits. A single local composite GitHub Action installs and verifies Go 1.24.x + Medusa 1.5.1; both canonical V7 workflows call that same action, and infrastructure qualification records exact Medusa usability.

**Tech Stack:** Node.js 22, GitHub Actions, Go 1.24.x, Medusa 1.5.1, Foundry, existing `rpc-identity-proxy-v1`.

**Spec:** User requirements in the 2026-08-23 Phase-6 repair request.

## Global Constraints

- Reuse existing `rpc-identity-proxy-v1` for the entire Phase-6 RPC lifetime.
- Route Phase-6 preflight, Medusa, and Foundry through the same normalized endpoint.
- Use one shared V7 setup mechanism for Medusa 1.5.1.
- Both canonical workflows must call the same setup mechanism.
- Qualification must explicitly prove Medusa 1.5.1 usability.
- Add a Phase-6 identity-normalization integration regression.
- Do not duplicate the existing generic identity-proxy unit test.
- Do not modify frozen cyvlSDT production source.

---

### Task 1: Phase-6 identity-normalized RPC lifecycle

**Files:**
- Modify: `packages/github-native-sim/src/phase6-mutable-rpc-v1.mjs`
- Modify: `packages/github-native-sim/src/phase6-execution-preflight-v1.mjs`
- Modify: `packages/github-native-sim/src/run-job-file-v2.mjs`
- Test: `packages/github-native-sim/test/phase6-identity-normalization-integration-v1.test.mjs`

**Interfaces:**
- Consumes: `startRpcIdentityProxy({ upstreamUrl, chainId, fetchImpl })`.
- Produces: `startPhase6NormalizedRpcV1()`, a normalized runtime URL shared by preflight and execution.

- [x] **Step 1: Write the failing integration regression.**
- [ ] **Step 2: Run GitHub CI and confirm RED because normalized Phase-6 RPC API is absent.**
- [ ] **Step 3: Add `startPhase6NormalizedRpcV1`, require the normalized URL in Phase-6 probing/runtime, and keep the proxy alive around all Phase-6 work.**
- [ ] **Step 4: Run the integration regression and full V2 suite in GitHub CI.**

### Task 2: Shared Medusa 1.5.1 toolchain

**Files:**
- Create: `.github/actions/setup-v7-toolchain/action.yml`
- Modify: `.github/workflows/audit-controller-execution-v5.yml`
- Modify: `.github/workflows/v7-execution-infrastructure-qualification-v2.yml`
- Test: `packages/github-native-sim/test/v7-toolchain-wiring-v1.test.mjs`

**Interfaces:**
- Consumes: `actions/setup-go@v5`, `go install github.com/crytic/medusa@v1.5.1`.
- Produces: exact `medusa` 1.5.1 on PATH for both canonical workflows.

- [x] **Step 1: Write the failing workflow/toolchain wiring regression.**
- [ ] **Step 2: Confirm RED because the shared action does not exist and workflows do not call it.**
- [ ] **Step 3: Implement the local composite action with Go 1.24.x, exact Medusa install, PATH export, and exact version verification.**
- [ ] **Step 4: Wire both canonical workflows to the same action.**
- [ ] **Step 5: Record `medusa151Usable` and observed version in qualification evidence.**
- [ ] **Step 6: Run qualification in GitHub and require PASS.**

### Task 3: Rebind and rerun corrected Phase 6

**Files:**
- No frozen source changes.
- Controller evidence/request files only after the repaired runner is qualified.

**Interfaces:**
- Consumes: exact qualified Contract-Automation commit.
- Produces: new immutable Phase-6 Campaign A-M execution evidence.

- [ ] **Step 1: Merge only after CI and qualification pass.**
- [ ] **Step 2: Seal qualification/rebind evidence in Solo-Audit-Controller.**
- [ ] **Step 3: Rerun the broad Medusa campaign with Foundry still locked by the V7 phase ordering.**
