import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as buildDispatch from '../../runner/src/build-dispatch.mjs';

function request() {
  return {
    configuration: {
      compilers: [
        { language: 'solidity', version: '0.8.28' },
        { language: 'vyper', version: '0.4.3' }
      ],
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
      viaIR: true
    }
  };
}

test('compileVyperSources installs and verifies the exact compiler then returns deployable artifacts', async () => {
  assert.equal(typeof buildDispatch.compileVyperSources, 'function', 'compileVyperSources must be exported');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v7-vyper-'));
  const sourceDir = path.join(root, 'contracts', 'boosthub', 'vyper');
  await fs.mkdir(sourceDir, { recursive: true });
  await fs.writeFile(path.join(sourceDir, 'BoostHubStaking-v16.vy'), '# @version 0.4.3\n');
  const calls = [];
  const runCommand = async (input) => {
    calls.push(input);
    if (input.command === 'python3') return { exitCode: 0, stdout: '', stderr: '' };
    if (input.command === 'vyper' && input.args?.[0] === '--version') return { exitCode: 0, stdout: '0.4.3+commit.bff19ea2\n', stderr: '' };
    const formatIndex = input.args?.indexOf('-f') ?? -1;
    const format = formatIndex >= 0 ? input.args[formatIndex + 1] : null;
    if (input.command === 'vyper' && format === 'abi') return { exitCode: 0, stdout: '[{"type":"constructor","inputs":[]}]\n', stderr: '' };
    if (input.command === 'vyper' && format === 'bytecode') return { exitCode: 0, stdout: '0x6000\n', stderr: '' };
    if (input.command === 'vyper' && format === 'bytecode_runtime') return { exitCode: 0, stdout: '0x6001\n', stderr: '' };
    return { exitCode: 1, stdout: '', stderr: `unexpected ${input.command} ${(input.args ?? []).join(' ')}` };
  };

  const result = await buildDispatch.compileVyperSources({
    projectRoot: root,
    compiler: { language: 'vyper', version: '0.4.3' },
    evmVersion: 'cancun',
    runCommand
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.compilerVersion, '0.4.3');
  assert.equal(result.compilerReportedVersion, '0.4.3+commit.bff19ea2');
  assert.equal(result.sourceInventoryFiles, 1);
  assert.equal(result.artifacts.length, 1);
  assert.deepEqual(result.artifacts[0], {
    sourceName: 'contracts/boosthub/vyper/BoostHubStaking-v16.vy',
    contractName: 'BoostHubStaking-v16',
    abi: [{ type: 'constructor', inputs: [] }],
    bytecode: '0x6000',
    deployedBytecode: '0x6001',
    gasEstimates: null,
    language: 'vyper'
  });
  assert.equal(calls.some((call) => call.command === 'python3' && call.args?.includes('vyper==0.4.3')), true);
  assert.equal(calls.filter((call) => call.command === 'vyper' && call.args?.includes('--evm-version')).length, 3);
});

test('buildProject appends Vyper artifacts to the exact Solidity build when Vyper is requested', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v7-mixed-build-'));
  await fs.mkdir(path.join(root, 'contracts'), { recursive: true });
  await fs.writeFile(path.join(root, 'contracts', 'Vault.sol'), 'pragma solidity 0.8.28; contract Vault {}\n');

  const solidityArtifact = {
    sourceName: 'contracts/Vault.sol', contractName: 'Vault', abi: [], bytecode: '0x6000', deployedBytecode: '0x6001', gasEstimates: null
  };
  const vyperArtifact = {
    sourceName: 'contracts/boosthub/vyper/BoostHubStaking-v16.vy', contractName: 'BoostHubStaking-v16', abi: [], bytecode: '0x6002', deployedBytecode: '0x6003', gasEstimates: null, language: 'vyper'
  };
  let vyperCalled = false;

  const result = await buildDispatch.buildProject({
    projectRoot: root,
    request: request(),
    compileStandardJson: async () => ({
      diagnostics: [],
      input: {},
      artifacts: { all: [solidityArtifact] }
    }),
    compileVyper: async (input) => {
      vyperCalled = true;
      assert.equal(input.compiler.version, '0.4.3');
      assert.equal(input.evmVersion, 'cancun');
      return { status: 'completed', compilerVersion: '0.4.3', compilerReportedVersion: '0.4.3+commit.test', sourceInventory: [vyperArtifact.sourceName], sourceInventoryFiles: 1, artifacts: [vyperArtifact] };
    }
  });

  assert.equal(vyperCalled, true);
  assert.equal(result.artifacts.length, 2);
  assert.equal(result.artifacts.some((artifact) => artifact.contractName === 'Vault'), true);
  assert.equal(result.artifacts.some((artifact) => artifact.contractName === 'BoostHubStaking-v16'), true);
  assert.equal(result.vyperBuild.compilerVersion, '0.4.3');
});
