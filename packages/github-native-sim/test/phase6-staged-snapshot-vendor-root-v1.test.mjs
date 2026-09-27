import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  copyPhase6SnapshotForExecution,
  digestDirectory,
} from '../src/phase6-staged-snapshot-v1.mjs';

test('archive execution snapshot preserves sibling frozen vendor roots', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'phase6-vendor-snapshot-'));
  try {
    const archiveRoot = path.join(temp, 'archive-source');
    const projectRoot = path.join(archiveRoot, 'workspace', 'contracts-repo', 'CurveYield DEX');
    const vendorRoot = path.join(archiveRoot, 'workspace', 'vendor', 'balancer-v3-upstream', 'pkg', 'interfaces');
    await fs.mkdir(path.join(projectRoot, 'contracts'), { recursive: true });
    await fs.mkdir(vendorRoot, { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'contracts', 'Example.sol'), 'contract Example {}\n');
    await fs.writeFile(path.join(vendorRoot, 'VENDOR_MARKER'), 'frozen\n');

    const digested = await digestDirectory(projectRoot);
    const snapshot = {
      commit: 'a'.repeat(40),
      projectRoot,
      archiveExtractionRoot: archiveRoot,
      projectRelativeToArchive: path.relative(archiveRoot, projectRoot).split(path.sep).join('/'),
      snapshotDigestSha256: digested.digestSha256,
      snapshotFileCount: digested.fileCount,
      snapshotBytes: digested.totalBytes,
      harnessOverlay: null,
    };

    const copied = await copyPhase6SnapshotForExecution(snapshot, {
      workspaceRoot: path.join(temp, 'execution'),
    });

    assert.equal(copied.snapshotDigestSha256, digested.digestSha256);
    assert.equal(
      await fs.readFile(path.join(copied.projectRoot, '..', '..', 'vendor', 'balancer-v3-upstream', 'pkg', 'interfaces', 'VENDOR_MARKER'), 'utf8'),
      'frozen\n',
    );
    assert.equal(
      await fs.readFile(path.join(copied.projectRoot, 'contracts', 'Example.sol'), 'utf8'),
      'contract Example {}\n',
    );
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
