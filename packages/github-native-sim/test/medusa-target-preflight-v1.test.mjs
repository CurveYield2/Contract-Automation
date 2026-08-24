import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { digestDirectory } from '../src/phase6-staged-snapshot-v1.mjs';
import {
  prepareTargetMedusaSmokeV1,
  runTargetMedusaPreflightV1,
} from '../src/medusa-target-preflight-v1.mjs';

const TEST_ROOT = path.dirname(fileURLToPath(import.meta.url));
const RUNNER_ROOT = path.resolve(TEST_ROOT, '../../..');
const REAL_HARNESS = path.join(RUNNER_ROOT, 'packages/github-native-sim/audit-harnesses/cyvlsdt-v30-phase6-vault-v1');
const COMMIT = 'a'.repeat(40);
const BLOCK_HASH = '0x' + 'b'.repeat(64);

async function tempRoot(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'medusa-target-preflight-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('target smoke copies the real cyvlSDT vault harness and only bounds disposable campaign work', async (t) => {
  const root = await tempRoot(t);
  const sourceDigest = await digestDirectory(REAL_HARNESS);
  const prepared = await prepareTargetMedusaSmokeV1({
    projectRoot: REAL_HARNESS,
    smokeRoot: path.join(root, 'smoke'),
    expectedSnapshotDigest: sourceDigest.digestSha256,
    testLimit: 32,
  });

  assert.equal(prepared.sourceSnapshotDigest, sourceDigest.digestSha256);
  assert.equal(prepared.originalConfig.fuzzing.testLimit, 100000);
  assert.equal(prepared.smokeConfig.fuzzing.testLimit, 32);
  assert.equal(prepared.smokeConfig.fuzzing.testing.propertyTesting.enabled, true);
  assert.equal(prepared.smokeConfig.fuzzing.testing.stopOnNoTests, true);
  assert.deepEqual(prepared.smokeConfig.fuzzing.targetContracts, prepared.originalConfig.fuzzing.targetContracts);
  assert.deepEqual(prepared.smokeConfig.compilation, prepared.originalConfig.compilation);

  const original = JSON.parse(await fs.readFile(path.join(REAL_HARNESS, 'medusa.json'), 'utf8'));
  assert.equal(original.fuzzing.testLimit, 100000, 'preflight must never mutate the real harness');
});

test('target preflight converts a real-target Medusa smoke into the dedicated Medusa receipt', async (t) => {
  const root = await tempRoot(t);
  const sourceDigest = await digestDirectory(REAL_HARNESS);
  const receipt = await runTargetMedusaPreflightV1({
    sourceCommit: COMMIT,
    projectRoot: REAL_HARNESS,
    snapshotDigestSha256: sourceDigest.digestSha256,
    harnessOverlayDigestSha256: 'c'.repeat(64),
    rpcUrl: 'http://127.0.0.1:8545',
    rpcProfile: 'SIM_ARCHIVE_PRIMARY_ETHEREUM_01',
    rpcBlock: 123456,
    rpcBlockHash: BLOCK_HASH,
    workspaceRoot: root,
  }, {
    runMedusa: async (input) => ({
      backend: 'medusa', version: '1.5.1', sourceCommit: input.sourceCommit,
      status: 'completed', terminal: true, componentStatus: 'COMPLETED',
      continuationDisposition: 'COMPLETE_EVIDENCE',
      fork: { blockNumber: input.rpcBlock, blockHash: input.rpcBlockHash, rpcUrlExposed: false },
      campaign: {
        status: 'completed', falsifiedProperties: 0,
        properties: [
          { name: 'property_totalSupplyMatchesActorShares', status: 'passed' },
          { name: 'invariant_restartReachability', status: 'passed' },
        ],
      },
      rawOutput: { exitCode: 0, stdout: '⇾ [PASSED] Property Test: property_totalSupplyMatchesActorShares\n⇾ [PASSED] Property Test: invariant_restartReachability', stderr: '' },
    }),
  });

  assert.equal(receipt.status, 'PREFLIGHT_PASS');
  assert.equal(receipt.operationClass, 'medusa');
  assert.equal(receipt.targetSmoke.testLimit, 32);
  assert.equal(receipt.targetSmoke.actualProjectCopy, true);
  assert.equal(receipt.checks.find((entry) => entry.id === 'medusa.property-discovery').status, 'PASS');
});

test('historical mixed Vyper sourceMap crash is typed before substantive campaign', async (t) => {
  const root = await tempRoot(t);
  const sourceDigest = await digestDirectory(REAL_HARNESS);
  const receipt = await runTargetMedusaPreflightV1({
    sourceCommit: COMMIT,
    projectRoot: REAL_HARNESS,
    snapshotDigestSha256: sourceDigest.digestSha256,
    harnessOverlayDigestSha256: 'c'.repeat(64),
    rpcUrl: 'http://127.0.0.1:8545', rpcProfile: 'SIM_ARCHIVE_PRIMARY_ETHEREUM_01',
    rpcBlock: 123456, rpcBlockHash: BLOCK_HASH, workspaceRoot: root,
  }, {
    runMedusa: async (input) => ({
      backend: 'medusa', version: '1.5.1', sourceCommit: input.sourceCommit,
      status: 'failed', terminal: true, failureKind: 'EVIDENCE_PARSE_FAILURE', componentStatus: 'FAILED',
      rawOutput: { exitCode: 1, stdout: '', stderr: "crytic-compile 0.4.2 KeyError: 'sourceMap'" },
    }),
  });
  assert.equal(receipt.status, 'PREFLIGHT_FAIL');
  assert.equal(receipt.firstFailure, 'MEDUSA_CRYTIC_COMPILE_FAILURE');
  assert.equal(receipt.diagnostics[0].historicalSignatureId, 'MEDUSA-006');
  assert.equal(receipt.doNotExecute, true);
});

test('Phase 6 runner source requires target Medusa preflight before substantive execution copy', async () => {
  const runner = await fs.readFile(path.join(RUNNER_ROOT, 'packages/github-native-sim/src/run-job-file-v2.mjs'), 'utf8');
  assert.match(runner, /runTargetMedusaPreflightV1/);
  const targetGate = runner.indexOf('runTargetMedusaPreflightV1');
  const executionCopy = runner.indexOf('copyPhase6SnapshotForExecution');
  assert.ok(targetGate >= 0 && executionCopy >= 0 && targetGate < executionCopy,
    'actual-target Medusa smoke must gate Phase 6 before the substantive execution copy');
});
