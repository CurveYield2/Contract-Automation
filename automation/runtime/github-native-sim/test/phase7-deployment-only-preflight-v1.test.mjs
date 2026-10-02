import test from 'node:test';
import assert from 'node:assert/strict';
import { runPhase7ForkPreflightV1 } from '../src/phase7-fork-preflight-v1.mjs';

function requestWithDeploymentOnlyWorkflow() {
  return {
    requestId: 'dar-deployment-only-preflight-regression',
    phaseId: 'fork-simulation-lifecycle',
    profileId: 'github-native-simulate-v2',
    source: { commit: '6bde63416a4611e127b8bb3a5958e6b6d874c188' },
    configuration: {
      evmVersion: 'cancun',
      simulation: {
        chain: 'ethereum',
        block: 25817400,
        workflow: {
          steps: [
            {
              action: 'deploy',
              alias: 'vault',
              contract: 'CurveYieldVault',
              source: 'contracts/CurveYieldVault.sol',
              args: ['$account0', '0x000000000000000000000000000000000000bEEF'],
              from: '$account0',
              label: 'deploy audited contract with mixed EOA/dependency constructor args',
            },
            {
              action: 'assertCall',
              target: '$vault',
              function: 'owner() view returns (address)',
              args: [],
              equals: '$account0',
              label: 'exercise freshly deployed audited contract',
            },
          ],
        },
      },
    },
  };
}

function fakeEngine() {
  const provider = {
    async send(method) {
      if (method === 'eth_chainId') return '0x1';
      return true;
    },
    async getBlock(number) {
      return { number, hash: '0x' + '11'.repeat(32) };
    },
    async getBalance() {
      return 10n ** 18n;
    },
    async getCode() {
      throw new Error('deployment-only workflow must not invent constructor-address code probes');
    },
  };
  return { engine: 'anvil', provider, close: async () => {} };
}

test('Phase 7 deployment-only workflow does not fail preflight solely because it has no literal external call target', async () => {
  const result = await runPhase7ForkPreflightV1({
    request: requestWithDeploymentOnlyWorkflow(),
    environment: { SIM_ARCHIVE_PRIMARY_ETHEREUM_01: 'https://archive.invalid' },
    startEngine: async () => fakeEngine(),
    probeUpstreamIdentity: async () => ({
      remoteChainId: 1,
      remoteNetworkId: 1,
      chainIdMatchesExpected: true,
      networkIdMatchesExpected: true,
      sampleTransaction: { chainId: 1 },
      block: { hash: '0x' + '11'.repeat(32), stateRoot: '0x' + '22'.repeat(32) },
    }),
  });

  assert.equal(result.checks.targetCode.status, 'UNAVAILABLE');
  assert.match(result.checks.targetCode.reason, /no literal external call target/i);
  assert.equal(result.status, 'PASS');
  assert.equal(result.nextState, 'ACTIVE');
});
