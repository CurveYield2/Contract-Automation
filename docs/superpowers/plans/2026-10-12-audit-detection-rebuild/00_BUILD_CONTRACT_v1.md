# Audit Detection Rebuild v1 — Build Contract

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Execute sequentially. Do not delegate or start parallel browsers without explicit authorization.

**Goal:** Replace presence-based review completion with complete source assignments, source-specific challenged analysis, candidate-independent property checks, and measurable blind detection qualification.

**Architecture:** Extend the existing Lite controller and runner. Keep source sealing, GitHub evidence, campaign identity, controller-owned bookkeeping and existing execution adapters. Add typed discovery artifacts and gates; do not create another orchestrator.

**Tech Stack:** Existing Node.js ESM controller/runner, JSON contracts, GitHub Actions, admitted compiler ASTs; compiler and dependency operations only in GitHub.

**Spec:** This document defines cross-stage requirements. The numbered companion plans define implementation tasks. This is a proposed development specification, not an activated audit authority or a claim that detection is repaired.

## Global constraints

- Preserve deliverables in CurveYield2/Contract-Automation on main under this directory. This task produces plans only; it does not authorize changing campaign verdicts or silently migrating active audits.
- Read repository and nearest AGENTS.md before implementation. Reuse proven helpers; no duplicate entrypoints, retry files or one-off workflows.
- All GitHub operations use the GitHub connector. Never compile or download dependencies locally.
- Agents supply semantic analysis. Controller derives identities, digests, assignments, counts, receipts and routing at the existing boundary. A reviewer never edits those derived fields.
- Every delivered file has an integer version. Replace superseded live documentation according to repository archive policy; do not retain competing active versions.
- No runtime gate may accept a missing, malformed, stale, unknown or unsupported required artifact as a negative result.
- No required review may be waived because candidateCount equals zero.
- Automated structural validation cannot certify the truth of prose. Independently attributable source review and explicit adjudication remain required.
- Preserve the distinction between execution completeness, security interpretation, process completion and deployment assurance.
- Only isolated defensive correctness checks belong to this change; do not build autonomous exploit discovery/execution or production transaction tooling.
- Stop after the finite accepted stages below. Do not create recursive improvement queues.

## Observed baseline — 12 October 2026

Contract-Automation inspected commit: a29815f4dab4db9a16ddb13dba68bfeac3f333a6.

| Existing path | Verified observation | Change owner |
|---|---|---|
| scripts/lib/lite-phase-prefill-v1.mjs | phase4CoverageFromForm compares expected record keys to present keys and reports completed/present | Stage 3 |
| scripts/lib/lite-phase-work-v1.mjs | validateWorkForm checks fields, enum values and negative sentinels; these are structural checks | Stage 3 |
| packages/github-native-sim/src/source-intelligence-technical-v1.mjs | Function inventory iterates ABI function entries; internal/private bodies are not enumerated by that loop | Stage 2 |
| scripts/lite-phase-packet-controller-v1.mjs | assignmentReviewer assigns phases 2–5 to reviewer-2; new discovery assignments need explicit routing integration | Stage 3 |
| Audit-Controller: Audit Skill - Current Authority/Audit_Litemode_v11/phases/phase-4/START_HERE.md | Requires source and specialist rows but delegates coverage calculation to controller | Stage 3 |
| Same authority: phases/phase-5/START_HERE.md | Requires candidate-targeted execution and distinguishes NOT_REPRODUCED from disproval | Stage 4 |

The authority folder stated in the standing instructions was absent from Contract-Automation's inspected tree. The v11 authority exists in Audit-Controller at the exact path above, matching the prior conversation. Implementation must resolve and pin the current authority again; this specification does not silently relocate it.

The three unfinished files mentioned in the dropped chat were not recovered from the current workspace or the initial recent-file lookup. These documents reconstruct the requested plans from the supplied conversation and inspected code; they are not represented as recovered bytes.

## Finite build order and delivery gates

| Stage | Implemented outcome | Required deliverable before proceeding |
|---|---|---|
| 1 | Benchmark miss attribution and frozen baseline | All declared cases accounted for, unknowns explicit; no invented 30-case manifest |
| 2 | Complete source inventory and bounded assignments | Deterministic inventory and exact assignment partition fixtures |
| 3 | Source-specific review, independent pass and integration challenge | Controller rejects shallow, missing, stale or unchallenged records; two sealed passes precede reconciliation |
| 4 | Candidate-independent baseline properties | Zero-candidate fixture still generates applicable obligations; missing execution/assertions block |
| 5 | Blind qualification, migration and release decision | Separated holdout/control scoring; explicit release decision bound to code and authority |

Companions: 01_BASELINE_AND_INVENTORY_v1.md (Stages 1–2); 02_REVIEW_AND_BASELINE_CHECKS_v1.md (Stages 3–4); 03_QUALIFICATION_AND_ROLLOUT_v1.md (Stage 5, integration acceptance, agent handoff).

Each task ends with: changed files/commit, exact GitHub verification run and result, newly working behavior, unresolved blocker, exact next task. Commit and link each completed stage immediately. Do not spend an entire session accumulating uncommitted work. No progress statement substitutes for a deliverable.

## Common identity and validation contract

New artifacts use an envelope:
- schemaVersion: exact literal specified by the owning stage.
- campaignId, campaignGenerationId: exact existing controller values.
- sourceDigest, buildDigest, authorityDigest: lowercase SHA-256 strings, each equal to the admitted source/build/authority identity.
- inventoryDigest: required after Stage 2.
- policyVersion: literal audit-detection-rebuild-v1.
- payload: artifact-specific object.

Use the existing canonical JSON digest implementation. Artifact digest is computed over the complete envelope, excluding the artifactDigest property itself. Reject duplicate JSON keys at parsing; reject unexpected fields using explicit schemas. Unknown enum values are errors. Every evidence reference is {repository, commit, path, sha256}; verify exact bytes and immutable commit, not a branch URL. Source anchors additionally include UTF-8 byte start/length and excerptSha256.

Every validator returns {ok:boolean, errors:[{code,path,message}], value:null|validatedObject}. ok is true only when errors is empty. Input order must not change canonical output. Empty required sets are errors unless the owning schema explicitly defines an accepted empty-set condition.

Do not conflate assignment identity with legacy reviewer role. Use discoveryRunId, assignmentId, lane A|B|INTEGRATION, attempt and sessionIdentity within a controller-owned discoveryAssignment object. Legacy roles remain compatible and are not expanded through permissive regex matching.

## Review focus and cross-stage acceptance

1. Stale source, changed policy or a resubmitted old assignment: reject without advancing; Stages 2–3.
2. Duplicate symbols and inherited bodies: one declaration identity plus every effective invocation context; Stage 2.
3. Valid-looking boilerplate and mutually copied reviews: cannot become accepted merely through schema conformance; Stage 3.
4. Setup failure or zero reached assertions reported as successful testing: block; Stage 4.
5. Exposed holdouts or missing benchmark cases: invalidate qualification, never improve the denominator; Stage 5.

## Terminal exit condition for this planning task

All four versioned plans exist in GitHub, are read back at their commit identities, and jointly cover the six recommendations from the supplied conversation. No code repair or benchmark success is claimed by publishing these plans.
