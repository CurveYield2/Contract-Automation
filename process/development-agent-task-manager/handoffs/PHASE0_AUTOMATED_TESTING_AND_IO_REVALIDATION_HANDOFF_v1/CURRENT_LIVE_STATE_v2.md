# Current Live State v2

Verified 2026-10-04. Task: specifications for the existing automated Medusa and telemetry repair. State: SPECIFICATIONS_READY_FOR_IMPLEMENTATION. Source, campaign and programs are unchanged by this docs-only proposal.

## Code and authority snapshot

- Contract-Automation main: 87664a72c125bb83827f114087fb6e38f99b6750; tree fetched non-truncated through the GitHub connector.
- Audit-Controller main/review source snapshot: 78943917711d0c56ebedd2ddc4ec267d1b1efc89.
- Current/campaign authority: Audit_Litemode_v10.3 under Audit Skill - Current Authority/. Root SKILL.md blob cae372a440bc9e08d66db8a606a098e6532bf86e.
- Primary program: packages/github-native-sim/src/phase0-randomized-simulation-v1.mjs, blob 8de3d4af80897fb7fd1009bded338f34ff9f8de1.
- Refresh main before implementation; snapshot pins are evidence, not instructions to reset newer valid work.

The primary blob hash above is checked against the repository tree during document verification. The isolated engine at audit-harnesses/phase0-simulation-testing-v1/ is not the production entrypoint.

## Existing upstream products verified

The technical SI already contains 37 compiled artifact records, 910 indexed functions, 1,350 call edges, 336 privilege candidates, 429 external-interface candidates and 209 source anchors. The Slither artifact is terminal COMPLETED with 203 detector records. These are neutral structural candidates and retain their confidence/semantic limitations.

Full upstream ABI/bytecode transfer must be inspected: technical SI contains digests/method identifiers/signatures rather than full executable artifacts. Consumers join available facts and extend the existing producer export only where needed. No new Slither/ABI/SI discovery pass is part of the proposed preparation layer.

Fresh-run ordering is technical intelligence → simulation/deployment → canonical core/bundle projection/seal. Accepted sealed bundle identities are used for reuse/rework, not demanded before fresh simulation.

## Retained r3 evidence interpretation

Campaign: curveyield-dex-v16-source-r3; generation curveyield-dex-v16-source-r3-g1-20261004T045225Z. Source ZIP SHA-256: 201a70f61f14e1919d111a972d090b07cf13e5fc06fee10738785adfb6760f4e.

Medusa: 138,521 tool calls; property/assertion testing disabled; zero passed/failed tests. Low-level wrappers record failures, and tuples/selected other functions are omitted.

Telemetry: four raw transcripts, 1,200 records each. 4,667 rejections occurred at estimateGas with no mined transaction receipts. 133 mined successes: 119 ownership-transfer requests, ten hook calls, four empty multicalls. Native sender gas was the only recorded numeric delta. This is weak economic-transition evidence, not thousands of validated vulnerabilities.

Raw top rejection classes: NotOwner 2,194; NotVaultDelegateCall 615; SenderIsNotVault 193; SenderNotAllowed 172. Other classes retain raw records and are not automatically expected bugs or expected defenses.

## Campaign-data review already prepared

Audit-Controller [draft PR #113](https://github.com/CurveYield2/Audit-Controller/pull/113) contains PHASE_01_QUALITY_REVIEW_v1.md and PHASE_01_WORK_FORM_v2.json at commit 40b680974c6bea5e4e4c031167fa1957291dced3. The candidate modifies 20 substantive fields, preserving controller inputs, dependency identities, formal obligations and HIGH risk grade.

The accepted campaign remains waiting for the Phase-2 successor at the reviewed snapshot. The candidate is unsealed; specs do not adopt/reseal it. Another execution/authority change needs typed rework/rebind rather than changing sealed evidence.

## Exact resume point

Implement the shared upstream-input consumer first using the v2 specifications. Programs have not been upgraded; no new property results, simulations, builds, workflows, campaign rework or successor wakes were performed for this documentation task. Required implementation qualification is defined by A01–A34. No new runtime result has been fabricated.
