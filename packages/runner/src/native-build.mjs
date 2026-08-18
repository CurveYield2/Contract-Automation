import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { runProcess } from '../../github-native-sim/src/execution.mjs';

const HARDHAT_CONFIGS = [
  'hardhat.config.js',
  'hardhat.config.cjs',
  'hardhat.config.mjs',
  'hardhat.config.ts'
];
const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json'];

async function exists(file, fsApi = fs) {
  try {
    const stat = await fsApi.stat(file);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function sha256File(file, fsApi = fs) {
  const bytes = await fsApi.readFile(file);
  return createHash('sha256').update(bytes).digest('hex');
}

export async function detectNativeBuild(projectRoot, { fsApi = fs } = {}) {
  const config = await firstPresent(projectRoot, HARDHAT_CONFIGS, fsApi);
  if (!config) return { system: 'solc-standard-json' };

  if (!await exists(path.join(projectRoot, 'package.json'), fsApi)) {
    throw new Error('Hardhat exact build requires package.json');
  }
  const lockfile = await firstPresent(projectRoot, LOCKFILES, fsApi);
  if (!lockfile) throw new Error('Hardhat exact build requires a committed npm lockfile');
  return { system: 'hardhat-native', config, lockfile };
}

async function firstPresent(root, names, fsApi) {
  for (const name of names) {
    if (await exists(path.join(root, name), fsApi)) return name;
  }
  return null;
}

async function buildInfoFiles(projectRoot, fsApi = fs) {
  const rootEntries = await fsApi.readdir(projectRoot, { withFileTypes: true });
  const artifactDirs = rootEntries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('artifacts'))
    .map((entry) => entry.name)
    .sort();
  const files = [];
  for (const artifactDir of artifactDirs) {
    const buildInfoDir = path.join(projectRoot, artifactDir, 'build-info');
    let entries;
    try {
      entries = await fsApi.readdir(buildInfoDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith('.json')).sort((a, b) => a.name.localeCompare(b.name))) {
      files.push(path.join(buildInfoDir, entry.name));
    }
  }
  return files;
}

async function listBuildInfo(projectRoot, fsApi = fs) {
  const output = [];
  for (const absolute of await buildInfoFiles(projectRoot, fsApi)) {
    let optimizerRuns = null;
    let solcVersion = null;
    try {
      const parsed = JSON.parse(await fsApi.readFile(absolute, 'utf8'));
      optimizerRuns = parsed?.input?.settings?.optimizer?.runs ?? null;
      solcVersion = parsed?.solcVersion ?? parsed?.solcLongVersion ?? null;
    } catch {
      // Raw build-info bytes remain evidence even if metadata parsing is unavailable.
    }
    output.push({
      path: path.relative(projectRoot, absolute).split(path.sep).join('/'),
      sha256: await sha256File(absolute, fsApi),
      optimizerRuns,
      solcVersion
    });
  }
  return output;
}

export async function collectNativeContractArtifacts(projectRoot, fsApi = fs) {
  const byQualifiedName = new Map();
  for (const absolute of await buildInfoFiles(projectRoot, fsApi)) {
    let parsed;
    try {
      parsed = JSON.parse(await fsApi.readFile(absolute, 'utf8'));
    } catch {
      continue;
    }
    for (const [sourceName, contracts] of Object.entries(parsed?.output?.contracts ?? {})) {
      for (const [contractName, raw] of Object.entries(contracts ?? {})) {
        const key = `${sourceName}:${contractName}`;
        const bytecodeObject = raw?.evm?.bytecode?.object ?? '';
        const candidate = {
          sourceName,
          contractName,
          bytecode: bytecodeObject ? `0x${String(bytecodeObject).replace(/^0x/, '')}` : '0x',
          gasEstimates: raw?.evm?.gasEstimates ?? null,
        };
        const existing = byQualifiedName.get(key);
        if (!existing || (existing.gasEstimates === null && candidate.gasEstimates !== null)) byQualifiedName.set(key, candidate);
      }
    }
  }
  return [...byQualifiedName.values()].sort((a, b) => `${a.sourceName}:${a.contractName}`.localeCompare(`${b.sourceName}:${b.contractName}`));
}

async function solidityInventory(projectRoot, fsApi = fs) {
  const files = [];
  async function walk(directory) {
    for (const entry of await fsApi.readdir(directory, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'cache', 'dist', 'build', 'out'].includes(entry.name) || entry.name.startsWith('artifacts')) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && entry.name.endsWith('.sol')) files.push(path.relative(projectRoot, absolute).split(path.sep).join('/'));
    }
  }
  await walk(projectRoot);
  files.sort();
  return files;
}

function commandFailure(message, result) {
  const error = new Error(message);
  error.code = 'native_build_failed';
  error.result = {
    exitCode: Number.isInteger(result?.exitCode) ? result.exitCode : -1,
    stdout: String(result?.stdout ?? ''),
    stderr: String(result?.stderr ?? '')
  };
  return error;
}

export async function compileRepoNativeHardhat({
  projectRoot,
  runCommand = runProcess,
  fsApi = fs
}) {
  const detected = await detectNativeBuild(projectRoot, { fsApi });
  if (detected.system !== 'hardhat-native') throw new Error('Repository is not an admitted Hardhat native build');

  const install = await runCommand({
    command: 'npm',
    args: ['ci', '--ignore-scripts', '--no-audit', '--no-fund'],
    cwd: projectRoot
  });
  if (!install || install.exitCode !== 0) throw commandFailure('Hardhat locked dependency installation failed', install);

  const compile = await runCommand({
    command: 'npx',
    args: ['--no-install', 'hardhat', 'compile'],
    cwd: projectRoot
  });
  if (!compile || compile.exitCode !== 0) throw commandFailure('Repository-native Hardhat compilation failed', compile);

  const buildInfo = await listBuildInfo(projectRoot, fsApi);
  const artifacts = await collectNativeContractArtifacts(projectRoot, fsApi);
  const sources = await solidityInventory(projectRoot, fsApi);
  return {
    status: 'completed',
    system: 'hardhat-native',
    config: detected.config,
    lockfile: detected.lockfile,
    compileOutput: {
      exitCode: compile.exitCode,
      stdout: String(compile.stdout ?? ''),
      stderr: String(compile.stderr ?? '')
    },
    buildInfo,
    buildInfoCount: buildInfo.length,
    artifacts,
    sourceInventory: sources,
    sourceInventoryFiles: sources.length
  };
}
