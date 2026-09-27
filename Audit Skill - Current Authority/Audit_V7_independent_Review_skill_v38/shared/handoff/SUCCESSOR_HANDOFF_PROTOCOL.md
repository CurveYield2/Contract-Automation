# Generic Successor Handoff Protocol

## Purpose

This is the **single canonical successor-handoff engine** for every planned fresh-reviewer boundary. Boundary-specific requirements live only in `SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json`; do not create separate protocol/schema/checklist families for individual phases.

Profiles:

- `P1_TO_P2`: `reviewer-1` → fresh `reviewer-2` / Phase 2; transfers the sealed Phase-1 risk-grade manifest as the Phase-2 starting control.
- `P5_TO_P6`: `reviewer-2` → fresh `reviewer-3A` / Phase 6A.
- `P6A_TO_P6B`: `reviewer-3A` → fresh `reviewer-3B`.
- `P6B_TO_P6C`: `reviewer-3B` → fresh `reviewer-3C`.
- `P6_TO_P7`: `reviewer-3C` → fresh `reviewer-4`.
- `P8_TO_P9`: `reviewer-4` → fresh `reviewer-5`.

The handoff is a **sealed continuation contract**, not a conversational summary and not authorization to redo sealed phases.

## Canonical campaign artifact layout

For profile `<PROFILE_ID>`, producer writes under the exact controller-bound campaign workspace:

- `handoffs/<PROFILE_ID>/SUCCESSOR_HANDOFF.json` — authoritative handoff.
- `handoffs/<PROFILE_ID>/START_HERE_SUCCESSOR.md` — tiny bootstrap packet for the fresh reviewer.

Receiver writes:

- `handoffs/<PROFILE_ID>/SUCCESSOR_HANDOFF_RECEIPT.json` — authoritative receipt.

Use:

- `SUCCESSOR_HANDOFF_SCHEMA.json`;
- `SUCCESSOR_HANDOFF_RECEIPT_SCHEMA.json`;
- `SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json`;
- `SUCCESSOR_HANDOFF_RECEPTION_CHECKLIST.md`;
- `SUCCESSOR_HANDOFF_TEMPLATE.json`;
- `SUCCESSOR_HANDOFF_RECEIPT_TEMPLATE.json`;
- `START_HERE_SUCCESSOR_TEMPLATE.md`.

The profile determines exact phases, reviewer lineages, required evidence artifacts, required section keys, seed-packet fields, receiving entry state, and artifact paths.

## Hard boundary

Only after the outgoing phase/subphase is evidence-sealed and its required report is filed may automatic `AUTO_AFTER_SEAL` boundary authorization be recorded. The outgoing reviewer then creates the handoff/bootstrap/wake-up artifacts immediately, enters `WAITING_FOR_SUCCESSOR_AGENT`, and stops for that boundary. **No human `CONTINUE` or approval is required.** The outgoing reviewer MUST NOT execute the receiving phase/subphase.

The receiving reviewer must be a fresh agent/session and becomes authorized only after an accepted receipt. This is `SEQUENTIAL_AGENT_HANDOFF`, not automatic clean-room independence.

## Typed completeness vocabulary

Every conditional section uses exactly one of:

- `PRESENT_NONEMPTY` — applicable and contains items.
- `PRESENT_EMPTY` — applicable, checked, legitimately zero items.
- `NOT_APPLICABLE` — does not apply; reason required.
- `UNRESOLVED_CARRIED` — unresolved matter intentionally carried.
- `BLOCKED_CARRIED` — blocked work intentionally carried with exact blocker evidence.

None means “missing information.” Bare null/blank is never a substitute for a typed state.

## Producer contract

The outgoing reviewer MUST:

1. Load the exact boundary profile and verify its own phase/reviewer identity.
2. Bind campaign/generation, outgoing phase revision, controller state, source fence, release identities, outgoing/successor lineages, and exact automatic boundary authorization.
3. Index every evidence artifact required by the profile with immutable reference/digest/status.
4. Export the profile-required sections without silently changing any candidate/finding/property/hypothesis/limitation disposition.
5. Populate every profile-required successor-seed field. Boundary seed data is data under `successorSeedPacket`; it never changes the generic protocol.
6. Transfer the exact profile-required campaign-global state, unresolved traceability gaps, obligations due in the receiving phase, and carried blockers. `P1_TO_P2` transfers the sealed Phase-1 risk-grade manifest and accepted Source Intelligence Bundle; later profiles transfer the exact Security Traceability Graph, Carried-Forward Obligation Ledger, and Domain Applicability Registry required by their profile. `P6A_TO_P6B` transfers P6.0/design readiness; `P6B_TO_P6C` transfers P6.1–P6.6 + terminal Medusa evidence; `P6_TO_P7` transfers exact terminal P6.0–P6.8 proof and all 6A/6B/6C seal evidence.
7. Apply `EVIDENCE_INVALIDATION_MATRIX` to any material change before handoff; unresolved invalidation/rebind work must be represented as traceability state and OBL-* work.
8. Give every conditional section a typed state, list missing fields/contradictions explicitly, and require an empty `missingRequiredFields` list for `HANDOFF_COMPLETE`.
9. Compute the canonical handoff payload digest.
10. Generate the boundary-local `START_HERE_SUCCESSOR.md` from `START_HERE_SUCCESSOR_TEMPLATE.md`. This bootstrap packet is deliberately tiny and may contain only exact identity/routing/current obligations—not a narrative re-summary of the audit.
11. Verify the handoff and bootstrap packet exist at the exact profile paths, then stop.

## Receiver contract

The fresh successor MUST:

1. Read the campaign-local `START_HERE_SUCCESSOR.md` first.
2. Use the GitHub connector app only to resolve the exact handoff and durable artifacts.
3. Load this generic protocol, the boundary profile, and the generic reception checklist; do not load unrelated phase history.
4. Verify schema/profile, campaign/generation, source fence, outgoing phase revision, reviewer lineage, automatic boundary authorization, required evidence index, typed sections, seed packet, global state digests, and bootstrap-packet identity.
5. Fetch deeper prior evidence only when needed to verify identity/contradiction or to execute the receiving phase. Do not re-audit sealed phases for convenience.
6. Create `SUCCESSOR_HANDOFF_RECEIPT.json` with exactly one disposition: `HANDOFF_ACCEPTED`, `HANDOFF_ACCEPTED_WITH_CARRIED_LIMITATIONS`, `HANDOFF_REPAIR_REQUIRED`, or `HANDOFF_INFRASTRUCTURE_ACCESS_FAILURE`.
7. Only the first two dispositions authorize the profile's receiving-phase entry state.
8. After accepted receipt, open exactly the `incomingPhaseCard` named by the profile and continue execution.

## Mandatory recovery ladder before a defect claim

All repository operations use the GitHub connector app under `U-GITHUB-001`.

1. exact bootstrap/handoff reference;
2. exact controller durable-state/report reference;
3. immutable artifact ID/digest lookup in campaign evidence;
4. GitHub connector search by exact artifact ID/filename/digest if a path moved;
5. applicable operations/execution recovery route;
6. classify genuine access failure as `HANDOFF_INFRASTRUCTURE_ACCESS_FAILURE`, not “missing context.”

A single failed path, terse bootstrap packet, or absence from chat context is not a handoff defect.

## Typed defect hard gate

Do not tell the human that handoff information is missing unless the receipt contains a typed defect with `defectId`, `fieldPath` or `artifactId`, `defectType`, expected, observed, recovery attempts, blocking effect, and repair target. Allowed defect types:

- `REQUIRED_FIELD_ABSENT`
- `SCHEMA_INVALID`
- `BOUNDARY_PROFILE_MISMATCH`
- `IDENTITY_MISMATCH`
- `DIGEST_MISMATCH`
- `BOUNDARY_AUTHORIZATION_INVALID`
- `AUTHORITATIVE_CONTRADICTION`
- `REQUIRED_ARTIFACT_UNRESOLVABLE`
- `SUCCESSOR_BOOTSTRAP_INVALID`

Wanting more narrative detail is not a defect.

## No gratuitous rework

A valid handoff authorizes continuation. Return an earlier phase only for a typed blocking defect/controller rework decision. Otherwise inherited uncertainty becomes receiving-phase properties, hypotheses, tests, simulations, remediation work, or limitations.


## Canonical Source Intelligence Bundle continuity
Every fresh-reviewer handoff after Phase 5, Phase 6A, Phase 6B, Phase 6C, or Phase 8 MUST carry the latest controller-accepted Bundle Index reference/revision/commit/digest, its bound source/build digests, and the accepted revision/commit/digest/status/invalidation state/preserved snapshot for the core and both overlays. The successor verifies the index and component identities—including current mutable-path byte matches—under `shared/source-intelligence/SOURCE_INTELLIGENCE_REUSE_PROTOCOL.md`. It does not reconstruct Phase-1 inventories or repeat a sealed predecessor's overlay-acceptance work for context recovery.


## Mandatory human-ready WAKE UP MESSAGE

At every planned fresh-reviewer boundary, the outgoing reviewer must leave the human with **one complete initial message that can be pasted verbatim into the replacement agent with nothing added**.

Campaign artifacts now include:

- `handoffs/<PROFILE_ID>/SUCCESSOR_HANDOFF.json` — authoritative structured handoff;
- `handoffs/<PROFILE_ID>/START_HERE_SUCCESSOR.md` — bootstrap packet;
- `handoffs/<PROFILE_ID>/WAKE_UP_MESSAGE.md` — exact human-copyable initial successor message;
- `handoffs/<PROFILE_ID>/SUCCESSOR_HANDOFF_RECEIPT.json` — receiver receipt.

### Two-step immutable URL seal

1. Commit `SUCCESSOR_HANDOFF.json`, `START_HERE_SUCCESSOR.md`, and every underlying handoff support artifact first. Record that full 40-character commit as `HANDOFF_CONTENT_COMMIT_SHA`.
2. Generate `WAKE_UP_MESSAGE.md` from `WAKE_UP_MESSAGE_TEMPLATE.md`. Its **Handoff folder** and **Start here** URLs MUST contain `HANDOFF_CONTENT_COMMIT_SHA`; branch/main URLs are not sufficient. Then commit the wake-up message and record its SHA-256/blob identity in the Phase Report/controller evidence.

This avoids a self-referential commit identity while giving the replacement agent immutable URLs to all prerequisite handoff content.

### Required wake-up contents

The generated campaign message must be all-encompassing and contain, without unresolved placeholders:

- fresh successor reviewer/phase assignment;
- exact active Audit V7 skill identity;
- GitHub connector-only access rule;
- exact repository identities;
- exact immutable handoff-folder URL;
- exact immutable `START_HERE_SUCCESSOR.md` URL;
- campaign/generation/controller/phase/reviewer/handoff identities;
- exact source/build identities;
- current Source Intelligence Bundle Index revision/commit/digest plus accepted core/runtime/readiness component identities and limitation state;
- ordered required-read list with full immutable URL for every item;
- exact completed/sealed work that MUST NOT be repeated;
- open obligations/limitations/blockers;
- current technical execution/request/workflow/preflight/evidence state where applicable;
- active branch/PR lifecycle state;
- one exact FIRST EXECUTABLE ACTION;
- exact assigned-phase completion condition;
- do-not-bother-human / non-blocking progress / diagnose-repair-retry-verify execution rules;
- immediate begin-now instruction.

Generated `WAKE_UP_MESSAGE.md` is invalid if it contains angle-bracket placeholders, template variables, `TBD`, `TODO`, vague “find the campaign” language, a branch/main URL as the only handoff location, or instructions to repeat sealed work.

### Retiring-agent response hard rule

After the normal end-of-phase report, the outgoing reviewer MUST give the human the exact filed wake-up message in a **separate standalone fenced `text` copy block**:

````markdown
### WAKE UP MESSAGE FOR REPLACEMENT AGENT

```text
<EXACT CONTENTS OF CAMPAIGN WAKE_UP_MESSAGE.md>
```
````

The fenced block contains **only** the wake-up message. No commentary, explanation, placeholder, or extra human-authored context belongs inside it. The retiring reviewer must verify that the text in the block matches the filed `WAKE_UP_MESSAGE.md` apart from the final newline. A fresh-reviewer handoff is incomplete until this copy-ready block has been given to the human.


## Active Artifact Minimization

The skill package is an operational manual, not an archive database. Handoff packages MUST prioritize active operational knowledge.

Transfer only artifacts required for successor execution:
- validated findings
- evidence references
- unresolved obligations
- assumptions
- coverage gaps
- required successor actions

Exploratory notes, superseded explanations, and obsolete instructional material MUST NOT be included unless they directly affect the successor phase decision.
