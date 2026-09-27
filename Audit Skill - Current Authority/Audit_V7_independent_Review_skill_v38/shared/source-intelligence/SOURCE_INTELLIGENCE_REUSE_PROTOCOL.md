# Canonical Source Intelligence Bundle — Generation, Reuse & Invalidation Protocol v2

## Purpose

Phase 1 converts the exact admitted source/build into a durable **Canonical Source Intelligence Bundle** before later analytical phases begin. The bundle consists of an immutable source/build core, two revisioned mutable overlays, and a controller-maintained bundle index. Later phases consume the accepted component revisions instead of repeatedly rediscovering the same structural facts.

This artifact is a **structural evidence package**, not a vulnerability report and not a substitute for semantic security review. Compiler-derived facts, exact source anchors, and neutral static-reconnaissance observations may seed later reasoning; analyzer candidates are not findings unless independently validated under the audit process.

## Mandatory Phase-1 timing

Use this order:

```text
exact Phase-0 source fence
  -> exact Phase-1 source staging
  -> exact build admission
  -> fill SOURCE_INTELLIGENCE_TEMPLATE.json from exact source/build facts,
     including structural security surfaces/topology and preliminary gas estimates
  -> run neutral Slither reconnaissance against the same admitted project
  -> attach Slither/SBOM/static-recon references to the same Source Intelligence artifact
  -> initialize runtime/deployment and assurance-readiness overlays
  -> validate + seal the immutable core
  -> validate + commit accepted overlay revisions
  -> fill + commit SOURCE_INTELLIGENCE_BUNDLE_TEMPLATE.json with pinned component identities
  -> later phases consume accepted revisions through the bundle index
```

The Source Intelligence **core** is created immediately after exact build admission. Neutral Slither reconnaissance is then attached as the static-recon layer before Phase 1 seals. Phase 1 also initializes the overlays, but it records only discovery/structural states there: it does not accept Phase-6A harness adequacy, Phase-7 runtime behavior, or Phase-7 deployment gas.

## Bundle topology and authority

| Component | Mutability | Phase-1 responsibility | Later acceptance owner |
|---|---|---|---|
| `SOURCE_INTELLIGENCE_vN.json` core | Immutable after seal | Create source/build facts, security surfaces, topology, preliminary compiler gas | Phase 9 creates a new version after production source/build change |
| `runtime-deployment-overlay.json` | Mutable path; revisioned accepted bytes | Initialize available deployment/configuration identities and preliminary references | Phase 7 accepts runtime/configuration/gas evidence; Phase 10 verifies final revision |
| `assurance-readiness-overlay.json` | Mutable path; revisioned accepted bytes | Inventory tools, harnesses, configs and skeletons; no adequacy verdict | Phase 6A accepts adequacy/repairs; Phase 6B/6C consume it |
| `SOURCE_INTELLIGENCE_BUNDLE_INDEX.json` | Mutable controller index; every accepted state committed | Pin the accepted core/overlay revision, commit and digest | Any accepting phase updates it after validation and invalidation classification |

**Mutable paths are navigational; accepted revisions and digests are evidentiary.** A consumer MUST NOT trust current bytes merely because the path is canonical. It verifies `logicalArtifactId`, `latestAcceptedRevision`, `acceptedCommitSha`, `acceptedSha256`, `status`, `lastVerifiedPhase`, `invalidationStatus`, exact source/build binding, and `preservedSnapshotRef` from the latest controller-accepted bundle index.

## Exact template rule

The auditor MUST copy and fill [`SOURCE_INTELLIGENCE_TEMPLATE.json`](SOURCE_INTELLIGENCE_TEMPLATE.json), [`RUNTIME_DEPLOYMENT_OVERLAY_TEMPLATE.json`](RUNTIME_DEPLOYMENT_OVERLAY_TEMPLATE.json), [`ASSURANCE_READINESS_OVERLAY_TEMPLATE.json`](ASSURANCE_READINESS_OVERLAY_TEMPLATE.json), and [`SOURCE_INTELLIGENCE_BUNDLE_TEMPLATE.json`](SOURCE_INTELLIGENCE_BUNDLE_TEMPLATE.json). Do not create new formats from scratch, rename required sections, omit required arrays, or substitute narrative prose.

Before sealing:

- replace every `__FILL_REQUIRED__` sentinel;
- use the exact allowed typed states from [`SOURCE_INTELLIGENCE_SCHEMA.json`](SOURCE_INTELLIGENCE_SCHEMA.json);
- bind the artifact to campaign/generation, exact source identity/digest, exact build identity/digest, compiler configuration, and Phase-1 execution evidence;
- keep structural facts separate from security interpretation;
- record explicit `NOT_APPLICABLE` or typed limitations instead of leaving required categories ambiguous;
- seal the filled campaign-local core first, then record its SHA-256 / immutable reference externally in the bundle index, Phase Report, and controller evidence. Do not place an artifact's own digest inside the bytes being hashed;
- validate each overlay against its supplied schema, commit it, calculate SHA-256, and only then update the bundle index;
- validate the bundle index, commit it, and record its immutable commit/digest externally before a phase relies on it.

The skill template itself remains unchanged. The filled campaign copy is stored with campaign evidence and may be named `SOURCE_INTELLIGENCE_v1.json`, `SOURCE_INTELLIGENCE_v2.json`, etc.

## Required structural fact families

The filled artifact must contain, as applicable:

1. source file inventory and exact source digests;
2. admitted compiler/build identities and compiler artifact index;
3. contract/type inventory;
4. ABI/public-external function inventory;
5. storage-layout inventory where supported;
6. inheritance graph;
7. static call/delegate/create/callback edges where deterministically observable;
8. raw privilege/access-control **candidates** and their source basis;
9. external interfaces/dependency touchpoints;
10. static asset/value-flow **candidates** and their source basis;
11. events/custom errors;
12. source anchors usable by later phases;
13. neutral Slither/SBOM/static-recon evidence references and candidates;
14. unsupported/incomplete extraction limitations.
15. Phase-1-owned structural security-surface inventory that joins the accepted source/contract/function/storage/interface/privilege/value-flow identifiers;
16. static upgradeability, dependency, cross-chain and offchain-automation topology edges where deterministically observable;
17. preliminary deployment-gas estimates emitted by the exact admitted compiler/build, explicitly marked `PRELIMINARY_NOT_PHASE7_ACCEPTED`;
18. stable routes to the runtime/deployment and assurance-readiness overlays, explicitly marked `NAVIGATIONAL_ONLY`.

A structural extractor must not silently promote an uncertain inference into fact. Use the per-record `basis` and `confidenceClass` fields.

## Universal later-phase reuse rule

For the same accepted source/build identity, later phases MUST use the latest accepted Source Intelligence bundle index and its pinned component revisions before doing work that requires structural source, runtime/deployment, or assurance-readiness knowledge.

Later phases MUST NOT recreate from scratch any already accepted Source Intelligence inventory solely for orientation or convenience, including:

- contract/file inventory;
- ABI/function-selector inventory;
- storage-layout inventory;
- inheritance relationships;
- basic direct-call/delegate/create edge inventory;
- raw privilege/modifier/access candidates;
- external-interface touchpoint inventory;
- raw static value/asset-flow candidate inventory;
- compiler artifact inventory;
- Phase-1 Slither candidate inventory.
- Phase-1 structural security-surface inventory;
- Phase-1 static upgradeability/dependency/cross-chain/offchain topology;
- Phase-1 inventory of existing harness/configuration/skeleton artifacts.

Instead they **REUSE -> VERIFY WHEN MATERIAL -> EXTEND SEMANTICALLY**.

This rule does **not** prohibit later phases from reading production source. Manual and adversarial phases still read source wherever semantic reasoning, line/flow review, contradiction checking, reachability analysis, reproduction, remediation verification, or finding validation requires it. The prohibited waste is rebuilding an already-sealed structural inventory as if Phase 1 never produced it.

## Relevant-section review requirement by phase

- **Phase 2:** review contracts/functions/storage/external interfaces/value-flow candidates/static recon needed to derive properties and risk assumptions. Do not rebuild those inventories.
- **Phase 3:** use inheritance/call graph/privilege candidates/external interfaces/value-flow candidates and accepted static protocol topology as the structural baseline for architecture, authority, trust-boundary, and threat-model reasoning. Build semantic attack/authority models; do not recreate raw structural inventories.
- **Phase 4:** use the Phase-1 `securitySurfaces` inventory as the manual coverage baseline and source-anchor map. Perform full source-first semantic review, record Phase-4 coverage/discrepancies/deltas in the Phase-4 registry, but do not reconstruct or silently mutate the Phase-1 inventory.
- **Phase 5:** use relevant accounting/value-flow/function/dependency sections to retrace economic and mathematical behavior; extend semantic models rather than re-inventorying code structure.
- **Phase 6:** use exact function/source/call/interface/property mappings plus the accepted assurance-readiness overlay revision to choose harness targets and coverage. Phase 6A validates adequacy and accepts a new overlay revision after any repair. Discovery of genuinely new **audit-only harness/test functions** remains permitted, but append them to a new validated overlay revision rather than recreating the Phase-1 inventory.
- **Phase 7:** use source/build/ABI/function/interface facts and the accepted runtime/deployment overlay revision as baselines. Verify live deployment/configuration identities, lifecycle evidence, and compiler-gas identity before accepting a new runtime overlay revision. Preliminary Phase-1 gas is never a substitute for Phase-7 acceptance.
- **Phase 8:** use source anchors, function/flow mappings, threat inputs, and static candidates when validating scope/reachability/reproduction. Re-open raw source for contradiction/semantic checks as needed.
- **Phase 9:** if remediation changes production source/build identity, the old core and bound overlay revisions are historical for the old source. Generate a new core, rebind/replace affected overlays, and accept a new bundle-index revision before relying on structural facts; then compare old/new intelligence for affected surfaces. If no relevant source/build change occurred, reuse the matching accepted bundle components.
- **Phase 10:** verify the final accepted bundle-index revision and every relied-on component revision/digest against the exact final release/source; reconcile component limitations into the assurance case/report.

## Mutable overlay acceptance transaction

An overlay update is not accepted until all steps complete in order:

1. preserve the prior accepted Git revision and immutable snapshot reference;
2. edit a campaign-local copy at the canonical mutable path;
3. validate the new bytes against the supplied overlay schema;
4. calculate the new SHA-256 and bind exact source/build plus phase-owned evidence;
5. classify the change under the Evidence Invalidation Matrix and create/reconcile `INV-*` and `OBL-*` records;
6. commit the new overlay revision and capture its immutable 40-character commit SHA;
7. update every bundle-index pointer field and commit the new index revision;
8. record the accepted component/index identities in the immutable Phase Report and any required successor handoff.

Never silently replace evidence used by a sealed phase. A sealed phase remains bound to the revisions in its report even when the canonical path later changes.

## Discrepancy rule

If a later phase discovers that accepted Source Intelligence is incomplete or incorrect for the exact same source/build:

1. do not silently overwrite the sealed artifact;
2. create a stable discrepancy/obligation record with exact source anchors/evidence;
3. classify whether the cause is extractor/tool error, missing supported output, or a semantic distinction outside Source Intelligence scope;
4. if structural evidence is wrong/incomplete, repair the generation process and create a replacement Source Intelligence revision through controller rework/invalidation;
5. preserve the prior artifact as historical evidence;
6. only the latest controller-accepted revision becomes the structural baseline.

## Invalidation rules

A Source Intelligence component is bound to exact production source and build identity plus its component-specific runtime/tool/harness identity.

- Production source change -> `INVALIDATES` affected Source Intelligence facts.
- Compiler/build-profile change -> `INVALIDATES` compiler/build/bytecode/storage and any downstream structural facts affected by compilation semantics.
- Slither/toolchain-only change -> core structural source/build facts may remain accepted, but the static-recon layer requires rebind/replacement according to the Evidence Invalidation Matrix.
- Documentation/report-only changes that provably do not alter executable source/build semantics -> preserve technical Source Intelligence.
- Remediation source delta -> generate a new Source Intelligence version before the remediated source becomes the current structural baseline.
- Runtime deployment/configuration or mutable overlay bytes change -> apply `EIM-014`, preserve the prior accepted revision, and require explicit Phase-7/10 rebind before reuse.
- Harness/config/tool/skeleton bytes or identity change -> apply `EIM-015` and require Phase-6A adequacy reassessment before Phase-6B/6C reuse.
- Preliminary/accepted gas build or lifecycle identity mismatch -> apply `EIM-016`; stale estimates cannot satisfy Phase-7 acceptance.

## Phase report requirement

Every Phase 1–10 report must contain the **Source Intelligence Bundle checkpoint** from `shared/reporting/PHASE_REPORT.md`, including the bundle-index revision/commit/digest and each materially relied-on component revision/commit/digest.

Phase 1 records `CREATED`. Later phases record at least one of:

```text
REUSED_VERIFIED
REUSED_WITH_LIMITATION
REGENERATED_NEW_SOURCE
INVALIDATED_PENDING_REPLACEMENT
NOT_APPLICABLE
```

and list the exact Source Intelligence sections materially reviewed in that phase.
