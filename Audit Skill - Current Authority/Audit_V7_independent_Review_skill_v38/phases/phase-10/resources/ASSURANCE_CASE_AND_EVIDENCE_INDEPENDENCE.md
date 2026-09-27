# Audit V7 Assurance Case and Evidence Independence v1

## Purpose

This reference imports the strongest report-assurance concepts from Maximum Assurance v5 into Audit V7 **without changing Audit V7's verdict semantics; the runtime uses one active reviewer at a time with mandatory successor handoffs after Phases 5, 6, and 8**.

Audit V7 remains a single-reviewer process with `PROCEDURAL_INDEPENDENCE_ONLY`. This reference strengthens how final security conclusions are traced to requirements, threats, evidence, and the exact audited release.

## Material claim contract

A **material claim** is any client-relevant statement whose truth materially affects the security conclusion, deployment decision, finding disposition, or confidence in a critical security property. Examples include:

- the final `PASS` / `NO_GO` security verdict;
- a statement that a Critical or High finding is absent, present, remediated, or closed;
- closure of any finding whose remediation affects supply, solvency, ownership, privilege, upgrade, withdrawal, reward, oracle, or external-integration safety;
- a system-level claim that a critical invariant or property holds;
- a claim that deployed/live code or configuration matches the audited release;
- a claim that a required audit process completed successfully;
- a material limitation that constrains what the report can conclude.

Every material claim MUST map to an assurance-case record containing:

1. **Claim ID** — stable identifier, for example `AC-001`.
2. **Claim** — concise client-readable security conclusion.
3. **Requirement / security property** — the intended property or requirement the claim addresses.
4. **Threat/failure mode** — what would violate the claim and why it matters.
5. **Argument** — concise reasoning from the evidence to the conclusion; never merely “tests passed.”
6. **Evidence references** — immutable references/digests to accepted evidence.
7. **Evidence class / independence classification** — classify how each evidence item was produced.
8. **Responsible lens** — the Audit V7 lens that owns the conclusion. This is a lens label, not a separate actor.
9. **Exact source identity** — repository/commit or uploaded-source digest the claim applies to.
10. **Exact release hash** — the exact release/package/runtime identity supporting the final claim when a release candidate exists.
11. **Status** — `SUPPORTED`, `PARTIALLY_SUPPORTED`, `UNSUPPORTED`, `NOT_APPLICABLE`, or `SUPERSEDED` for the assurance record. These are assurance-record statuses and do not replace Audit V7 phase-status or final-verdict vocabulary.
12. **Limitations / assumptions** — material caveats, unavailable evidence, external assumptions, or scope boundaries.

A finding record does not replace an assurance-case record. The finding explains the defect; the assurance case explains why the final conclusion about that defect or its remediation is justified for the exact source/release.

## Evidence independence classification

Audit V7 MUST NOT call evidence “independent” merely because it comes from multiple same-agent passes, multiple prompts to the same model family, or multiple tests that share the same oracle/harness assumption.

Classify accepted evidence using one or more of these evidence classes, or a more specific evidence-bound subclass:

- `MECHANICALLY_INDEPENDENT_TOOL` — a deterministic/static/formal external tool whose execution and result are separately captured, such as Slither output. Tool diversity does not automatically imply failure-mode independence.
- `RUNTIME_EXECUTION` — build/test/fuzz/fork/simulation evidence produced by executing code against a stated harness/environment.
- `MANUAL_SOURCE_REVIEW` — direct source/flow/privilege/economic reasoning performed by the active reviewer.
- `EXTERNAL_LIVE_STATE` — chain/runtime/configuration evidence read from a live or pinned external system.
- `PROCEDURAL_INDEPENDENCE_ONLY` — a same-agent source-first retrace that was isolated procedurally but is not epistemically independent.
- `CORRELATED_SAME_AGENT` — another same-agent/model pass whose conclusions may be useful corroboration but MUST NOT be counted as independent confirmation.
- `SHARED_HARNESS_EVIDENCE` — multiple results whose validity depends materially on the same harness/oracle/setup; treat them as correlated for confidence claims.

### Evidence diversity rule

“Multiple evidence items” and “independent evidence” are not synonyms.

For every material claim, state whether the evidence is:

- **single-source**;
- **corroborated but correlated**; or
- **meaningfully diverse** because the evidence mechanisms have materially different failure modes.

A claim may still be supported by correlated evidence when Audit V7's actual methodology permits it, but the report MUST disclose the correlation and MUST NOT inflate confidence by describing it as independent assurance.

A reviewer cannot manufacture actor independence by repeating its own work. `PROCEDURAL_INDEPENDENCE_ONLY` remains the controlling label for isolated same-agent retraces. The planned Phase-5→6, Phase-6→7, and Phase-8→9 `SEQUENTIAL_AGENT_HANDOFF` boundaries are real session/agent lineage changes but does not, by itself, make evidence clean-room independent because the successor consumes the sealed handoff and prior evidence.

## Exact source and release binding

Every supported material claim must identify the exact source identity it applies to. When a release candidate, deployment package, runtime bytecode, or final artifact exists, the assurance record must also bind the claim to the **exact release hash** or equivalent immutable release identity.

A claim supported only on an earlier source revision is `SUPERSEDED` or requires revalidation; it cannot silently support the successor release.

A live-deployment claim requires deployed runtime/configuration evidence for the actual deployment. A passing fork deployment does not become a live-deployment attestation merely because the bytecode was deployable.

## Client-facing report vs evidence bundle

The two outputs serve different purposes and MUST remain separate.

### Client-facing final report

The client-facing final report remains concise and readable. It MUST include a top-level **Security Claims & Assurance Evidence** section containing a compact assurance-case summary for the most material conclusions, including at minimum:

- the final security verdict claim;
- every unresolved Critical/High claim;
- every remediated Critical/High claim when remediation review was performed;
- system-level claims that materially support a `PASS` verdict (for example supply/solvency/access-control/withdrawal/upgrade safety where applicable);
- release/deployment/live-attestation claims;
- material limitations that constrain the conclusion.

Each row must expose at least: Claim ID, claim, requirement/security property, threat/failure mode, concise evidence-class summary, exact release hash/identity, assurance status, and evidence-bundle reference.

The client summary MUST NOT dump raw commands, controller state, prompt history, internal scheduling, or exhaustive evidence metadata.

### Evidence bundle

The evidence bundle MUST contain the **full assurance-case ledger for every material claim**, with complete immutable evidence references, responsible lens, source/release identities, evidence-independence classification, argument, status, and limitations.

Raw tool output, commands, manifests, traces, fuzz artifacts, fork reports, remediation diffs, and reproduction materials remain in the evidence bundle rather than being copied wholesale into the client report.

## Finalization gates

Phase 10 MUST NOT finalize when any of the following is true:

1. A material conclusion in the final report has no assurance-case record.
2. A supported material claim lacks exact source identity.
3. A release-bound claim lacks the exact release hash/immutable release identity.
4. Evidence correlation is represented as independence.
5. The client-facing Security Claims & Assurance Evidence summary contradicts the full assurance-case ledger.
6. A required evidence item is unknown/unexecuted and the claim is nevertheless marked `SUPPORTED` without an explicit accepted limitation permitted by Audit V7.
7. A source/release change invalidated evidence and the claim was not revalidated.
8. Report polish, severity prose, or prior confidence is used to override missing or contradictory evidence.

These gates strengthen report traceability only. They do **not** replace Audit V7's existing phase statuses, automatic advancement protocol, or `PASS` / `NO_GO` derivation.
