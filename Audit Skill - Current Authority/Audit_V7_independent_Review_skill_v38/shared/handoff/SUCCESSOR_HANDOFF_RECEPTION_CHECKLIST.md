# Generic Successor Handoff Reception Checklist

Use this checklist for `P1_TO_P2`, `P5_TO_P6`, `P6A_TO_P6B`, `P6B_TO_P6C`, `P6_TO_P7`, and `P8_TO_P9` before any claim that predecessor information is missing.

## 1. Bootstrap first

- [ ] Read the campaign-local `handoffs/<PROFILE_ID>/START_HERE_SUCCESSOR.md` first.
- [ ] Verify its campaign/generation/source/boundary/reviewer/receiving-phase fields against controller state.
- [ ] Confirm it points to the exact `SUCCESSOR_HANDOFF.json`, output receipt path, and exact next phase card.

## 2. Load generic authority and exact profile

- [ ] Read `SUCCESSOR_HANDOFF_PROTOCOL.md`.
- [ ] Load `SUCCESSOR_HANDOFF_BOUNDARY_PROFILES.json` and select exactly the packet's profile ID.
- [ ] Read `SUCCESSOR_HANDOFF.json` first; it is authoritative.
- [ ] Confirm controller state is `WAITING_FOR_SUCCESSOR_AGENT`.

## 3. Identity/profile gate

- [ ] campaign ID and generation match controller.
- [ ] outgoing phase/revision matches the sealed report closed by the automatic boundary authorization.
- [ ] source fence/release identity matches controller/evidence.
- [ ] outgoing and incoming reviewers exactly match the selected profile.
- [ ] boundary authorization is `AUTO_AFTER_SEAL`, references the sealed predecessor report/subphase report, and permits continuation.

## 4. Evidence and seed gate

- [ ] every profile-required evidence artifact exists with reference/digest/status;
- [ ] every profile-required section key has a typed completeness state;
- [ ] every profile-required successor-seed field is present;
- [ ] `P1_TO_P2` binds the sealed Phase-1 Security Risk Grade Manifest and accepted Source Intelligence Bundle;
- [ ] `P6_TO_P7` proves P6.0–P6.8 terminal in order and binds the Phase-6 sub-gate-state digest.

Typed states `PRESENT_EMPTY`, `NOT_APPLICABLE`, `UNRESOLVED_CARRIED`, and `BLOCKED_CARRIED` are dispositions, not missing fields.

## 5. Campaign-global state gate

- [ ] verify every global-state artifact required by the selected profile, including its ref/digest/revision;
- [ ] enumerate every OBL-* due in the receiving phase;
- [ ] preserve every BLOCKED_CARRIED obligation and blocker evidence;
- [ ] verify no unresolved evidence invalidation/rebind state is silently presented as current.
- [ ] verify Source Intelligence Bundle Index reference/revision/commit/SHA-256 and exact source/build binding;
- [ ] verify accepted core/runtime/readiness revision, commit, SHA-256, status, invalidation state and preserved snapshot;
- [ ] when a canonical mutable path is used, independently hash its current bytes and require a match to the accepted pointer; reject path-only authority;
- [ ] do not repeat Phase-1 structural collection, Phase-6A readiness admission, or Phase-7 runtime/gas acceptance already sealed in the handed-off component revisions.

## 6. Recovery ladder

Before `REQUIRED_ARTIFACT_UNRESOLVABLE` or a human blocker report:

- [ ] exact bootstrap/handoff reference;
- [ ] exact controller/report reference;
- [ ] campaign evidence lookup by artifact ID/digest;
- [ ] GitHub connector search by exact filename/identity;
- [ ] applicable repair route;
- [ ] distinguish infrastructure failure from handoff defect.

Record every attempt in the receipt.

## 7. Receipt

Choose exactly one disposition:

- `HANDOFF_ACCEPTED`
- `HANDOFF_ACCEPTED_WITH_CARRIED_LIMITATIONS`
- `HANDOFF_REPAIR_REQUIRED`
- `HANDOFF_INFRASTRUCTURE_ACCESS_FAILURE`

Only the first two authorize the profile's receiving phase. Record global-state identities and all due obligations in the receipt.
