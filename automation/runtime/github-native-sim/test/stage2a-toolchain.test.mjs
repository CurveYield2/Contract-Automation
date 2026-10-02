import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planStage2aAnalysis,
  assertNativeFuzzMayStart,
  runStage2aAnalysis,
  validateStage2aToolchainEvidence
} from '../src/stage2a-toolchain.mjs';

const toolchainEvidence = () => ({
  schemaVersion: 'deep-assurance-stage2a-toolchain/v1',
  status: 'completed',
  componentFailures: [],
  python: { status: 'created', version: '3.12.10' },
  medusaCompiler: {
    status: 'completed', provider: 'slither-analyzer@0.11.6', cryticCompileVersion: '0.4.2',
    pipReportSha256: '1'.repeat(64), executableSha256: '2'.repeat(64)
  },
  solcSelection: { status: 'completed', version: '0.8.28', executableSha256: '3'.repeat(64) },
  medusa: {
    status: 'completed', version: '1.5.1', goVersion: '1.24.0',
    executableSha256: '4'.repeat(64), compilerToolchainReady: true
  },
  pathEntryCount: 2
});

test('pins the recovered V7 Stage-2A tool versions', () => {
  assert.deepEqual(validateStage2aToolchainEvidence(toolchainEvidence(), { solidityVersion: '0.8.28' }), toolchainEvidence());
});

test('rejects Slither or Medusa version drift', () => {
  const slither = toolchainEvidence();
  slither.medusaCompiler.provider = 'slither-analyzer@0.11.5';
  assert.throws(() => validateStage2aToolchainEvidence(slither, { solidityVersion: '0.8.28' }), /medusaCompiler.provider/);
  const medusa = toolchainEvidence();
  medusa.medusa.version = '1.5.0';
  assert.throws(() => validateStage2aToolchainEvidence(medusa, { solidityVersion: '0.8.28' }), /medusa.version/);
});

test('plans Medusa before native fuzz when both are enabled', () => {
  assert.deepEqual(planStage2aAnalysis({ slither: true, medusa: true, nativeFuzz: true }), ['slither', 'medusa', 'native-fuzz']);
});

test('requires terminal Medusa evidence before native fuzz starts', () => {
  assert.throws(() => assertNativeFuzzMayStart({ status: 'running', backend: 'medusa' }), /terminal Medusa evidence/);
  assert.doesNotThrow(() => assertNativeFuzzMayStart({ status: 'failed', backend: 'medusa', authoritativeFinding: false }));
  assert.doesNotThrow(() => assertNativeFuzzMayStart({ status: 'disabled', backend: 'medusa', authoritativeFinding: false }));
  assert.doesNotThrow(() => assertNativeFuzzMayStart({ status: 'completed_with_failures', backend: 'medusa', authoritativeFinding: true }));
});

test('Stage-2A orchestrator executes Slither, then terminal Medusa, then native fuzz', async () => {
  const calls = [];
  const results = await runStage2aAnalysis({ slither: true, medusa: true, nativeFuzz: true }, {
    runSlither: async () => {
      calls.push('slither');
      return { backend: 'slither', status: 'completed', terminal: true };
    },
    runMedusa: async () => {
      calls.push('medusa');
      return { backend: 'medusa', status: 'completed_with_failures', terminal: true };
    },
    runNativeFuzz: async () => {
      calls.push('native-fuzz');
      return { backend: 'native-fuzz', status: 'completed', terminal: true };
    }
  });
  assert.deepEqual(calls, ['slither', 'medusa', 'native-fuzz']);
  assert.equal(results.medusa.status, 'completed_with_failures');
  assert.equal(results.nativeFuzz.status, 'completed');
});

test('Stage-2A orchestrator refuses to start native fuzz without terminal Medusa evidence', async () => {
  const calls = [];
  await assert.rejects(
    runStage2aAnalysis({ medusa: true, nativeFuzz: true }, {
      runMedusa: async () => {
        calls.push('medusa');
        return { backend: 'medusa', status: 'running', terminal: false };
      },
      runNativeFuzz: async () => {
        calls.push('native-fuzz');
        return { backend: 'native-fuzz', status: 'completed', terminal: true };
      }
    }),
    /terminal Medusa evidence/
  );
  assert.deepEqual(calls, ['medusa']);
});
