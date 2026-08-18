import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  buildCompilerInput,
  collectSoliditySources,
  contractArtifactMap,
  safeProjectPath
} from '../src/compiler.mjs';
import { executeWorkflow } from '../src/workflow.mjs';
import { createArchiveByteGuard } from '../src/project.mjs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { renderHtmlReport } from '../src/report.mjs';

const sources = {
  'contracts/A.sol': 'pragma solidity 0.8.30; contract A {}',
  'contracts/B.sol': 'pragma solidity 0.8.30; contract B {}'
};

test('safeProjectPath rejects traversal and absolute paths', () => {
  const root = '/tmp/project';
  assert.equal(safeProjectPath(root, 'contracts/A.sol'), path.join(root, 'contracts/A.sol'));
  assert.throws(() => safeProjectPath(root, '../secret'));
  assert.throws(() => safeProjectPath(root, '/etc/passwd'));
});

test('buildCompilerInput requests deployment, inspection, and gas evidence artifacts', () => {
  const input = buildCompilerInput(sources, {
    optimizer: { enabled: true, runs: 500 },
    viaIR: true,
    evmVersion: 'cancun'
  });
  assert.equal(input.language, 'Solidity');
  assert.equal(input.settings.optimizer.runs, 500);
  assert.equal(input.settings.viaIR, true);
  assert.equal(input.settings.evmVersion, 'cancun');
  assert.deepEqual(input.settings.outputSelection['*']['*'], [
    'abi',
    'metadata',
    'storageLayout',
    'evm.bytecode.object',
    'evm.deployedBytecode.object',
    'evm.methodIdentifiers',
    'evm.gasEstimates'
  ]);
});

test('contractArtifactMap preserves compiler gas estimates and rejects duplicate names unless source is specified', () => {
  const output = {
    contracts: {
      'A.sol': { Vault: { abi: [], evm: { bytecode: { object: '01' }, deployedBytecode: { object: '02' }, gasEstimates: { creation: { totalCost: '123' } } } } },
      'B.sol': { Vault: { abi: [], evm: { bytecode: { object: '03' }, deployedBytecode: { object: '04' } } } }
    }
  };
  const map = contractArtifactMap(output);
  assert.throws(() => map.get('Vault'));
  assert.equal(map.get('Vault', 'A.sol').bytecode, '0x01');
  assert.equal(map.get('Vault', 'A.sol').gasEstimates.creation.totalCost, '123');
});

test('collectSoliditySources only includes .sol files and preserves relative names', async () => {
  const fakeFs = {
    async readdir(directory, options) {
      if (directory.endsWith('project')) return [{ name: 'contracts', isDirectory: () => true, isFile: () => false }, { name: 'README.md', isDirectory: () => false, isFile: () => true }];
      return [{ name: 'Vault.sol', isDirectory: () => false, isFile: () => true }];
    },
    async readFile(file) { return `source:${file}`; }
  };
  const collected = await collectSoliditySources('/tmp/project', fakeFs);
  assert.deepEqual(Object.keys(collected), ['contracts/Vault.sol']);
});

test('executeWorkflow preserves state and supports continueOnFailure', async () => {
  const calls = [];
  const runtime = {
    async execute(step, context) {
      calls.push({ step, aliases: { ...context.aliases } });
      if (step.action === 'deploy') {
        context.aliases[step.alias] = '0x0000000000000000000000000000000000000001';
        return { address: context.aliases[step.alias] };
      }
      if (step.action === 'call' && step.label === 'fail') throw new Error('boom');
      return { ok: true, target: context.aliases[step.target.slice(1)] };
    }
  };
  const result = await executeWorkflow({ steps: [
    { action: 'deploy', alias: 'vault', contract: 'Vault' },
    { action: 'call', label: 'fail', target: '$vault', function: 'broken()', continueOnFailure: true },
    { action: 'call', target: '$vault', function: 'deposit(uint256)', args: ['1'] }
  ] }, runtime);
  assert.equal(result.steps.length, 3);
  assert.equal(result.steps[1].status, 'failed');
  assert.equal(result.steps[2].status, 'completed');
  assert.equal(calls[2].aliases.vault, '0x0000000000000000000000000000000000000001');
});

test('executeWorkflow stops after a non-continuable failure', async () => {
  const runtime = { async execute() { throw new Error('stop'); } };
  await assert.rejects(
    () => executeWorkflow({ steps: [{ action: 'call', target: '0x1', function: 'f()' }] }, runtime),
    /stop/
  );
});

test('HTML report escapes untrusted source and error text', () => {
  const html = renderHtmlReport({
    jobId: 'job_test',
    status: 'failed',
    chain: 'polygon',
    block: 'latest',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    compilerDiagnostics: [{ severity: 'error', message: '<script>alert(1)</script>' }],
    deployments: {},
    steps: []
  });
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;/);
});


test('archive byte guard rejects streamed ZIP data beyond declared safety limits', async () => {
  const counter = { total: 0 };
  await assert.rejects(
    () => pipeline(
      Readable.from([Buffer.alloc(6), Buffer.alloc(6)]),
      createArchiveByteGuard({ counter, maxEntryBytes: 10, maxTotalBytes: 100 })
    ),
    /entry exceeds 10 bytes/
  );
});
