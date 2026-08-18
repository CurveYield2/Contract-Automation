import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { validateDeepAssuranceRequestV2 } from './schema.mjs';

export class V7ExecutionError extends Error {
  constructor(kind, message, details = {}) {
    super(`${kind}: ${message}`);
    this.name = 'V7ExecutionError';
    this.kind = kind;
    this.details = details;
  }
}

export function safeRepositoryProjectPath(root, relativePath) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new V7ExecutionError('UNSAFE_PROJECT_PATH', 'workspace root is required');
  }
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new V7ExecutionError('UNSAFE_PROJECT_PATH', 'project path is required');
  }
  const normalized = relativePath.replaceAll('\\', '/');
  if (normalized.startsWith('/') || normalized === '..' || normalized.split('/').some((part) => part === '..' || part === '')) {
    throw new V7ExecutionError('UNSAFE_PROJECT_PATH', `unsafe repository-relative path: ${relativePath}`);
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, normalized);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new V7ExecutionError('UNSAFE_PROJECT_PATH', `path escapes repository root: ${relativePath}`);
  }
  return resolved;
}

export function runProcess({ command, args = [], cwd, env = process.env }) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const child = spawn(command, args, { cwd, env, shell: false });
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      resolve({ exitCode: -1, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      resolve({ exitCode: Number.isInteger(code) ? code : -1, signal: signal ?? null, stdout, stderr });
    });
  });
}

async function requireSuccess(result, kind, command, args) {
  if (!result || result.exitCode !== 0) {
    throw new V7ExecutionError(kind, `${command} ${args.join(' ')} failed`, {
      exitCode: result?.exitCode ?? -1,
      stdout: result?.stdout ?? '',
      stderr: result?.stderr ?? ''
    });
  }
  return result;
}

export async function checkoutExactSource({ repository, commit, destination }, { runCommand = runProcess } = {}) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '')) {
    throw new V7ExecutionError('SOURCE_INTEGRITY_FAILURE', 'repository must be owner/repository');
  }
  if (!/^[0-9a-f]{40}$/.test(commit ?? '')) {
    throw new V7ExecutionError('SOURCE_INTEGRITY_FAILURE', 'commit must be exactly 40 lowercase hex characters');
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const init = await runCommand({ command: 'git', args: ['init', destination], cwd: path.dirname(destination) });
  await requireSuccess(init, 'SOURCE_CHECKOUT_FAILURE', 'git', ['init', destination]);
  const remote = `https://github.com/${repository}.git`;
  const addRemote = await runCommand({ command: 'git', args: ['remote', 'add', 'origin', remote], cwd: destination });
  await requireSuccess(addRemote, 'SOURCE_CHECKOUT_FAILURE', 'git', ['remote', 'add', 'origin', remote]);
  const fetch = await runCommand({ command: 'git', args: ['fetch', '--depth', '1', 'origin', commit], cwd: destination });
  await requireSuccess(fetch, 'SOURCE_CHECKOUT_FAILURE', 'git', ['fetch', '--depth', '1', 'origin', commit]);
  const checkout = await runCommand({ command: 'git', args: ['checkout', '--detach', 'FETCH_HEAD'], cwd: destination });
  await requireSuccess(checkout, 'SOURCE_CHECKOUT_FAILURE', 'git', ['checkout', '--detach', 'FETCH_HEAD']);
  const rev = await runCommand({ command: 'git', args: ['rev-parse', 'HEAD'], cwd: destination });
  await requireSuccess(rev, 'SOURCE_CHECKOUT_FAILURE', 'git', ['rev-parse', 'HEAD']);
  const resolvedCommit = String(rev.stdout ?? '').trim();
  if (resolvedCommit !== commit) {
    throw new V7ExecutionError('SOURCE_INTEGRITY_FAILURE', 'checked-out commit does not match requested commit', {
      expectedCommit: commit,
      actualCommit: resolvedCommit
    });
  }
  return { repository, commit: resolvedCommit, destination };
}

export async function sha256File(filePath) {
  const bytes = await fs.readFile(filePath);
  return createHash('sha256').update(bytes).digest('hex');
}

export async function runPinnedBuild(input, {
  workspaceRoot,
  build,
  checkoutExactSourceFn = checkoutExactSource,
  runCommand = runProcess,
  digestFile = sha256File
} = {}) {
  const request = validateDeepAssuranceRequestV2(input);
  if (!workspaceRoot) throw new V7ExecutionError('SOURCE_CHECKOUT_FAILURE', 'workspaceRoot is required');
  if (!build || typeof build.command !== 'string' || build.command.length === 0) {
    throw new V7ExecutionError('COMPILE_FAILURE', 'build command is required');
  }
  if (!build.compiler || typeof build.compiler.name !== 'string' || typeof build.compiler.version !== 'string') {
    throw new V7ExecutionError('COMPILE_FAILURE', 'compiler identity is required');
  }

  await fs.mkdir(workspaceRoot, { recursive: true });
  const checkoutRoot = path.join(workspaceRoot, 'checkout');
  const checkout = await checkoutExactSourceFn({
    repository: request.source.repository,
    commit: request.source.commit,
    destination: checkoutRoot
  }, { runCommand });
  if (!checkout || checkout.commit !== request.source.commit) {
    throw new V7ExecutionError('SOURCE_INTEGRITY_FAILURE', 'checkout did not return the requested commit', {
      expectedCommit: request.source.commit,
      actualCommit: checkout?.commit ?? null
    });
  }

  const projectRoot = safeRepositoryProjectPath(checkoutRoot, request.source.projectPath);
  const args = Array.isArray(build.args) ? [...build.args] : [];
  const commandResult = await runCommand({ command: build.command, args, cwd: projectRoot });
  if (!commandResult || commandResult.exitCode !== 0) {
    throw new V7ExecutionError('COMPILE_FAILURE', 'compiler/build command failed', {
      command: build.command,
      args,
      exitCode: commandResult?.exitCode ?? -1,
      stdout: commandResult?.stdout ?? '',
      stderr: commandResult?.stderr ?? ''
    });
  }

  const artifacts = [];
  for (const artifactPath of build.artifactPaths ?? []) {
    const absolute = safeRepositoryProjectPath(projectRoot, artifactPath);
    let stats;
    try {
      stats = await fs.stat(absolute);
    } catch (error) {
      throw new V7ExecutionError('ARTIFACT_MISSING', `expected artifact is missing: ${artifactPath}`, { cause: error.message });
    }
    if (!stats.isFile()) throw new V7ExecutionError('ARTIFACT_MISSING', `expected artifact is not a file: ${artifactPath}`);
    artifacts.push({ path: artifactPath.replaceAll('\\', '/'), sha256: await digestFile(absolute), bytes: stats.size });
  }

  return {
    schemaVersion: 'deep-assurance-pinned-build-evidence/v1',
    source: structuredClone(request.source),
    checkout: {
      repository: request.source.repository,
      commit: checkout.commit
    },
    compiler: structuredClone(build.compiler),
    command: {
      command: build.command,
      args,
      exitCode: commandResult.exitCode
    },
    artifacts
  };
}
