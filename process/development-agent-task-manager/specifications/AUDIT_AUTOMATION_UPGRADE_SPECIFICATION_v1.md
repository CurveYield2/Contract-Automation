# Audit Agent Workload Reduction Layer v1 — Approved Automation Upgrade Specification

Version: v1

## 1. Objective

Reduce expensive reasoning-agent workload by moving deterministic, repetitive, mechanical audit work into repository automation and low-cost/free web agents, while preserving or increasing security assurance.

The audit methodology remains authoritative. Automation must support the methodology, not replace or reinterpret it.

Primary goal:

> Let expensive reasoning agents spend their context and compute only on tasks that require real security judgment.

Secondary goals:
- reduce context load;
- reduce repeated repo navigation;
- reduce repeated state reconstruction;
- reduce repeated evidence bookkeeping;
- reduce human relay work;
- reduce unnecessary GitHub Actions runtime;
- eliminate duplicate processes;
- make successor handoffs deterministic;
- prevent premature agent retirement;
- preserve maximum assurance.

## 2. Governing architectural rules

### 2.1 Existing-process-first rule

Always evaluate in this order:

1. reuse existing process/module/workflow;
2. extend existing process;
3. refactor existing process;
4. create a new process only when existing infrastructure cannot safely represent the requirement.

A new process is not justified merely because it is easier to code.

### 2.2 Repository boundary

`Audit-Controller` is the private control/state/evidence authority.

`Contract-Automation` is the public execution plane.

Compute-heavy and recurring GitHub Actions belong in `Contract-Automation` whenever possible.

Permanent Audit-Controller workflows are a last resort.

### 2.3 Bridge-first rule

Before adding any private Audit-Controller workflow:

1. use existing Contract-Automation workflow;
2. extend existing bridge/request schema;
3. extend existing adapter/trigger;
4. extend Contract-Automation workflow;
5. only then consider private workflow if truly impossible/unsafe otherwise.

### 2.4 Skill authority

The admitted V7/Lite skill remains methodology authority.

Repository automation cannot silently change:
- audit methodology;
- security thresholds;
- source identity;
- phase ownership;
- reviewer semantics;
- finding disposition;
- remediation correctness.

### 2.5 Fail closed

Identity mismatches, missing evidence, stale qualification, incomplete handoffs, unknown obligation states, or ambiguous phase completion must block advancement/retirement.

## 3. Human/AI semantic boundary

### Automation/mechanical responsibilities

Automation may own:
- current-state reconstruction;
- phase navigation;
- exact read-set construction;
- Phase Contract parsing;
- work queue generation;
- deterministic request construction;
- execution dispatch;
- execution observation;
- evidence identity validation;
- evidence ingestion;
- output completeness checking;
- ledger reconciliation;
- invalidation projection;
- report scaffolding;
- handoff scaffolding;
- phase completion validation;
- retirement-gate evaluation;
- successor wake payload generation;
- final evidence-index assembly/prefill.

### Security reviewer responsibilities

Reasoning reviewers retain:
- semantic scope interpretation;
- trust assumptions;
- architecture reasoning;
- threat modeling;
- manual source review;
- economics/math analysis;
- security property design where judgment is required;
- exploit reasoning;
- candidate promotion/rejection;
- severity/materiality decisions;
- finding validation;
- remediation correctness;
- residual-risk reasoning;
- ambiguous applicability decisions.

Automation must never auto-promote technical evidence into a security finding.

## 4. Core modules

### 4.1 Current Work Packet

Generated from canonical campaign state and exact Phase Contract.

Must include:
- campaign identity;
- generation identity;
- assurance mode;
- source/build identity;
- admitted skill identity;
- active phase route identity;
- semantic Phase Contract identity;
- revision;
- reviewer lineage;
- exact current step;
- only the material that must be read now;
- sealed work not to repeat;
- current Source Intelligence reference;
- due obligations;
- missing outputs;
- invalidations/rework;
- execution state;
- next executable work;
- retirement readiness;
- packet digest.

Purpose: progressive disclosure. Agents should not preload entire audit history.

### 4.2 Phase Work Queue

Derive exact work order from the Phase Contract.

Must preserve Phase Contract order.

Must classify work as mechanical vs semantic.

Must understand both:
- existing v26 obligation ledger ownership;
- Lite `requiredPhase` obligation routing.

Unknown obligation states fail closed.

### 4.3 Execution Request Builder

Take already-authorized semantic input and bind it into the existing canonical V7 execution-request format.

Must reuse existing request builder/adapter.

Must bind:
- campaign;
- source;
- phase;
- gate;
- runner;
- configuration;
- semantic input digest.

Must not invent the hypothesis/property.

### 4.4 Canonical execution bridge

Do not create a parallel bridge.

Controller operations and technical V7 execution use the same atomic request transport.

Public pointer:
- minimal;
- exact Audit-Controller commit;
- exact private request path;
- optional exact-controller verification flag.

Existing `v7:submit` must remain the preferred submitter.

### 4.5 Evidence ingestor

Reuse canonical V7 evidence validation.

Produce deterministic ingestion receipt.

Invariant:
- `securityDisposition = REVIEWER_REQUIRED`
- `findingPromotion = FORBIDDEN_BY_INGESTOR`

### 4.6 Completion validator

Phase completion cannot be represented by a free-floating `"PASS"` string.

Machine companion must bind:
- campaign generation;
- exact source digest;
- exact phase identity;
- exact reviewer lineage;
- phase revision;
- human/AI report reference;
- report SHA-256;
- every mandatory step disposition;
- every sealing criterion and evidence refs;
- all required outputs and byte digests;
- machine-gate receipts;
- due-obligation dispositions.

The operator must re-read referenced files and verify bytes.

### 4.7 Automation completion validator

For phases requiring automation completion, machine report binds:
- required execution IDs;
- request IDs/digests;
- workflow/run/job/artifact identities;
- terminal status;
- artifact digest when available;
- current admitted Contract-Automation qualification.

The validator must reuse the existing admitted execution contract.

### 4.8 Retirement gate

An agent may retire only when machine evidence says retirement is allowed.

Required chain:

`phase report`
→ `completion companion`
→ `completion validation PASS`
→ `automation completion PASS where applicable`
→ `no blocking queue item`
→ `validated successor handoff where applicable`
→ `retirementAllowed = true`

Starting automation is not completion.

Agent self-belief is not completion.

### 4.9 Successor handoff

Mechanically generate:
- sealed handoff JSON;
- Start Here document;
- wake-up message;
- machine handoff validation receipt.

The outgoing reviewer remains responsible for semantic correctness of the handoff input.

The validator must bind:
- boundary;
- generation;
- source;
- outgoing reviewer;
- incoming reviewer;
- report digest;
- handoff digest.

### 4.10 Recovery/current-state view

The controller should be able to re-render current work from durable state after context loss.

Dashboard/state views are projections, never independent authority.

## 5. Lite identity handling

Lite route folders and semantic Phase Contract IDs can differ.

Example:
- route folder: `phase-6`
- semantic contract: `lite-merged-execution`

Both identities must be preserved.

Do not force Full/v26 phase topology onto Lite.

## 6. Phase-0 web bootstrap design

Initial approved optimization moved every safe deterministic task possible into Lite Phase 0 for a web bootstrap agent.

Phase 0 web bootstrap can:
- establish campaign structure;
- verify/freeze source identities;
- initiate repo automation;
- observe automation;
- validate that expected artifacts exist;
- assemble neutral build/recon outputs;
- generate/reuse Source Intelligence;
- prepare machine state for Phase 1;
- create deterministic handoff material.

It must not perform semantic security judgments.

Phase 1 must not regenerate Phase-0 mechanical evidence.

## 7. Inter-phase web-worker expansion

Newly enabled by browser-agent wake/create capability.

Web agents can now be inserted between reasoning phases.

Safe candidate work:
- handoff packaging;
- exact artifact indexing;
- ledger reconciliation;
- evidence ingestion;
- candidate/evidence indexing without disposition;
- missing-output checks;
- source/evidence digest validation;
- current-state packet regeneration;
- Phase-10 evidence-index prefill;
- report scaffolding;
- wake-up message generation;
- exact repo-link construction;
- controlled GitHub uploads/source admission.

Unsafe for web grunt agents:
- threat modeling;
- source security interpretation;
- exploit judgment;
- severity;
- candidate disposition;
- remediation decisions;
- residual-risk decisions.

## 8. Web-agent wake/watchdog architecture

Existing Contract-Automation infrastructure now supports:
- resume existing ChatGPT web conversation;
- create fresh ChatGPT web conversation;
- inject wake/instruction message;
- redundant browser providers;
- 5-minute watchdog;
- productivity-aware non-interruption;
- watchdog termination on terminal completion.

Wake should be coupled to validated workflow/phase state, not arbitrary execution success.

Preferred future boundary:

`outgoing reviewer completion`
→ `machine phase approval`
→ `optional web grunt pass`
→ `machine grunt completion`
→ `validated successor handoff`
→ `wake next reasoning reviewer`

## 9. Performance optimization

Critical optimization discovered during implementation:

Previously, canonical V7 execution initialized expensive tooling before even knowing whether the request needed it.

Controller-only operation should resolve first, then skip:
- npm runner dependency setup;
- Foundry;
- Anvil;
- Medusa;
- Slither/toolchain setup;
- runner manifest verification.

V7 CLI heavy modules must lazy-load only when needed.

Rule:

> Do not initialize a capability until the current operation actually requires it.

## 10. Qualification/rebind

Every Contract-Automation main change that affects admitted execution must be qualified.

Audit-Controller must bind to:
- exact qualified commit;
- exact qualification workflow run.

Never bind to raw main merely because it is newer.

Re-read:
`Contract-Automation/process/V7_QUALIFICATION_STATUS.json`

before merge.

## 11. Implementation order

Approved logical order:

1. integrity/authority preservation;
2. skill efficiency compression;
3. Current Work Packet;
4. Phase Work Queue;
5. machine seal/completion evaluation;
6. execution request builder;
7. canonical bridge extension;
8. execution observer/recovery;
9. evidence ingestion;
10. global-control / ledger projections;
11. report assembly;
12. successor handoff;
13. final closure/evidence index;
14. web-agent inter-phase grunt lane;
15. continuous removal of duplicate/redundant infrastructure.

## 12. Definition of success

The completed system should allow expensive reasoning agents to spend nearly all of their context on:
- understanding;
- analysis;
- adversarial reasoning;
- candidate/finding judgment;
- remediation.

Everything else should be deterministic automation or bounded mechanical web-agent work, with machine gates preserving security and continuity.
