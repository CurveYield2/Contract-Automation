import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDeploymentGasEvidence } from '../src/deployment-gas-v1.mjs';

const configurationIdentity = Object.freeze({
  sourceCommit: 'a'.repeat(40),
  compiler: { language: 'solidity', version: '0.8.28' },
  optimizer: { enabled: true, runs: 200 },
  evmVersion: 'cancun',
  viaIR: false,
});

const deployableContracts = Object.freeze([
  { sourceName: 'contracts/A.sol', contractName: 'A' },
  { sourceName: 'contracts/B.sol', contractName: 'B' },
]);

const artifacts = Object.freeze([
  { sourceName: 'contracts/A.sol', contractName: 'A', bytecode: '0x6000', gasEstimates: { creation: { totalCost: '123456', codeDepositCost: '100000', executionCost: '23456' } } },
  { sourceName: 'contracts/B.sol', contractName: 'B', bytecode: '0x6001', gasEstimates: null },
]);

test('emits one row per frozen deployable contract using same-config compiler evidence', () => {
  const out = normalizeDeploymentGasEvidence({ deployableContracts, artifacts, configurationIdentity });
  assert.equal(out.schemaVersion, 'audit-v7-contract-deployment-gas-evidence-v1');
  assert.equal(out.reportTemplate, 'Contract_Deployment_Gas_Report_v1.md');
  assert.equal(out.rows.length, 2);
  assert.deepEqual(out.rows[0], {
    sourceName: 'contracts/A.sol',
    contractName: 'A',
    qualifiedName: 'contracts/A.sol:A',
    status: 'AVAILABLE',
    deploymentGasEstimate: '123456',
    codeDepositCost: '100000',
    executionCost: '23456',
    reason: null,
  });
  assert.equal(out.rows[1].status, 'UNAVAILABLE');
  assert.equal(out.rows[1].reason, 'COMPILER_GAS_ESTIMATE_UNAVAILABLE');
  assert.match(out.configurationIdentitySha256, /^[0-9a-f]{64}$/);
});

test('records missing compiler artifact as typed UNAVAILABLE rather than dropping contract', () => {
  const out = normalizeDeploymentGasEvidence({ deployableContracts, artifacts: artifacts.slice(0, 1), configurationIdentity });
  assert.equal(out.rows.length, 2);
  assert.equal(out.rows[1].status, 'UNAVAILABLE');
  assert.equal(out.rows[1].reason, 'ARTIFACT_NOT_PRESENT_IN_ACCEPTED_COMPILER_OUTPUT');
});

test('rejects duplicate frozen deployable contracts', () => {
  assert.throws(() => normalizeDeploymentGasEvidence({ deployableContracts: [deployableContracts[0], deployableContracts[0]], artifacts, configurationIdentity }), /duplicate deployable contract/);
});

test('rejects duplicate compiler artifacts for one qualified contract', () => {
  assert.throws(() => normalizeDeploymentGasEvidence({ deployableContracts, artifacts: [artifacts[0], artifacts[0], artifacts[1]], configurationIdentity }), /duplicate compiler artifact/);
});

test('requires exact source/compiler configuration identity', () => {
  assert.throws(() => normalizeDeploymentGasEvidence({ deployableContracts, artifacts, configurationIdentity: { ...configurationIdentity, sourceCommit: 'bad' } }), /sourceCommit/);
  assert.throws(() => normalizeDeploymentGasEvidence({ deployableContracts, artifacts, configurationIdentity: { ...configurationIdentity, compiler: {} } }), /compiler version/);
});

test('non-numeric compiler estimates are retained as UNAVAILABLE', () => {
  const weird = [{ ...artifacts[0], gasEstimates: { creation: { totalCost: 'infinite', codeDepositCost: '100', executionCost: 'infinite' } } }, artifacts[1]];
  const out = normalizeDeploymentGasEvidence({ deployableContracts, artifacts: weird, configurationIdentity });
  assert.equal(out.rows[0].status, 'UNAVAILABLE');
  assert.equal(out.rows[0].reason, 'NON_NUMERIC_COMPILER_GAS_ESTIMATE');
});
