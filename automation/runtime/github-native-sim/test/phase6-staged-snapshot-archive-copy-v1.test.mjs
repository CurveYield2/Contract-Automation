import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  copyPhase6SnapshotForExecution,
  digestDirectory,
} from '../src/phase6-staged-snapshot-v1.mjs';

test('archive-backed execution copy preserves vendor roots outside the project subtree', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'phase6-archive-copy-'));
  try {
    const archiveExtractionRoot = path.join(root, 'archive-source');
    const projectRoot = path.join(archiveExtractionRoot, 'workspace', 'contracts-repo', 'CurveYield DEX');
    const vendorRoot = path.join(archiveExtractionRoot, 'workspace', 'vendor', 'balancer-v3-upstream');
    await fs.mkdir(path.join(projectRoot, 'contracts'), { recursive: true });
    await fs.mkdir(vendorRoot, { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'contracts', 'Vault.sol'), 'contract Vault {}\n');
    await fs.writeFile(path.join(projectRoot, 'package-lock.json'), '{"lockfileVersion":3}\n');
    await fs.writeFile(path.join(vendorRoot, 'marker.txt'), 'frozen vendor root\n');

    const sourceDigest = await digestDirectory(projectRoot);
    const copied = await copyPhase6SnapshotForExecution({
      commit: 'a'.repeat(40),
      projectRoot,
      archiveExtractionRoot,
      snapshotDigestSha256: sourceDigest.digestSha256,
      harnessOverlay: null,
    }, {
      workspaceRoot: path.join(root, 'execution-work'),
    });

    assert.equal(copied.snapshotDigestSha256, sourceDigest.digestSha256);
    assert.equal(
      await fs.readFile(path.join(copied.projectRoot, 'contracts', 'Vault.sol'), 'utf8'),
      'contract Vault {}\n',
    );
    assert.equal(
      await fs.readFile(path.resolve(copied.projectRoot, '..', '..', 'vendor', 'balancer-v3-upstream', 'marker.txt'), 'utf8'),
      'frozen vendor root\n',
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
