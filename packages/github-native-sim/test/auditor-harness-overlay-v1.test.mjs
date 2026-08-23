import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  computeAuditorHarnessTreeSha256V1,
  prepareAuditorHarnessOverlayV1,
} from '../src/auditor-harness-overlay-v1.mjs';

async function roots() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-overlay-'));
  const projectRoot = path.join(root, 'target');
  const auditHarnessRoot = path.join(root, 'harness');
  const workspaceRoot = path.join(root, 'workspace');
  await fs.mkdir(path.join(projectRoot, 'contracts'), { recursive: true });
  await fs.mkdir(path.join(auditHarnessRoot, 'test'), { recursive: true });
  await fs.writeFile(path.join(projectRoot, 'contracts', 'Target.sol'), 'pragma solidity ^0.8.28; contract Target { uint256 public x; }\n');
  await fs.writeFile(path.join(auditHarnessRoot, 'foundry.toml'), '[profile.default]\nsrc="contracts"\ntest="test"\nffi=false\n');
  await fs.writeFile(path.join(auditHarnessRoot, 'medusa.json'), '{"fuzzing":{"testLimit":1000}}\n');
  await fs.writeFile(path.join(auditHarnessRoot, 'test', 'TargetAudit.t.sol'), 'pragma solidity ^0.8.28; contract TargetAudit { function invariant_safe() public pure returns(bool){return true;} }\n');
  return { projectRoot, auditHarnessRoot, workspaceRoot };
}

test('auditor harness overlay is hash-bound and cannot mutate frozen production paths', async () => {
  const { projectRoot, auditHarnessRoot, workspaceRoot } = await roots();
  const digest = await computeAuditorHarnessTreeSha256V1(auditHarnessRoot);
  const prepared = await prepareAuditorHarnessOverlayV1({ projectRoot, auditHarnessRoot, workspaceRoot, expectedTreeSha256: digest });

  assert.equal(prepared.treeSha256, digest);
  assert.equal(await fs.readFile(path.join(prepared.overlayRoot, 'contracts', 'Target.sol'), 'utf8'), 'pragma solidity ^0.8.28; contract Target { uint256 public x; }\n');
  assert.match(await fs.readFile(path.join(prepared.overlayRoot, 'test', 'TargetAudit.t.sol'), 'utf8'), /invariant_safe/);
  assert.equal(prepared.productionSourceMutation, false);

  await fs.writeFile(path.join(auditHarnessRoot, 'test', 'TargetAudit.t.sol'), 'changed\n');
  await assert.rejects(
    prepareAuditorHarnessOverlayV1({ projectRoot, auditHarnessRoot, workspaceRoot: `${workspaceRoot}-changed`, expectedTreeSha256: digest }),
    /digest mismatch/i,
  );
});

test('auditor harness overlay rejects production overwrite and dangerous Foundry capabilities', async () => {
  const first = await roots();
  await fs.mkdir(path.join(first.auditHarnessRoot, 'contracts'), { recursive: true });
  await fs.writeFile(path.join(first.auditHarnessRoot, 'contracts', 'Target.sol'), 'malicious replacement\n');
  const overwriteDigest = await computeAuditorHarnessTreeSha256V1(first.auditHarnessRoot);
  await assert.rejects(
    prepareAuditorHarnessOverlayV1({ ...first, expectedTreeSha256: overwriteDigest }),
    /overwrite frozen production/i,
  );

  const second = await roots();
  await fs.writeFile(path.join(second.auditHarnessRoot, 'foundry.toml'), '[profile.default]\nffi=true\n');
  const ffiDigest = await computeAuditorHarnessTreeSha256V1(second.auditHarnessRoot);
  await assert.rejects(
    prepareAuditorHarnessOverlayV1({ ...second, expectedTreeSha256: ffiDigest }),
    /ffi/i,
  );
});
