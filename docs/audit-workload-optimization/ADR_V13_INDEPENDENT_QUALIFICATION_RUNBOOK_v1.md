# ADR v13 — independent detection qualification (v1)

## Hard activation boundary

**V13 is NOT production-eligible until an independent seeded campaign reaches at least 30 confirmed detections out of 41 defects (baseline 14), flags ZERO known decoys, and produces ZERO Critical/High false positives on clean controls.** The test must be independently reviewed. Unit tests and synthetic 14/1/26 fixtures do **not** authorize activation.

The v13 gate is `packages/github-native-sim/src/adr-v13-release-gate-v1.mjs`. The Phase-0 intelligence workflow and Phase-4 discovery controller refuse to start new v13 campaigns if the gate is absent. Earlier frozen v12 campaigns are not automatically upgraded. Existing phase boundaries/receipts do not change on failed qualification.

## Private run inputs — never commit

Use a sealed truth manifest stored **outside the repository, campaign, artifact uploads, project chats, reviewer packets and workflow logs**. Provide its absolute path via `PRIVATE_SEEDED_TRUTH_FILE`. JSON schema:

```json
{
  "schemaVersion": "curveyield-private-seeded-truth-v1",
  "expectedDefects": 41,
  "baselineCaught": 14,
  "minCaught": 30,
  "cases": [
    {
      "caseId": "PRIVATE-CASE-ID",
      "kind": "defect",
      "severity": "HIGH",
      "classId": "ACCESS_CONTROL",
      "contract": "NamedContract"
    }
  ]
}
```

The actual manifest also includes separate `kind: "decoy"` and `kind: "clean_control"` cases. The example above is a shape example only, **not** a seeded campaign. Every `caseId` must be unique.

Independently audited agents work with the real frozen source, technical evidence, and the v13 review procedure **without access to the answer key**. A separate adjudicator, also not acting as a discovery reviewer, matches observed findings to private truth. Collect:

- `findings.json`: an array of objects with distinct `findingId`, `caseRefs` (array of private case IDs) and `severity`. Findings without source-supported adjudication do not count.
- `adjudications.json`: an array of `{ "caseId", "findingId", "match": "MATCH" | "NO_MATCH" }`; any `severityReadjudicated: true` requires a substantive `reason`.
- Optional `partial.json`: array of distinct private case IDs that were partially identified but not caught.
- Optional `leak-stages.json`: object mapping missed case IDs to pipeline stage labels for private diagnosis.

Do **not** publish findings containing answer-key case IDs or any partial/private diagnostic files. False-positive and catch counts are the only public qualification observations.

## Reproducible scoring, private environment only

Run from a trusted clone in an isolated CI environment whose filesystem can access the private manifest. Do not echo the manifest filename into public logs. No protocol deployment or Solidity compile is needed to run this scorer.

```bash
export PRIVATE_SEEDED_TRUTH_FILE=/private/secure/sealed-truth.json
node packages/github-native-sim/src/adr-seeded-score-cli-v1.mjs \
  /private/review/findings.json \
  /private/review/adjudications.json \
  /private/review/partial.json \
  /private/review/leak-stages.json \
  > /private/review/QUALIFICATION_SCORE_v1.json
```

Exit status **0** means the aggregate gate passed, **2** means a correctly evaluated but failed threshold, and **3** means an invalid input or another scorer failure. The scorer emits no raw private cases, source code, manifest path, private per-case IDs, or private case-level leak-stage references. It does emit totals by severity/class/contract, an aggregate critical/high miss count, and aggregate counts by leak stage.

A separate human review must verify the frozen source identity, complete/unchanged campaign, independent adjudication, actual score, decoys, clean controls, and materiality before signing off. **Do not create a qualification receipt just because a fixture test passes.**

## Minimal public production artifacts — only after success

Publish only two current live files in `process/qualification/adr-v13/`:

1. `QUALIFICATION_SCORE_v1.json`: exact unmodified UTF-8 bytes produced by the private scorer, with `schemaVersion: "curveyield-seeded-detection-score-v1"`, 41 defects, at least 30 caught, `decoysFlagged: 0`, `cleanControlCriticalHighFalsePositiveCount: 0`, and `gate.passed: true`.
2. `QUALIFICATION_PASS_v1.json`: a human-reviewed decision using this exact schema, with `scoreSha256` equal to the SHA-256 of the **whole score file bytes** (including newline):

```json
{
  "schemaVersion": "curveyield-adr-v13-qualification-pass-v1",
  "status": "QUALIFIED",
  "seededDefects": 41,
  "baselineCaught": 14,
  "caught": 30,
  "decoysFlagged": 0,
  "cleanControlCriticalHighFalsePositives": 0,
  "independentRunId": "REAL-INDEPENDENT-RUN-ID",
  "reviewedBy": "REAL-HUMAN-REVIEWER",
  "scoreSha256": "64_lowercase_hex_characters"
}
```

The numbers shown are the minimum qualifying example, **not** evidence that v13 passed. Do not publish placeholder receipts. The gate verifies both the receipt and score file, recomputes the score hash, verifies their counters match, and fails closed on missing, mismatched, malformed, fractional, or subthreshold values. The score file is an evidence artifact; it does not become another reviewer work form.

## Verification before enabling v13

From the exact release checkout run the following in GitHub CI (not on the local workstation):

```bash
node --input-type=module -e 'import {verifyV13ReleaseV1} from "./packages/github-native-sim/src/adr-v13-release-gate-v1.mjs"; console.log(verifyV13ReleaseV1({repoRoot:process.cwd()}))'
node --test packages/github-native-sim/test/adr-v13-release-gate-v1.test.mjs
```

Only a genuine passing external 41-defect run may create the two release artifacts. A v13 audit must still separately pass the ordinary inventory, review, deployment, evidence, targeted-test, and final controller gates. This qualification does **not** replace them.

## Rollback / safety

If v13 underperforms, is unqualified, or emits unsupported findings, withhold both public qualification artifacts. The activation gate blocks new v13 work; the previously frozen v12 workflow continues unchanged. Never add a waiver to skip the gate, mutate sealed v12 campaign receipts, or commit the private answer key.
