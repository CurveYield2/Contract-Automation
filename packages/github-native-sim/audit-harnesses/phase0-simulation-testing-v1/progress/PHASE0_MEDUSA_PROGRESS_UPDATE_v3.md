# Phase 0 Medusa progress update v3

Updated: 2026-09-30

Location: isolated Phase-0 simulation harness.

## Consolidated historical status

This file consolidates the former root-level `PHASE0_MEDUSA_PROGRESS_UPDATE_v1.md` and `PHASE0_MEDUSA_PROGRESS_UPDATE_v2.md` so Medusa campaign notes live with the isolated simulation harness instead of repository root.

### Initial failure and repair

- Native deployment compiled 37 artifacts, deployed all 32 planned contracts, executed configuration transactions, and passed package code/configuration checks.
- The deployment-script budget was increased from 240 to 900 seconds with progress heartbeats after an earlier compilation timeout.
- Deployment mapping was repaired to preserve authoritative package report names.
- The first Medusa run exited 6 with zero observed fuzz calls.
- A focused diagnostic identified invalid Solidity address checksums in the generated Medusa router.
- The repaired retained router compiled with Solidity 0.8.28 and produced 36,891 creation bytes / 36,863 runtime bytes.
- Medusa permits oversized test routers by default; production artifacts separately passed the package EIP-170/EIP-3860 size checks.

### Verified passing Medusa run

Isolated run `36725469642` succeeded on commit `793f1176b70b029050651213b5dcac7e233d2fa4`.

- Native source deployment: PASS; all 32 planned contracts deployed and package configuration checks passed.
- Compiled source targets: 37; missing compiled targets: 0.
- Mutable deployed targets: 27.
- Medusa: PASS; exit code 0.
- Observed calls: 130,487 against a configured 125,000 call limit.
- Medusa runtime: 33 seconds.
- Generated real-ABI router: 245 wrappers; accounting wrapper share 80%.
- Retained corpus: 263 indexed files.
- Raw evidence artifact size: 13,117,861 bytes.
- Raw evidence SHA-256: `ab5dfc43a7a3c2373f0531fcf1407bdd4c1afc82c1d7eead82059f1cf28be168`.
- Telemetry was intentionally not rerun as part of the Medusa-only attempt.

## Interpretation

The passing Medusa run proves randomized baseline execution completed; it is not by itself a security conclusion. Unsupported router parameter types and downsampled non-accounting wrappers remain limitations recorded in the retained evidence.

## Historical sequencing

After Medusa passed, telemetry-only execution was the next isolated step. Canonical Phase-0 promotion, qualification/rebind, receipt sealing, and browser-agent launch were later steps and were not part of the Medusa-only run.

This is the only retained Medusa progress-update file for this isolated harness.
