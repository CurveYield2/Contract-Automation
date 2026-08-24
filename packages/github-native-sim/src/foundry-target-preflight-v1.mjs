import fs from 'node:fs/promises';
import path from 'node:path';
import { digestDirectory } from './phase6-staged-snapshot-v1.mjs';
import { preflightFoundryV1 } from './preflight/foundry-v1.mjs';
import { V7_POLICY } from './v7-policy.mjs';

const DEFAULT_FUZZ_RUNS = 16;
const FORGE_FAILED_SUITE = /Suite result:\s*FAILED\b|Encountered a total of [1-9][0-9]* failing tests\b/i;
const FORGE_TEST_NAME = /^(?:test[A-Za-z0-9_]*|invariant_[A-Za-z0-9_]*)(?:\([^)]*\))?$/;

function redact(value, secret) {
  const text = String(value ?? '');
  if (typeof secret !== 'string' || secret.length === 0) return text;
  return text.replaceAll(secret, '<redacted-mutable-anvil-rpc>');
}

async function copyProject(source, destination) {
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, {
    recursive: true,
    preserveTimestamps: true,
    filter: (entry) => {
      const base = path.basename(entry);
      return base !== '.git' && base !== 'node_modules' && base !== 'out' && base !== 'cache';
    },
  });
}

function parseVersion(stdout, stderr) {
  const match = `${stdout ?? ''}\n${stderr ?? ''}`.match(/forge Version:\s*([0-9]+\.[0-9]+\.[0-9]+)/i);
  return match?.[1] ?? null;
}

function parseDiscoveredTests(stdout) {
  const names = [];
  for (const line of String(stdout ?? '').split(/\r?\n/)) {
    const candidate = line.trim();
    if (FORGE_TEST_NAME.test(candidate) && !names.includes(candidate)) names.push(candidate);
  }
  return names;
}

function terminalMedusa(status) {
  return ['COMPLETED', 'COMPLETED_WITH_FAILURES', 'FAILED', 'PROPERTY_FALSIFICATION', 'NO_TESTS_DISCOVERED'].includes(status);
}

function semanticSuiteStatus(result) {
  const raw = `${result?.stdout ?? ''}\n${result?.stderr ?? ''}`;
  if (FORGE_FAILED_SUITE.test(raw)) return 'FAIL';
  if (result?.exitCode !== 0) return 'FAIL';
  return 'PASS';
}

export async function runTargetFoundryPreflightV1({
  projectRoot,
  sourceCommit,
  snapshotDigestSha256,
  expectedSnapshotDigestSha256 = snapshotDigestSha256,
  medusaTerminalStatus,
  rpcUrl,
  rpcProfile,
  rpcChainId = 1,
  rpcBlock,
  rpcBlockHash,
  workspaceRoot = null,
  fuzzRuns = DEFAULT_FUZZ_RUNS,
  invariantRequired = false,
  coverageObligationsValid = true,
  outputPathsWritable = true,
} = {}, { runCommand } = {}) {
  if (typeof projectRoot !== 'string' || projectRoot.length === 0) throw new Error('Foundry target preflight requires projectRoot');
  if (typeof sourceCommit !== 'string' || !/^[0-9a-f]{40}$/.test(sourceCommit)) throw new Error('Foundry target preflight requires sourceCommit');
  if (typeof expectedSnapshotDigestSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(expectedSnapshotDigestSha256)) throw new Error('Foundry target preflight requires expected snapshot digest');
  if (typeof runCommand !== 'function') throw new Error('Foundry target preflight requires runCommand');
  if (!Number.isInteger(fuzzRuns) || fuzzRuns < 1 || fuzzRuns > 256) throw new Error('Foundry target smoke fuzzRuns must be 1..256');

  const observedSource = await digestDirectory(projectRoot);
  const sourceMatches = observedSource.digestSha256 === expectedSnapshotDigestSha256;
  const smokeRoot = workspaceRoot ? path.join(workspaceRoot, 'foundry-target-preflight') : path.join(path.dirname(projectRoot), `${path.basename(projectRoot)}-foundry-preflight`);

  const versionResult = await runCommand({ command: 'forge', args: ['--version'], cwd: projectRoot });
  const observedVersion = parseVersion(versionResult.stdout, versionResult.stderr);

  if (!terminalMedusa(medusaTerminalStatus)) {
    return preflightFoundryV1({
      repository: 'CurveYield2/Contract-Automation', ref: sourceCommit,
      observedVersion,
      medusaPredecessorRequired: true, medusaTerminalStatus,
      sourceSnapshotDigest: observedSource.digestSha256, expectedSourceSnapshotDigest: expectedSnapshotDigestSha256,
      compileProbe: { status: sourceMatches ? 'PASS' : 'FAIL', reason: sourceMatches ? null : 'SOURCE_SNAPSHOT_MISMATCH' },
      discoveredTestCount: 0, discoveredTests: [],
      invariantRequired, discoveredHandlerCount: invariantRequired ? 0 : null,
      forkRequired: Boolean(rpcUrl), expectedBlockHash: rpcBlockHash,
      rpcProbe: { chainId: rpcChainId, blockHash: rpcBlockHash, blockNumber: rpcBlock, profile: rpcProfile },
      semanticSmokeStatus: 'NOT_RUN',
      coverageObligationsValid, outputPathsWritable,
    });
  }

  if (!sourceMatches) {
    return preflightFoundryV1({
      repository: 'CurveYield2/Contract-Automation', ref: sourceCommit,
      observedVersion,
      medusaPredecessorRequired: true, medusaTerminalStatus,
      sourceSnapshotDigest: observedSource.digestSha256, expectedSourceSnapshotDigest: expectedSnapshotDigestSha256,
      compileProbe: { status: 'FAIL', reason: 'SOURCE_SNAPSHOT_MISMATCH' },
      discoveredTestCount: 0, discoveredTests: [], invariantRequired, discoveredHandlerCount: 0,
      forkRequired: Boolean(rpcUrl), expectedBlockHash: rpcBlockHash,
      rpcProbe: { chainId: rpcChainId, blockHash: rpcBlockHash, blockNumber: rpcBlock, profile: rpcProfile },
      semanticSmokeStatus: 'NOT_RUN', coverageObligationsValid, outputPathsWritable,
    });
  }

  await copyProject(projectRoot, smokeRoot);
  const copied = await digestDirectory(smokeRoot);
  if (copied.digestSha256 !== expectedSnapshotDigestSha256) {
    const error = new Error(`FOUNDRY_TARGET_SMOKE_COPY_MISMATCH: expected ${expectedSnapshotDigestSha256}, observed ${copied.digestSha256}`);
    error.code = 'FOUNDRY_TARGET_SMOKE_COPY_MISMATCH';
    throw error;
  }

  const listResult = await runCommand({ command: 'forge', args: ['test', '--list'], cwd: smokeRoot });
  const discoveredTests = parseDiscoveredTests(listResult.stdout);
  const listSemanticFailure = semanticSuiteStatus(listResult) === 'FAIL';
  const compileProbe = listSemanticFailure
    ? { status: 'FAIL', exitCode: listResult.exitCode, stderr: redact(listResult.stderr, rpcUrl), stdout: redact(listResult.stdout, rpcUrl) }
    : { status: 'PASS', exitCode: listResult.exitCode };

  let smokeResult = null;
  if (!listSemanticFailure && discoveredTests.length > 0) {
    const args = ['test', '--fuzz-runs', String(fuzzRuns)];
    if (rpcUrl) args.push('--fork-url', rpcUrl, '--fork-block-number', String(rpcBlock));
    smokeResult = await runCommand({ command: 'forge', args, cwd: smokeRoot, env: rpcUrl ? { ETH_RPC_URL: rpcUrl } : undefined });
  }
  const semanticStatus = smokeResult ? semanticSuiteStatus(smokeResult) : 'NOT_RUN';
  const rawSmoke = smokeResult ? {
    exitCode: smokeResult.exitCode,
    stdout: redact(smokeResult.stdout, rpcUrl),
    stderr: redact(smokeResult.stderr, rpcUrl),
  } : null;
  const rpcSecretExposed = typeof rpcUrl === 'string' && rpcUrl.length > 0 && JSON.stringify(rawSmoke).includes(rpcUrl);

  const receipt = preflightFoundryV1({
    repository: 'CurveYield2/Contract-Automation', ref: sourceCommit,
    observedVersion,
    medusaPredecessorRequired: true, medusaTerminalStatus,
    sourceSnapshotDigest: observedSource.digestSha256, expectedSourceSnapshotDigest: expectedSnapshotDigestSha256,
    compileProbe,
    discoveredTestCount: discoveredTests.length, discoveredTests,
    invariantRequired,
    discoveredHandlerCount: invariantRequired ? discoveredTests.filter((name) => name.startsWith('invariant_')).length : null,
    forkRequired: Boolean(rpcUrl), expectedBlockHash: rpcBlockHash,
    rpcProbe: { chainId: rpcChainId, blockHash: rpcBlockHash, blockNumber: rpcBlock, profile: rpcProfile },
    semanticSmokeStatus: semanticStatus,
    semanticSmokeRaw: rawSmoke,
    normalizedEvidenceContainsRpcSecret: rpcSecretExposed,
    coverageObligationsValid, outputPathsWritable,
    expectedOutputs: ['foundry-target-preflight-receipt'],
  });

  return {
    ...receipt,
    targetSmoke: {
      schemaVersion: 'foundry-target-smoke-evidence-v1',
      sourceSnapshotDigest: observedSource.digestSha256,
      actualProjectCopy: true,
      copiedSnapshotDigest: copied.digestSha256,
      discoveredTestCount: discoveredTests.length,
      discoveredTests,
      semanticSuiteStatus: semanticStatus,
      fuzzRuns,
      fork: Boolean(rpcUrl) ? { chainId: rpcChainId, profile: rpcProfile, blockNumber: rpcBlock, blockHash: rpcBlockHash, rpcUrlExposed: false } : { mode: 'NOT_REQUIRED' },
      rawOutput: rawSmoke,
    },
  };
}
