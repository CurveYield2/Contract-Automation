# Test and Acceptance Plan v2

Status: finite implementation qualification plan, not a passing test report. Map cases to requirements in [system specification v2](PHASE0_AUTOMATED_TESTING_SYSTEM_SPEC_v2.md) and [data contracts v2](PHASE0_EXECUTION_DATA_CONTRACTS_v2.md). All compilation, dependency installation and execution occur in GitHub. Reuse current test/qualification workflows, one mutable execution lane at a time.

## 1. Qualification fixtures and generality

Choose existing proven fixtures in this repository first, then matched official dependency fixtures if needed. Copy/adapt the smallest useful fixture; do not build a second runner. Record provenance, exact revision and modifications.

The acceptance set must include:
1. A plain token with a qualified implementation/standard recipe.
2. A share-vault fixture with a known executable property and typed asset/share observations.
3. A multi-contract router/facade system including delegate-only/context-required methods and tuple-array actions.
4. A renamed/reordered held-out packet, with addresses/IDs produced only at runtime.
5. An unknown custom contract with a standard-looking ABI but insufficient semantic basis.
6. A deployment packet with missing normalized-chain dependencies, multiple script variants and pending handoff actions.

Fixtures 1–4 prove positive supported behavior without packet-specific edits or interactive prompts. Fixtures 5–6 prove automatic truthful gaps and safe completion, not universal property invention. Hold out packet naming/layout variants until after implementation; the same generator/recipe registry must process them unchanged. A conditional keyed to "CurveYield", an audit/campaign name, fixed target address or a fixture's known owner invalidates generality acceptance.

The retained CurveYield DEX v16 r3 source is the integration regression packet, not the only qualification target. Treat its sealed run as historic discovery evidence; do not mutate its admitted state or trigger a successor to run the regression.

## 2. Mandatory behavioral acceptance matrix

| ID | Requirement | Verification and required result |
|---|---|---|
| A01 | S-01; upstream reuse | Feed existing build/SI/ABI/Slither/readiness products. No rerun of Slither/function indexing/full SI occurs. Full exported artifacts avoid a second default build. |
| A02 | Section 3.0 | Fresh run succeeds with exact producer-bound technical SI before bundle seal; no dependency on a future canonical core. Rework uses accepted immutable refs. |
| A03 | S-01–02 | Alter source/build/profile/generation/ABI digest independently: each mismatch fails binding. Null compiler input identity cannot be promoted to exactness. |
| A04 | S-02 | All admitted ABI callable rows reconcile, including overloads, receive/fallback and non-instantiated contracts. Every unavailable context has a reason; no weighting omission. |
| A05 | S-06 | Round-trip nested tuples, tuple arrays, signed minima/maxima, bytesN and fixed arrays of length >4. Exact bytes/selector/signature match; resource overflow is explicit. |
| A06 | S-03–04 | Constructor/configuration graph reuses packet evidence; no arbitrary dependency address. Unsupported script has a per-script disposition; another script's success cannot hide it. |
| A07 | S-04 | Exact script and adapted copy have distinct evidence/digests. Normalized token/chain/dependency substitutions stay visible and cannot establish production handoff. |
| A08 | S-04 | A harmless fixture script attempting access outside the admitted environment is blocked. No production/GitHub/upstream RPC secret reaches child code or retained output. |
| A09 | S-05 | Qualification traces show actual target caller/value. Distinguish direct EOA, wrapper, facade and declared privileged simulation. Wrong-context calls do not count as valid-context coverage. |
| A10 | S-05 | Delegate-only method succeeds through its supported facade and is separately rejected by direct invocation; a callback-only method is exercised through a qualified protocol flow. |
| A11 | S-08 | Failed/expired evm_revert or altered sentinels blocks reuse. Two reconstructed baseline runs replay the same serialized action sequence and declared outcomes. |
| A12 | S-07 | Unknown/lookalike interface returns an automatic recipe/oracle gap; no custom economic assertion is generated from its name. |
| A13 | M-01–02 | Discovery reports >100,000 observed tool calls when required, with target/harness/check denominators separated. Checked mode has actual engine-discovered no-argument bool tests. |
| A14 | M-02, M-08 | The old all-disabled/zero-test config cannot satisfy checked mode even with 138,521 calls, exit zero and nonempty corpus. |
| A15 | M-03 | False and true control properties on owned fixtures are discovered/executed and produce corresponding native outcomes. Those controls never appear as target assurance. |
| A16 | M-03–04 | A conditional property whose precondition never becomes true is UNEXERCISED. A missing balance getter is OBSERVATION_GAP. Neither becomes checked/no-deviation. |
| A17 | M-03 | A harness counter identity alone cannot satisfy target-check completion. At least one applicable target property has a successful qualifying-state witness and execution evidence. |
| A18 | M-04 | Qualified token/share-vault recipes account for supported burns/fees/yield/units. Unsupported variants return a gap instead of a false conservation rule. |
| A19 | M-05–06 | Tuple/context variants are present; all ready functions retain exploration opportunity. Achieved weights derive from actual dispatches, not duplicated wrapper counts. |
| A20 | M-06 | A retained new target coverage/transition observation changes later seed/action selection. Harness-only coverage cannot satisfy target coverage. Missing coverage feedback blocks that capability. |
| A21 | M-07 | Low-level false/revert data and selected panics survive the wrapper and raw retention. Expected rejection remains a rejection; a property deviation is a neutral signal. |
| A22 | T-01 | transferOwnership is authority/configuration; empty multicall is no-op; economic action requires qualified basis and effect evidence. Mutability and family are independent. |
| A23 | T-02–04 | Registered entities/roles/allowances are used. Repeated wrong-context failure triggers bounded adaptation/gap, and ready actions in other contracts continue. |
| A24 | T-03 | Configuration/ownership changes use resettable variants and cannot destroy the useful economic fixture or dominate its claimed positive witnesses. |
| A25 | T-04 | Four shards retain 1,200 main attempts where required, revisit contracts and respect declared weights. Setup/reads/properties do not inflate main attempts. |
| A26 | T-05 | EstimateGas rejection, encoding failure, mined status-zero revert, successful receipt, RPC error and unknown submitted outcome each have the correct distinct terminal record. |
| A27 | T-06–07 | Token balances/allowances, shares/debt/positions where applicable, exact state anchors and actual transaction fees are retained. Gas-only change cannot become economic movement. |
| A28 | T-06 | Failed nested/getter/caller-context observations remain UNKNOWN. Incomplete required observation plan cannot become complete accounting data. |
| A29 | T-08 | All supported lifecycle families have a successful body/transition witness or an explicit reachability gap. Global success percentage is never the sole acceptance rule. |
| A30 | Data §§4–7 | Recompute every summary counter from raw rows: exact agreement and disjoint terminal outcome partition. Duplicate/missing rows and digest/reference mismatch fail validation. |
| A31 | Data §8 | Legacy quantity-only imported PASS remains legacy discovery; cannot satisfy upgraded properties, actor semantics or positive-transition acceptance. |
| A32 | Integration | New property/reachability/observation fields reach existing downstream inputs and final limitations by reference; controller-owned prefills stay protected. |
| A33 | Integration | Fault an eligible required lane; failed attempt evidence survives and independent safe observations finish where possible. Finalizer never launches a successor on failed required acceptance. |
| A34 | Completion | No program/fixture assertion or static signal is assigned vulnerability severity or called a security verdict by Phase-0 automation. |

Cases must be behavioral rather than string searches that merely assert the implementation contains a configuration literal. Retain existing static wiring tests where useful, but they do not replace real engine/context/outcome verification.

## 3. CurveYield regression interpretation

Read the original four transcripts and Medusa config/log as fixed inputs to offline summary/importer regression tests. Expected interpretation:
- 4,800 attempts; 4,667 estimate/preflight rejections; zero mined revert receipts in those rejected rows;
- 133 mined successes, including 119 ownership requests, ten hook calls, four empty multicalls;
- recorded gas-only numeric delta, no evidence of completed swaps/liquidity/settlement/migration from those successful rows;
- no target property assurance from the retained Medusa execution.

Then run the upgraded automation against the unchanged packet in an isolated fixture. It must consume the existing upstream indexes, route the formerly omitted supported tuple inputs, preserve caller/context, distinguish failed normalized script variants, and demonstrate positive transitions for each matched supported lifecycle family. For the matched Balancer-style recipe, qualification must include pool creation/initialization and at least one actual liquidity operation and swap where dependencies are resolved, with underlying caller/body/state witnesses. Settlement/migration families need automatic applicability, positive witnesses when supported, or typed gaps rather than an invented success.

No one-off campaign fix may qualify the universal program. A remaining genuine unsupported family is an evidence limitation, not permission to hide it. A family advertised as supported that has no positive witness is a failed implementation acceptance item.

## 4. Performance qualification

Benchmark on the same fixture/build/fork reconstruction and serialized decisions:
- baseline and upgraded short telemetry runs with at least three recorded seeds;
- a comparable positive-path fixture, not just rejected calls;
- full upgraded four-shard telemetry and >100,000-call discovery baseline;
- enabled check lane separately so extra work is visible.

Report RPC calls by stage, observation coverage, useful transitions/minute, wall-clock distribution, CPU/memory and artifact bytes. Control RPC variability and disclose unpaired conditions. Optimize excessive all-target reads and repeated encoding/interface preparation while preserving observation completeness. Do not advertise a speedup from omitted required reads or skipped checks. Require declared resource budgets to hold; investigate material regressions before acceptance, with concrete causes and retained measurements.

## 5. GitHub qualification and end state

Extend existing package tests and the current qualification workflow. Run focused behavioral cases first, then required affected repository regression/authority checks. Complete live engine/fork qualification on the admitted GitHub execution lane with secrets available. No local build/dependency install, duplicate browser/workflow, or per-retry workflow creation.

Authority/schema changes require paired checks and ZIP/manifest consistency before enabling stronger gates. Verify the changed producer → run index → importer/finalizer → downstream consumer graph. The earlier broader all-phase sweep in this folder is not automatically activated; only changed interfaces and required existing regressions are current scope.

An implementation is complete only when A01–A34 are verified, supported families have witnesses, unsupported behavior is truthfully routed, target checks cannot pass vacuously, raw/structured evidence agrees, resource budgets hold, and applicable qualification is green. Record exact commits, runs, artifact digests and remaining semantic limitations. A specification, passing linter or high call count alone is not completion.
