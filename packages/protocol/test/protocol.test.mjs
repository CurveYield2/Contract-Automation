import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAINS,
  validateCreateJobRequest,
  validateWorkflow,
  ValidationError
} from '../src/index.mjs';

const baseRequest = {
  project: {
    type: 'inline',
    files: {
      'Counter.sol': 'pragma solidity 0.8.30; contract Counter {}'
    }
  },
  compilerVersion: '0.8.30',
  chain: 'polygon',
  block: 'latest',
  workflow: {
    steps: [
      { action: 'deploy', alias: 'counter', contract: 'Counter', args: [] }
    ]
  }
};

test('chain registry contains only the initial seven chains', () => {
  assert.deepEqual(Object.keys(CHAINS), [
    'ethereum', 'base', 'katana', 'fraxtal', 'arbitrum', 'polygon', 'optimism'
  ]);
});

test('accepts a valid structured request', () => {
  const normalized = validateCreateJobRequest(baseRequest);
  assert.equal(normalized.chain, 'polygon');
  assert.equal(normalized.workflow.steps[0].action, 'deploy');
});

test('rejects a user supplied RPC URL', () => {
  assert.throws(
    () => validateCreateJobRequest({ ...baseRequest, rpcUrl: 'https://evil.invalid' }),
    (error) => error instanceof ValidationError && error.code === 'forbidden_field'
  );
});

test('rejects private keys and signing material anywhere in the request', () => {
  assert.throws(
    () => validateCreateJobRequest({
      ...baseRequest,
      workflow: { steps: [{
        action: 'deploy', alias: 'counter', contract: 'Counter', privateKey: '0xabc'
      }] }
    }),
    (error) => error instanceof ValidationError && error.code === 'forbidden_field'
  );
});

test('rejects unsupported or broadcast actions', () => {
  for (const action of ['sendRawTransaction', 'broadcast', 'shell', 'runScript']) {
    assert.throws(
      () => validateWorkflow({ steps: [{ action }] }),
      (error) => error instanceof ValidationError && error.code === 'unsupported_action'
    );
  }
});

test('rejects an unknown chain', () => {
  assert.throws(
    () => validateCreateJobRequest({ ...baseRequest, chain: 'bsc' }),
    (error) => error instanceof ValidationError && error.code === 'unsupported_chain'
  );
});

test('requires exact compiler versions', () => {
  assert.throws(
    () => validateCreateJobRequest({ ...baseRequest, compilerVersion: '^0.8.20' }),
    (error) => error instanceof ValidationError && error.code === 'invalid_compiler_version'
  );
});

test('limits inline project size and path traversal', () => {
  assert.throws(
    () => validateCreateJobRequest({
      ...baseRequest,
      project: { type: 'inline', files: { '../Counter.sol': 'contract Counter {}' } }
    }),
    (error) => error instanceof ValidationError && error.code === 'invalid_path'
  );
});


test('accepts compile-only jobs without a chain or workflow steps', () => {
  const normalized = validateCreateJobRequest({
    mode: 'compile',
    project: baseRequest.project,
    compilerVersion: '0.8.30'
  });
  assert.equal(normalized.mode, 'compile');
  assert.equal(normalized.chain, undefined);
  assert.deepEqual(normalized.workflow.steps, []);
});


test('rejects non-boolean viaIR values', () => {
  assert.throws(
    () => validateCreateJobRequest({ ...baseRequest, viaIR: 'false' }),
    (error) => error instanceof ValidationError && error.code === 'invalid_via_ir'
  );
});
