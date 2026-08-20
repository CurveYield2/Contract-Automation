import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { checkoutExactSource } from '../src/execution.mjs';
import { runGitHubNativeJob } from '../src/run-job-file.mjs';

const commit = (c) => c.repeat(40);
const sha = (c) => c.repeat(64);

function phase7Request() {
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
      projectPath: 'campaigns/Boosthub Staking v2/source'
    },
    configuration: {
      compilers: [{ language: 'solidity', version: '0.8.28' }],
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
      viaIR: false,
      timeoutMinutes: 20,
      deploymentGas: {
        deployableContracts: [{ sourceName: 'contracts/Vault.sol', contractName: 'Vault' }]
      },
      simulation: {
        chain: 'ethereum',
        block: 25737717,
        workflow: { steps: [{ action: 'deploy', alias: 'vault', contract: 'Vault' }] }
      },
      analysis: { slither: false, medusa: false, nativeFuzz: { enabled: false } }
    },
    requestId: `dar-${'2'.repeat(32)}`,
    requestDigest: sha('3')
  };
}

test('private source checkout uses AUDIT_CONTROLLER_GITHUB_TOKEN without placing the token in git arguments', async () => {
  const calls = [];
  const destination = path.join(os.tmpdir(), 'v7-private-controller-regression', 'checkout');
  const token = 'test-private-controller-token';
  const requestedCommit = commit('a');

  await checkoutExactSource({
    repository: 'CurveYield2/Solo-Audit-Controller',
    commit: requestedCommit,
    destination
  }, {
    environment: { PATH: process.env.PATH, AUDIT_CONTROLLER_GITHUB_TOKEN: token },
    runCommand: async (input) => {
      calls.push(input);
      if (input.args?.[0] === 'rev-parse') {
        return { exitCode: 0, stdout: `${requestedCommit}\n`, stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    }
  });

  const fetchCall = calls.find((call) => call.args?.[0] === 'fetch');
  assert.ok(fetchCall, 'expected a git fetch call');
  assert.equal(fetchCall.args.join(' ').includes(token), false, 'token must never be embedded in command arguments');
  assert.equal(fetchCall.env?.GIT_CONFIG_COUNT, '1');
  assert.equal(fetchCall.env?.GIT_CONFIG_KEY_0, 'http.https://github.com/.extraheader');
  assert.match(fetchCall.env?.GIT_CONFIG_VALUE_0 ?? '', /^AUTHORIZATION: basic /i);
  assert.equal(fetchCall.env?.GIT_CONFIG_VALUE_0?.includes(token), false, 'raw token must not appear in git config value');
});

test('private source checkout resolves a relative destination once and uses that exact absolute checkout for every git command', async () => {
  const calls = [];
  const requestedCommit = commit('b');
  const relativeDestination = path.join('.audit-work', 'v7-execution-v4', 'checkout');
  const expectedDestination = path.resolve(relativeDestination);

  const result = await checkoutExactSource({
    repository: 'CurveYield2/Solo-Audit-Controller',
    commit: requestedCommit,
    destination: relativeDestination
  }, {
    environment: { PATH: process.env.PATH, AUDIT_CONTROLLER_GITHUB_TOKEN: 'test-token' },
    runCommand: async (input) => {
      calls.push(input);
      if (input.args?.[0] === 'rev-parse') return { exitCode: 0, stdout: `${requestedCommit}\n`, stderr: '' };
      return { exitCode: 0, stdout: '', stderr: '' };
    }
  });

  const init = calls.find((call) => call.args?.[0] === 'init');
  assert.ok(init, 'expected git init');
  assert.deepEqual(init.args, ['init', expectedDestination]);
  assert.equal(init.cwd, path.dirname(expectedDestination));
  for (const call of calls.filter((entry) => entry.args?.[0] !== 'init')) {
    assert.equal(call.cwd, expectedDestination, `git ${call.args?.[0]} must use the exact resolved checkout cwd`);
  }
  assert.equal(result.destination, expectedDestination);
});

test('Phase 7 Ethereum lifecycle uses SIM_ARCHIVE_PRIMARY_ETHEREUM_01 as the authoritative fork RPC', async () => {
  const calls = [];
  const archiveUrl = 'https://archive-rpc.example';
  const request = phase7Request();
  const artifacts = [{
    sourceName: 'contracts/Vault.sol',
    contractName: 'Vault',
    abi: [],
    bytecode: '0x6000',
    gasEstimates: { creation: { totalCost: '222222', codeDepositCost: '200000', executionCost: '22222' } }
  }];

  const result = await runGitHubNativeJob(request, {
    workspaceRoot: '/tmp/v7-private-controller-phase7',
    checkoutSource: async (source) => ({
      checkoutRoot: '/tmp/v7-private-controller-phase7/checkout',
      projectRoot: '/tmp/v7-private-controller-phase7/checkout/campaigns/Boosthub Staking v2/source',
      commit: source.commit
    }),
    buildProject: async () => ({ status: 'completed', compilerVersion: '0.8.28', artifacts }),
    environment: {
      SIM_ARCHIVE_PRIMARY_ETHEREUM_01: archiveUrl,
      RPC_ETHEREUM: 'https://non-archive-rpc.example'
    },
    startSimulationEngine: async (input) => {
      calls.push(input);
      return { runtime: {}, aliases: {}, async close() {} };
    },
    executeSimulationWorkflow: async () => ({ steps: [{ index: 0, action: 'deploy', status: 'completed' }], context: { deployments: {} } })
  });

  assert.equal(result.status, 'completed');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].forkUrl, archiveUrl);
});
