import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectNativeBuild, compileRepoNativeHardhat } from '../../runner/src/native-build.mjs';
import { runGitHubNativeJob } from '../src/run-job-file.mjs';

const commit = (c) => c.repeat(40);
const sha = (c) => c.repeat(64);

function request(profileId = 'github-native-compile-v2') {
  return {
    schemaVersion: 'deep-assurance-github-request-v2',
    processId: 'deep-assurance-v6',
    contractAutomationRelease: {
      repository: 'CurveYield/contract-automation',
      branch: 'orchestrator/round4-ci-base-v1',
      commit: 'ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8',
      contractVersion: 'contract-automation-finalized-v1'
    },
    runnerRelease: {
      version: 'deep-assurance-github-bridge-v1',
      manifestSha256: 'd32cfca35524606a5c85e98fb3dec1bba58bff8a4bc73466ccef496ceab79734'
    },
    campaignId: 'campaign-1',
    assignmentId: 'assignment-1',
    phaseId: 'phase-1',
    gateId: 'exact-build-static-analysis',
    profileId,
    source: {
      repository: 'CurveYield/Audits',
      commit: commit('1'),
      projectPath: 'audit-targets/example'
    },
    configuration: {
      compilers: [{ language: 'solidity', version: '0.8.28' }],
      timeoutMinutes: 20,
      analysis: { slither: { version: '0.11.6' } }
    },
    requestId: `dar-${'2'.repeat(32)}`,
    requestDigest: sha('3')
  };
}

async function hardhatFixture({ lockfile = true } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v7-native-build-'));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true, devDependencies: { hardhat: '2.29.0' } }));
  await fs.writeFile(path.join(root, 'hardhat.config.js'), 'module.exports = { solidity: "0.8.28" };\n');
  if (lockfile) await fs.writeFile(path.join(root, 'package-lock.json'), '{"name":"fixture","lockfileVersion":3,"packages":{}}\n');
  return root;
}

test('Hardhat native build admission requires a committed npm lockfile', async () => {
  const root = await hardhatFixture({ lockfile: false });
  await assert.rejects(detectNativeBuild(root), /Hardhat exact build requires a committed npm lockfile/);
});

test('Hardhat native build is detected only after config and lockfile admission', async () => {
  const root = await hardhatFixture();
  const detected = await detectNativeBuild(root);
  assert.equal(detected.system, 'hardhat-native');
  assert.equal(detected.lockfile, 'package-lock.json');
  assert.equal(detected.config, 'hardhat.config.js');
});

test('Hardhat native build runs locked dependency install then repository-native compile and records build-info digests', async () => {
  const root = await hardhatFixture();
  await fs.mkdir(path.join(root, 'artifacts-v20', 'build-info'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts-v20', 'build-info', 'build-a.json'), '{"solcVersion":"0.8.28"}\n');
  const calls = [];
  const result = await compileRepoNativeHardhat({
    projectRoot: root,
    runCommand: async (call) => {
      calls.push(call);
      return { exitCode: 0, stdout: call.command === 'npx' ? 'Compiled successfully\n' : '', stderr: '' };
    }
  });
  assert.deepEqual(calls.map((call) => [call.command, ...call.args]), [
    ['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund'],
    ['npx', '--no-install', 'hardhat', 'compile']
  ]);
  assert.equal(result.system, 'hardhat-native');
  assert.equal(result.status, 'completed');
  assert.equal(result.buildInfo.length, 1);
  assert.equal(result.buildInfo[0].path, 'artifacts-v20/build-info/build-a.json');
  assert.match(result.buildInfo[0].sha256, /^[0-9a-f]{64}$/);
});

test('compile-v2 executes exact checkout and build before neutral Slither', async () => {
  const calls = [];
  const result = await runGitHubNativeJob(request(), {
    workspaceRoot: '/tmp/v7-compile-v2',
    checkoutSource: async (source) => {
      calls.push('checkout');
      assert.equal(source.commit, commit('1'));
      return { checkoutRoot: '/tmp/v7-compile-v2/checkout', projectRoot: '/tmp/v7-compile-v2/checkout/audit-targets/example', commit: source.commit };
    },
    buildProject: async () => {
      calls.push('build');
      return { status: 'completed', system: 'hardhat-native', compilerVersion: '0.8.28', artifacts: [] };
    },
    runSlither: async () => {
      calls.push('slither');
      return {
        backend: 'slither', version: '0.11.6', status: 'completed_with_findings', terminal: true,
        componentStatus: 'COMPLETED', continuationDisposition: 'COMPLETE_EVIDENCE', authoritativeFinding: false,
        rawOutput: { exitCode: 255, stdout: '{"success":true,"results":{"detectors":[{}]}}', stderr: '' }
      };
    }
  });
  assert.deepEqual(calls, ['checkout', 'build', 'slither']);
  assert.equal(result.profileId, 'github-native-compile-v2');
  assert.equal(result.status, 'completed');
  assert.equal(result.source.commit, commit('1'));
  assert.equal(result.build.system, 'hardhat-native');
  assert.equal(result.analysis.slither.authoritativeFinding, false);
  assert.equal(result.analysisComponentFailureCount, 0);
  assert.equal(result.continuityDisposition, 'COMPLETE_EVIDENCE');
});

test('compile-v2 build admission failure stops before Slither and preserves typed process evidence', async () => {
  const calls = [];
  const result = await runGitHubNativeJob(request(), {
    workspaceRoot: '/tmp/v7-compile-fail',
    checkoutSource: async (source) => {
      calls.push('checkout');
      return { checkoutRoot: '/tmp/v7-compile-fail/checkout', projectRoot: '/tmp/v7-compile-fail/checkout/audit-targets/example', commit: source.commit };
    },
    buildProject: async () => {
      calls.push('build');
      throw new Error('Hardhat exact build requires a committed npm lockfile');
    },
    runSlither: async () => {
      calls.push('slither');
      throw new Error('Slither must not run after failed build admission');
    }
  });
  assert.deepEqual(calls, ['checkout', 'build']);
  assert.equal(result.status, 'failed');
  assert.equal(result.profileId, 'github-native-compile-v2');
  assert.equal(result.error.message, 'Hardhat exact build requires a committed npm lockfile');
  assert.equal(result.analysis.slither, undefined);
  assert.equal(result.analysisComponentFailureCount, 0);
  assert.equal(result.continuityDisposition, 'COMPLETE_EVIDENCE');
});
