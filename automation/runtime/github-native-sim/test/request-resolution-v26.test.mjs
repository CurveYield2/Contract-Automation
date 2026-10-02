import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveV7Request } from '../src/request-resolution-v1.mjs';
import { V2_AUTOMATION_RELEASE, V2_RUNNER_RELEASE } from '../src/schema.mjs';

test('dispatch resolver accepts controller-generated V26 execution request', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v7-resolve-v26-'));
  const requestPath = 'campaigns/Test Audit/controller/automation/op/EXECUTION_REQUEST_v1.json';
  const full = path.join(root, requestPath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  const request = {
    schemaVersion: 'deep-assurance-github-request-v2',
    processId: 'audit-v7-independent-review',
    contractAutomationRelease: V2_AUTOMATION_RELEASE,
    runnerRelease: V2_RUNNER_RELEASE,
    campaignId: 'test-audit-r1',
    assignmentId: 'phase0-bootstrap-build-static-sbom',
    phaseId: 'scope-and-provenance',
    gateId: 'phase0-bootstrap-technical-evidence',
    profileId: 'github-native-compile-v2',
    source: {
      repository: 'CurveYield2/Audits',
      commit: '1'.repeat(40),
      projectPath: 'workspace/contracts'
    },
    configuration: {
      compilers: [{ language: 'solidity', version: '0.8.30' }],
      timeoutMinutes: 35,
      analysis: { slither: { version: '0.11.6' } },
      v26: { phaseContractDigest: '2'.repeat(64) }
    },
    requestId: 'dar-' + '3'.repeat(32),
    requestDigest: '4'.repeat(64)
  };
  await fs.writeFile(full, JSON.stringify(request));
  const outputPath = path.join(root, '.v7-request', 'request.json');
  const result = await resolveV7Request({
    mode: 'dispatch',
    sourceRoot: root,
    requestPath,
    outputPath
  });
  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.requestKind, 'v7-execution');
  assert.equal(result.requestId, request.requestId);
  const resolved = JSON.parse(await fs.readFile(outputPath, 'utf8'));
  assert.deepEqual(resolved.configuration.v26, request.configuration.v26);
});
