import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildCompilerInput } from '../../runner/src/compiler.mjs';
import { runGitHubNativeJob } from '../src/run-job-file.mjs';
import { generateSourceIntelligenceTechnicalBundleV1 } from '../src/source-intelligence-technical-v1.mjs';

const commit = '1'.repeat(40);
const digest = '2'.repeat(64);

function request() {
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
    campaignId: 'lite-source-intelligence-test',
    assignmentId: 'web-bootstrap-agent-phase0-v1',
    phaseId: 'scope-and-provenance',
    gateId: 'lite-phase0-source-intelligence',
    profileId: 'github-native-compile-v2',
    source: { repository: 'CurveYield2/Audit-Controller', commit, projectPath: 'target' },
    configuration: {
      compilers: [{ language: 'solidity', version: '0.8.30' }],
      timeoutMinutes: 20,
      optimizer: { enabled: true, runs: 1000 },
      viaIR: true,
      analysis: { slither: { version: '0.11.6' } }
    },
    requestId: `dar-${'3'.repeat(32)}`,
    requestDigest: digest
  };
}

test('Lite Source Intelligence build asks solc for source ASTs without dropping existing artifact outputs', () => {
  const input = buildCompilerInput({ 'contracts/Vault.sol': 'pragma solidity 0.8.30; contract Vault {}' });
  assert.deepEqual(input.settings.outputSelection['*'][''], ['ast']);
  assert.equal(input.settings.outputSelection['*']['*'].includes('abi'), true);
  assert.equal(input.settings.outputSelection['*']['*'].includes('storageLayout'), true);
  assert.equal(input.settings.outputSelection['*']['*'].includes('evm.methodIdentifiers'), true);
});

test('technical generator emits deterministic neutral structural facts from the accepted build', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lite-si-tech-'));
  await fs.mkdir(path.join(root, 'contracts'), { recursive: true });
  const source = 'pragma solidity 0.8.30; contract Vault { uint256 public total; modifier onlyOwner(){_;} function deposit(uint256 x) external onlyOwner { total = x; } event Deposit(uint256 x); error Unauthorized(); }\n';
  await fs.writeFile(path.join(root, 'contracts', 'Vault.sol'), source);

  const build = {
    status: 'completed',
    system: 'solc-standard-json',
    sourceAsts: {
      'contracts/Vault.sol': {
        nodeType: 'SourceUnit', src: `0:${source.length}:0`, nodes: [{
          id: 1, nodeType: 'ContractDefinition', name: 'Vault', contractKind: 'contract',
          abstract: false, src: `23:${source.length - 23}:0`, baseContracts: [], linearizedBaseContracts: [1],
          nodes: [
            { id: 3, nodeType: 'VariableDeclaration', name: 'total', src: '40:20:0' },
            {
              id: 2, nodeType: 'FunctionDefinition', name: 'deposit', visibility: 'external',
              stateMutability: 'nonpayable', functionSelector: 'b6b55f25', src: '91:57:0',
              parameters: { parameters: [{ nodeType: 'VariableDeclaration', name: 'x', src: '108:9:0' }] },
              modifiers: [{ nodeType: 'ModifierInvocation', modifierName: { name: 'onlyOwner' }, src: '128:9:0' }],
              body: { nodeType: 'Block', src: '138:10:0', statements: [] }
            }
          ]
        }]
      }
    },
    artifacts: [{
      sourceName: 'contracts/Vault.sol',
      contractName: 'Vault',
      abi: [
        { type: 'function', name: 'deposit', inputs: [{ name: 'x', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
        { type: 'event', name: 'Deposit', inputs: [{ name: 'x', type: 'uint256', indexed: false }] },
        { type: 'error', name: 'Unauthorized', inputs: [] }
      ],
      metadata: '{}',
      storageLayout: {
        storage: [{ astId: 3, contract: 'contracts/Vault.sol:Vault', label: 'total', offset: 0, slot: '0', type: 't_uint256' }],
        types: { t_uint256: { label: 'uint256', numberOfBytes: '32' } }
      },
      methodIdentifiers: { 'deposit(uint256)': 'b6b55f25' },
      bytecode: '0x6000',
      deployedBytecode: '0x6001',
      gasEstimates: { creation: { totalCost: '12345' } }
    }]
  };

  const analysis = {
    slither: {
      backend: 'slither',
      version: '0.11.6',
      status: 'completed_with_findings',
      rawArtifactRef: 'github-actions://CurveYield2/Contract-Automation/runs/1/artifacts/v7-execution/slither/raw.json',
      detectors: [{ check: 'example-detector', impact: 'Low', confidence: 'High' }]
    }
  };

  const first = await generateSourceIntelligenceTechnicalBundleV1({ projectRoot: root, request: request(), build, analysis });
  const second = await generateSourceIntelligenceTechnicalBundleV1({ projectRoot: root, request: request(), build, analysis });

  assert.equal(first.technicalBundleDigest, second.technicalBundleDigest);
  assert.equal(first.neutrality.securityDisposition, 'REVIEWER_REQUIRED');
  assert.equal(first.neutrality.findingPromotion, 'FORBIDDEN_BY_GENERATOR');
  assert.equal(first.contracts[0].qualifiedName, 'contracts/Vault.sol:Vault');
  assert.equal(first.functions[0].signature, 'deposit(uint256)');
  assert.equal(first.functions[0].selector, '0xb6b55f25');
  assert.equal(first.storageLayout[0].label, 'total');
  assert.equal(first.privilegeCandidates[0].modifierOrGuard, 'onlyOwner');
  assert.equal(first.eventsAndErrors.length, 2);
  assert.equal(first.staticRecon.slither.candidateCount, 1);
  assert.equal(first.completion.secondBuildPerformed, false);
  assert.equal(first.completion.semanticReviewRequired, true);
});

test('compile execution attaches the technical bundle after build and neutral Slither', async () => {
  const calls = [];
  const sentinel = { schemaVersion: 'curveyield-v7-source-intelligence-technical-bundle-v1', technicalBundleDigest: 'a'.repeat(64) };
  const result = await runGitHubNativeJob(request(), {
    checkoutSource: async (source) => {
      calls.push('checkout');
      return { checkoutRoot: '/tmp/lite-si', projectRoot: '/tmp/lite-si/target', commit: source.commit };
    },
    buildProject: async () => {
      calls.push('build');
      return { status: 'completed', system: 'solc-standard-json', sourceAsts: {}, artifacts: [] };
    },
    runSlither: async () => {
      calls.push('slither');
      return {
        backend: 'slither', version: '0.11.6', status: 'completed', terminal: true,
        componentStatus: 'COMPLETED', continuationDisposition: 'COMPLETE_EVIDENCE',
        authoritativeFinding: false, detectors: []
      };
    },
    generateSourceIntelligence: async ({ analysis }) => {
      calls.push('source-intelligence');
      assert.equal(analysis.slither.status, 'completed');
      return sentinel;
    }
  });

  assert.deepEqual(calls, ['checkout', 'build', 'slither', 'source-intelligence']);
  assert.deepEqual(result.sourceIntelligenceTechnicalBundle, sentinel);
  assert.equal(result.status, 'completed');
});
