# Phase 6 Harness Skeleton Kit v1 — DEPRECATED

**DO NOT instantiate this version for new Audit V7 work.** It predates the mandatory existing-mutable-Anvil-RPC binding. The active kit is `packages/github-native-sim/harness-skeletons-v2/`.

Any agent reading this historical directory MUST return to `AGENTS.md` and the v2 kit before authoring or executing Phase 6 harnesses. In particular, do not use the v1 Medusa configs as runtime policy: current Phase 6 Medusa must run in fork mode through `SIM_ARCHIVE_PRIMARY_ETHEREUM_01`, and current Foundry must use the same preflight-frozen fork identity.

Historical purpose: repo-native templates for Audit V7 Phase 6 harness authoring in `CurveYield2/Contract-Automation` before the mandatory shared mutable-RPC policy was introduced.

The v1 files remain only for provenance and comparison. They are not authoritative execution templates.
