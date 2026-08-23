import test from 'node:test';
import assert from 'node:assert/strict';
import { runGitHubNativeJob } from '../src/run-job-file.mjs';

const commit = (c) => c.repeat(40);
const sha = (c) => c.repeat(64);

function request(overrides = {}) {
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
    campaignId: 'campaign-1',
    assignmentId: 'reviewer-2-phase-6-v1',
    phaseId: 'build-and-test',
    gateId: 'exact-build-and-tests-complete',
    profileId: 'github-native-simulate-v2',
    source: {
      repository: 'CurveYield2/Audits',
      commit: commit('1'),
      projectPath: 'audit-targets/example'
    },
    configuration: {
      compilers: [{ language: 'solidity', version: '0.8.28' }],
      timeoutMinutes: 20,
      analysis: {
        slither: { version: '0.11.6' },
        medusa: { version: '1.5.1' },
        nativeFuzz: { enabled: true, fuzzRuns: 256, recoverableExitCodes: [2] }
      }
    },
    requestId: `dar-${'2'.repeat(32)}`,
    requestDigest: sha('3'),
    ...overrides,
  };
}

function phase7Request() {
  return request({
    assignmentId: 'reviewer-2-phase-7-v1',
    phaseId: 'fork-simulation-lifecycle',
    gateId: 'fork-simulation-lifecycle-complete',
    configuration: {
      compilers: [{ language: 'solidity', version: '0.8.28' }],
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
      viaIR: false,
      timeoutMinutes: 20,
      deploymentGas: { deployableContracts: [{ sourceName: 'contracts/Vault.sol', contractName: 'Vault' }] },
      simulation: {
        chain: 'ethereum',
        block: 25666794,
        workflow: {
          steps: [
            { action: 'deploy', alias: 'vault', contract: 'Vault' },
            { action: 'snapshot', alias: 'before' },
            { action: 'mine', blocks: 2 },
            { action: 'revertSnapshot', snapshot: '$before' }
          ]
        }
      },
      analysis: { slither: false, medusa: false, nativeFuzz: { enabled: false } }
    }
  });
}

function checkout(calls) {
  return async (source) => {
    calls.push('checkout');
    return {
      checkoutRoot: '/tmp/v7-simulate/checkout',
      projectRoot: '/tmp/v7-simulate/checkout/audit-targets/example',
      commit: source.commit
    };
  };
}

function build(calls, artifacts = []) {
  return async () => {
    calls.push('build');
    return { status: 'completed', system: 'hardhat-native', compilerVersion: '0.8.28', artifacts };
  };
}

function slither(calls) {
  return async () => {
    calls.push('slither');
    return {
      backend: 'slither', version: '0.11.6', status: 'completed', terminal: true,
      componentStatus: 'COMPLETED', continuationDisposition: 'COMPLETE_EVIDENCE', authoritativeFinding: false
    };
  };
}

test('simulate-v2 preserves build -> Slither -> terminal Medusa -> native-fuzz ordering', async () => {
  const calls = [];
  const result = await runGitHubNativeJob(request(), {
    workspaceRoot: '/tmp/v7-simulate',
    checkoutSource: checkout(calls),
    buildProject: build(calls),
    runSlither: slither(calls),
    runMedusa: async () => {
      calls.push('medusa');
      return {
        backend: 'medusa', version: '1.5.1', status: 'completed_with_failures', terminal: true,
        failureKind: 'PROPERTY_FALSIFICATION', componentStatus: 'COMPLETED_WITH_FAILURES',
        continuationDisposition: 'CONTINUE_WITH_LIMITATION', campaign: { falsifiedProperties: 1 }
      };
    },
    runNativeFuzz: async () => {
      calls.push('native-fuzz');
      return {
        backend: 'native-fuzz', status: 'completed', terminal: true,
        componentStatus: 'COMPLETED', continuationDisposition: 'COMPLETE_EVIDENCE'
      };
    }
  });
  assert.deepEqual(calls, ['checkout', 'build', 'slither', 'medusa', 'native-fuzz']);
  assert.equal(result.profileId, 'github-native-simulate-v2');
  assert.equal(result.status, 'completed');
  assert.equal(result.analysis.medusa.failureKind, 'PROPERTY_FALSIFICATION');
  assert.equal(result.analysis.nativeFuzz.status, 'completed');
  assert.equal(result.analysisComponentFailureCount, 1);
  assert.equal(result.continuityDisposition, 'CONTINUE_WITH_LIMITATION');
  assert.equal(result.deploymentGasEvidence, null);
  assert.equal(result.simulation, null);
});

test('simulate-v2 allows native fuzz after terminal Medusa tool failure and preserves both component outcomes', async () => {
  const calls = [];
  const result = await runGitHubNativeJob(request(), {
    workspaceRoot: '/tmp/v7-simulate',
    checkoutSource: checkout(calls),
    buildProject: build(calls),
    runSlither: slither(calls),
    runMedusa: async () => {
      calls.push('medusa');
      return {
        backend: 'medusa', version: '1.5.1', status: 'failed', terminal: true,
        failureKind: 'TOOL_FAILURE', componentStatus: 'FAILED', continuationDisposition: 'CONTINUE_WITH_LIMITATION'
      };
    },
    runNativeFuzz: async () => {
      calls.push('native-fuzz');
      return {
        backend: 'native-fuzz', status: 'completed_with_limitations', terminal: true,
        failureKind: 'RECOVERABLE_LIMITATION', componentStatus: 'COMPLETED_WITH_FAILURES',
        continuationDisposition: 'CONTINUE_WITH_LIMITATION'
      };
    }
  });
  assert.deepEqual(calls, ['checkout', 'build', 'slither', 'medusa', 'native-fuzz']);
  assert.equal(result.status, 'completed');
  assert.equal(result.analysisComponentFailureCount, 2);
  assert.equal(result.analysis.medusa.failureKind, 'TOOL_FAILURE');
  assert.equal(result.analysis.nativeFuzz.failureKind, 'RECOVERABLE_LIMITATION');
});

test('simulate-v2 refuses native fuzz when Medusa has not reached terminal evidence', async () => {
  const calls = [];
  const result = await runGitHubNativeJob(request(), {
    workspaceRoot: '/tmp/v7-simulate',
    checkoutSource: checkout(calls),
    buildProject: build(calls),
    runSlither: slither(calls),
    runMedusa: async () => {
      calls.push('medusa');
      return { backend: 'medusa', version: '1.5.1', status: 'running', terminal: false };
    },
    runNativeFuzz: async () => {
      calls.push('native-fuzz');
      throw new Error('native fuzz must not start');
    }
  });
  assert.deepEqual(calls, ['checkout', 'build', 'slither', 'medusa']);
  assert.equal(result.status, 'failed');
  assert.match(result.error.message, /terminal Medusa evidence/);
  assert.equal(result.analysis.nativeFuzz, undefined);
});

test('Phase 7 uses the same accepted build for gas evidence and a full pinned-fork lifecycle', async () => {
  const calls = [];
  const artifacts = [{
    sourceName: 'contracts/Vault.sol', contractName: 'Vault', abi: [], bytecode: '0x6000',
    gasEstimates: { creation: { totalCost: '222222', codeDepositCost: '200000', executionCost: '22222' } }
  }];
  const engine = {
    runtime: { id: 'runtime' },
    aliases: { account0: '0x0000000000000000000000000000000000000001' },
    async close() { calls.push('close-fork'); }
  };
  const result = await runGitHubNativeJob(phase7Request(), {
    workspaceRoot: '/tmp/v7-phase7-gas',
    checkoutSource: checkout(calls),
    buildProject: build(calls, artifacts),
    environment: { SIM_ARCHIVE_PRIMARY_ETHEREUM_01: 'https://ethereum-archive-rpc.example' },
    startSimulationEngine: async (input) => {
      calls.push('start-fork');
      assert.equal(input.chainId, 1);
      assert.equal(input.forkUrl, 'https://ethereum-archive-rpc.example');
      assert.equal(input.block, 25666794);
      assert.equal(input.evmVersion, 'cancun');
      assert.deepEqual(input.workflow, phase7Request().configuration.simulation.workflow);
      assert.equal(input.artifacts.get('Vault', 'contracts/Vault.sol').bytecode, '0x6000');
      return engine;
    },
    executeSimulationWorkflow: async (workflow, runtime, initialContext) => {
      calls.push('lifecycle');
      assert.equal(runtime, engine.runtime);
      assert.deepEqual(initialContext.aliases, engine.aliases);
      return {
        steps: workflow.steps.map((step, index) => ({ index, action: step.action, status: 'completed' })),
        context: { aliases: initialContext.aliases, deployments: { vault: { address: '0x0000000000000000000000000000000000000002', contractName: 'Vault', sourceName: 'contracts/Vault.sol' } } }
      };
    }
  });
  assert.deepEqual(calls, ['checkout', 'build', 'start-fork', 'lifecycle', 'close-fork']);
  assert.equal(result.status, 'completed');
  assert.equal(result.deploymentGasEvidence.rows.length, 1);
  assert.equal(result.deploymentGasEvidence.rows[0].deploymentGasEstimate, '222222');
  assert.equal(result.deploymentGasEvidence.sourceCommit, commit('1'));
  assert.equal(result.simulation.status, 'completed');
  assert.equal(result.simulation.chain, 'ethereum');
  assert.equal(result.simulation.chainId, 1);
  assert.equal(result.simulation.block, 25666794);
  assert.equal(result.simulation.pinnedFork, true);
  assert.equal(result.simulation.steps.length, 4);
  assert.equal(result.simulation.deployments.vault.contractName, 'Vault');
});

test('Phase 7 refuses lifecycle execution when the authoritative archive RPC secret is unavailable', async () => {
  const calls = [];
  const artifacts = [{ sourceName: 'contracts/Vault.sol', contractName: 'Vault', abi: [], bytecode: '0x6000', gasEstimates: null }];
  const result = await runGitHubNativeJob(phase7Request(), {
    workspaceRoot: '/tmp/v7-phase7-no-rpc',
    checkoutSource: checkout(calls),
    buildProject: build(calls, artifacts),
    environment: {},
    startSimulationEngine: async () => { calls.push('start-fork'); throw new Error('must not start'); }
  });
  assert.deepEqual(calls, ['checkout', 'build']);
  assert.equal(result.status, 'failed');
  assert.match(result.error.message, /SIM_ARCHIVE_PRIMARY_ETHEREUM_01/);
  assert.equal(result.deploymentGasEvidence.rows[0].status, 'UNAVAILABLE');
  assert.equal(result.simulation.status, 'failed');
  assert.equal(result.simulation.failureKind, 'RPC_CONFIGURATION_FAILURE');
});

test('Phase 7 captures workflow failures as typed lifecycle evidence and closes the fork engine', async () => {
  const calls = [];
  const artifacts = [{ sourceName: 'contracts/Vault.sol', contractName: 'Vault', abi: [], bytecode: '0x6000', gasEstimates: null }];
  const error = new Error('lifecycle call reverted');
  error.workflowSteps = [{ index: 0, action: 'deploy', status: 'completed' }, { index: 1, action: 'call', status: 'failed' }];
  error.workflowContext = { deployments: { vault: { address: '0x0000000000000000000000000000000000000002' } } };
  const result = await runGitHubNativeJob(phase7Request(), {
    workspaceRoot: '/tmp/v7-phase7-fail',
    checkoutSource: checkout(calls),
    buildProject: build(calls, artifacts),
    environment: { SIM_ARCHIVE_PRIMARY_ETHEREUM_01: 'https://ethereum-archive-rpc.example' },
    startSimulationEngine: async () => ({ runtime: {}, aliases: {}, async close() { calls.push('close-fork'); } }),
    executeSimulationWorkflow: async () => { calls.push('lifecycle'); throw error; }
  });
  assert.deepEqual(calls, ['checkout', 'build', 'lifecycle', 'close-fork']);
  assert.equal(result.status, 'failed');
  assert.equal(result.simulation.status, 'failed');
  assert.equal(result.simulation.failureKind, 'LIFECYCLE_WORKFLOW_FAILURE');
  assert.equal(result.simulation.steps.length, 2);
  assert.equal(result.simulation.deployments.vault.address, '0x0000000000000000000000000000000000000002');
});
