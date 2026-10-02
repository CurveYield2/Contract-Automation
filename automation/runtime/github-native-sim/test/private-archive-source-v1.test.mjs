import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateDeepAssuranceRequestV2 } from '../src/schema.mjs';
import * as execution from '../src/execution.mjs';

const commit = (c) => c.repeat(40);
const sha = (c) => c.repeat(64);

function phase7Request(sourceOverrides = {}) {
  return {
    schemaVersion: 'deep-assurance-github-request-v2',
    processId: 'audit-v7-independent-review',
    contractAutomationRelease: {
      repository: 'CurveYield2/Contract-Automation',
      branch: 'recovery/v7-execution-layer-v1',
      commit: '612fa50264e587e3f24550bf4dae35719b04211c',
      contractVersion: 'contract-automation-v7-relocated-v1'
    },
    runnerRelease: {
      version: 'deep-assurance-github-bridge-v1',
      manifestSha256: '2bebd99bb8ae770eb2feca0de7dc7e54596127a0c768922189e907e6658773dc'
    },
    campaignId: 'boosthub-staking-v2',
    assignmentId: 'reviewer-2-phase-7-v1',
    phaseId: 'fork-simulation-lifecycle',
    gateId: 'fork-simulation-lifecycle-complete',
    profileId: 'github-native-simulate-v2',
    source: {
      repository: 'CurveYield2/Solo-Audit-Controller',
      commit: commit('1'),
      projectPath: 'CurveYield-BoostHub-v2',
      archivePath: 'campaigns/CurveYield-BoostHub-v2.zip',
      archiveSha256: sha('2'),
      ...sourceOverrides
    },
    configuration: {
      compilers: [
        { language: 'solidity', version: '0.8.28' },
        { language: 'vyper', version: '0.4.3' }
      ],
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
      viaIR: true,
      timeoutMinutes: 20,
      deploymentGas: {
        deployableContracts: [{ sourceName: 'contracts/Vault.sol', contractName: 'Vault' }]
      },
      simulation: {
        chain: 'ethereum',
        block: 25737717,
        workflow: { steps: [{ action: 'staticCall', target: '0x0000000000000000000000000000000000000001', function: 'owner() view returns(address)' }] }
      },
      analysis: { slither: false, medusa: false, nativeFuzz: { enabled: false } }
    },
    requestId: `dar-${'3'.repeat(32)}`,
    requestDigest: sha('4')
  };
}

test('V7 request schema accepts an exact private ZIP source binding', () => {
  const validated = validateDeepAssuranceRequestV2(phase7Request());
  assert.equal(validated.source.archivePath, 'campaigns/CurveYield-BoostHub-v2.zip');
  assert.equal(validated.source.archiveSha256, sha('2'));
});

test('V7 request schema rejects incomplete or unsafe archive source bindings', () => {
  assert.throws(() => validateDeepAssuranceRequestV2(phase7Request({ archiveSha256: undefined })), /archiveSha256/);
  assert.throws(() => validateDeepAssuranceRequestV2(phase7Request({ archivePath: '..\/secret.zip' })), /archivePath/);
  assert.throws(() => validateDeepAssuranceRequestV2(phase7Request({ archiveSha256: 'not-a-sha' })), /archiveSha256/);
});

test('stageExactArchiveSource verifies digest and extracts only safe entries under an isolated root', async () => {
  assert.equal(typeof execution.stageExactArchiveSource, 'function', 'stageExactArchiveSource must be exported');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v7-archive-stage-'));
  const checkoutRoot = path.join(root, 'checkout');
  const workspaceRoot = path.join(root, 'workspace');
  await fs.mkdir(path.join(checkoutRoot, 'campaigns'), { recursive: true });
  const archive = path.join(checkoutRoot, 'campaigns', 'CurveYield-BoostHub-v2.zip');
  await fs.writeFile(archive, Buffer.from('fixture-zip-bytes'));
  const digest = createHash('sha256').update(Buffer.from('fixture-zip-bytes')).digest('hex');
  const entries = [
    { path: 'CurveYield-BoostHub-v2/', type: 'Directory', vars: {}, async buffer() { return Buffer.alloc(0); } },
    { path: 'CurveYield-BoostHub-v2/contracts/boosthub/vyper/BoostHubStaking-v16.vy', type: 'File', vars: {}, async buffer() { return Buffer.from('# @version 0.4.3\n'); } },
    { path: 'CurveYield-BoostHub-v2/package.json', type: 'File', vars: {}, async buffer() { return Buffer.from('{"private":true}\n'); } }
  ];

  const staged = await execution.stageExactArchiveSource({
    checkoutRoot,
    workspaceRoot,
    archivePath: 'campaigns/CurveYield-BoostHub-v2.zip',
    archiveSha256: digest,
    projectPath: 'CurveYield-BoostHub-v2'
  }, {
    openArchive: async () => ({ files: entries })
  });

  assert.equal(staged.archiveSha256, digest);
  assert.equal(staged.projectRoot, path.join(workspaceRoot, 'archive-source', 'CurveYield-BoostHub-v2'));
  assert.equal(await fs.readFile(path.join(staged.projectRoot, 'package.json'), 'utf8'), '{"private":true}\n');
});

test('stageExactArchiveSource rejects ZIP traversal and symlink entries', async () => {
  assert.equal(typeof execution.stageExactArchiveSource, 'function', 'stageExactArchiveSource must be exported');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v7-archive-reject-'));
  const checkoutRoot = path.join(root, 'checkout');
  await fs.mkdir(path.join(checkoutRoot, 'campaigns'), { recursive: true });
  const archive = path.join(checkoutRoot, 'campaigns', 'target.zip');
  await fs.writeFile(archive, Buffer.from('fixture-zip-bytes'));
  const digest = createHash('sha256').update(Buffer.from('fixture-zip-bytes')).digest('hex');

  await assert.rejects(() => execution.stageExactArchiveSource({
    checkoutRoot,
    workspaceRoot: path.join(root, 'workspace-a'),
    archivePath: 'campaigns/target.zip',
    archiveSha256: digest,
    projectPath: 'target'
  }, {
    openArchive: async () => ({ files: [{ path: '../escape.sol', type: 'File', vars: {}, async buffer() { return Buffer.from('x'); } }] })
  }), /unsafe archive entry/i);

  await assert.rejects(() => execution.stageExactArchiveSource({
    checkoutRoot,
    workspaceRoot: path.join(root, 'workspace-b'),
    archivePath: 'campaigns/target.zip',
    archiveSha256: digest,
    projectPath: 'target'
  }, {
    openArchive: async () => ({ files: [{ path: 'target/link', type: 'File', vars: { externalFileAttributes: (0o120777 << 16) >>> 0 }, async buffer() { return Buffer.from('dest'); } }] })
  }), /symlink/i);
});
