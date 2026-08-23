import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_FILES = 100;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024;
const ALLOWED_BASENAMES = new Set(['foundry.toml', 'medusa.json', 'remappings.txt']);
const ALLOWED_EXTENSIONS = new Set(['.sol']);

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function normalizedRelative(root, absolute) {
  return path.relative(root, absolute).split(path.sep).join('/');
}

async function listHarnessFiles(root, dir = root, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    const stat = await fs.lstat(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Auditor harness symlink is forbidden: ${normalizedRelative(root, absolute)}`);
    if (stat.isDirectory()) {
      await listHarnessFiles(root, absolute, out);
      continue;
    }
    if (!stat.isFile()) throw new Error(`Unsupported auditor harness filesystem entry: ${normalizedRelative(root, absolute)}`);
    const relative = normalizedRelative(root, absolute);
    if (relative.startsWith('../') || path.isAbsolute(relative)) throw new Error(`Unsafe auditor harness path: ${relative}`);
    const basename = path.posix.basename(relative);
    const extension = path.posix.extname(relative).toLowerCase();
    if (!ALLOWED_BASENAMES.has(basename) && !ALLOWED_EXTENSIONS.has(extension)) {
      throw new Error(`Unsupported auditor harness file type: ${relative}`);
    }
    out.push({ absolute, relative, size: stat.size });
    if (out.length > MAX_FILES) throw new Error(`Auditor harness exceeds ${MAX_FILES} files`);
  }
  return out;
}

async function validateHarnessCapabilities(files) {
  for (const file of files) {
    if (file.relative === 'foundry.toml') {
      const text = await fs.readFile(file.absolute, 'utf8');
      if (/\bffi\s*=\s*true\b/i.test(text)) throw new Error('Auditor Foundry harness may not enable ffi');
      if (/\bfs_permissions\b/i.test(text)) throw new Error('Auditor Foundry harness may not request fs_permissions');
    }
    if (file.relative === 'medusa.json') {
      const text = await fs.readFile(file.absolute, 'utf8');
      if (/"enableFFI"\s*:\s*true/i.test(text)) throw new Error('Auditor Medusa harness may not enable FFI');
      if (/"forkModeEnabled"\s*:\s*true/i.test(text) || /"rpcUrl"\s*:/i.test(text)) {
        throw new Error('Auditor Medusa Phase 6 harness may not enable fork mode or specify an RPC URL');
      }
    }
  }
}

export async function computeAuditorHarnessTreeSha256V1(auditHarnessRoot) {
  if (typeof auditHarnessRoot !== 'string' || auditHarnessRoot.length === 0) throw new Error('auditHarnessRoot is required');
  const files = (await listHarnessFiles(auditHarnessRoot)).sort((a, b) => a.relative.localeCompare(b.relative));
  if (files.length === 0) throw new Error('Auditor harness must contain at least one file');
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) throw new Error(`Auditor harness exceeds ${MAX_TOTAL_BYTES} bytes`);
  await validateHarnessCapabilities(files);

  const rows = [];
  for (const file of files) {
    const bytes = await fs.readFile(file.absolute);
    rows.push(`${file.relative}\0${bytes.length}\0${sha256(bytes)}`);
  }
  const manifest = `audit-v7-auditor-harness-tree-v1\n${rows.join('\n')}\n`;
  return sha256(Buffer.from(manifest, 'utf8'));
}

async function pathExists(value) {
  try {
    await fs.lstat(value);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export async function prepareAuditorHarnessOverlayV1({
  projectRoot,
  auditHarnessRoot,
  workspaceRoot,
  expectedTreeSha256,
}) {
  if (typeof projectRoot !== 'string' || typeof workspaceRoot !== 'string') throw new Error('projectRoot and workspaceRoot are required');
  if (typeof expectedTreeSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(expectedTreeSha256)) throw new Error('expectedTreeSha256 must be a 64-character lowercase SHA-256 digest');

  const files = (await listHarnessFiles(auditHarnessRoot)).sort((a, b) => a.relative.localeCompare(b.relative));
  await validateHarnessCapabilities(files);
  const actualTreeSha256 = await computeAuditorHarnessTreeSha256V1(auditHarnessRoot);
  if (actualTreeSha256 !== expectedTreeSha256) {
    throw new Error(`Auditor harness digest mismatch: expected ${expectedTreeSha256}, received ${actualTreeSha256}`);
  }

  for (const file of files) {
    const productionPath = path.join(projectRoot, ...file.relative.split('/'));
    if (await pathExists(productionPath)) throw new Error(`Auditor harness cannot overwrite frozen production path: ${file.relative}`);
  }

  const overlayRoot = path.resolve(workspaceRoot, 'auditor-harness-overlay');
  await fs.rm(overlayRoot, { recursive: true, force: true });
  await fs.mkdir(overlayRoot, { recursive: true });
  await fs.cp(projectRoot, overlayRoot, { recursive: true, force: false, errorOnExist: true });
  for (const file of files) {
    const destination = path.join(overlayRoot, ...file.relative.split('/'));
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(file.absolute, destination);
  }

  return {
    schemaVersion: 'audit-v7-auditor-harness-overlay-v1',
    overlayRoot,
    treeSha256: actualTreeSha256,
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    files: files.map((file) => file.relative),
    productionSourceMutation: false,
  };
}
