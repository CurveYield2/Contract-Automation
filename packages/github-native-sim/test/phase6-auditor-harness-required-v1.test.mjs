import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runPhase6ExecutionPreflightV1 } from '../src/phase6-execution-preflight-v1.mjs';

function request() {
  return {
    requestId: 'dar-11111111111111111111111111111111',
    phaseId: 'build-and-test',
    profileId: 'github-native-simulate-v2',
    source: { commit: '1111111111111111111111111111111111111111' },
    contractAutomationRelease: { repository: 'CurveYield2/Contract-Automation' },
    runnerRelease: { version: 'deep-assurance-github-bridge-v1' },
    configuration: {
      compilers: [{ language: 'solidity', version: '0.8.28' }],
      analysis: {
        medusa: { version: '1.5.1' },
        nativeFuzz: { enabled: true, fuzzRuns: 1000, recoverableExitCodes: [] },
      },
    },
  };
}

test('missing target-package harness requires auditor harness construction instead of NOT_APPLICABLE', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'phase6-auditor-harness-'));
  await fs.mkdir(path.join(root, 'contracts'));
  await fs.writeFile(path.join(root, 'contracts', 'Target.sol'), 'pragma solidity ^0.8.28; contract Target { uint256 public x; }\n');
  let toolChecks = 0;

  const result = await runPhase6ExecutionPreflightV1({
    request: request(),
    projectRoot: root,
    runnerCommit: '2222222222222222222222222222222222222222',
    runCommand: async () => {
      toolChecks += 1;
      return { exitCode: 0, stdout: 'available', stderr: '' };
    },
  });

  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.medusa.status, 'HARNESS_REQUIRED');
  assert.equal(result.medusa.harnessApplicable, true);
  assert.equal(result.medusa.harnessOrigin, 'AUDITOR_GENERATED_REQUIRED');
  assert.equal(result.nativeFuzz.status, 'HARNESS_REQUIRED');
  assert.equal(result.nativeFuzz.harnessApplicable, true);
  assert.equal(result.nativeFuzz.harnessOrigin, 'AUDITOR_GENERATED_REQUIRED');
  assert.equal(result.nextState, 'PHASE6_HARNESS_CONSTRUCTION');
  assert.equal(toolChecks, 0, 'tool availability is checked only after the auditor-generated harness exists');
});
