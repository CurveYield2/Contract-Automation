import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkRunnerManifestV2 } from '../packages/github-native-sim/src/runner-manifest-v2.mjs';
import { V7_POLICY } from '../packages/github-native-sim/src/v7-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const excluded = new Set(['node_modules', '.git', 'dist']);
const files = [];
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else if (entry.isFile() && /\.(?:mjs|js)$/.test(entry.name)) files.push(absolute);
  }
}
await walk(root);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`Syntax check failed: ${path.relative(root, file)}`);
  }
}

const authoritativeRoots = [
  path.join(root, 'packages', 'github-native-sim', 'src'),
  path.join(root, 'packages', 'runner', 'src'),
];
for (const file of files) {
  if (!authoritativeRoots.some((prefix) => file.startsWith(`${prefix}${path.sep}`) || file === prefix)) continue;
  const source = await fs.readFile(file, 'utf8');
  if (/\b(?:from\s+['"]ganache['"]|require\(\s*['"]ganache['"]\s*\)|import\(\s*['"]ganache['"]\s*\))/.test(source)) {
    throw new Error(`Authoritative V7 execution code may not import Ganache: ${path.relative(root, file)}`);
  }
}

const workflowRoot = path.join(root, '.github', 'workflows');
const workflowNames = await fs.readdir(workflowRoot);
const forbiddenVersionedWorkflows = workflowNames.filter((name) =>
  /^audit-controller-execution-v\d+\.yml$/.test(name)
  || /^v7-execution-infrastructure-qualification-v\d+\.yml$/.test(name)
  || /^v7-(?:recovery|v8-conformance).*\.yml$/.test(name)
);
if (forbiddenVersionedWorkflows.length > 0) {
  throw new Error(`Superseded/versioned V7 workflow entrypoints belong in CurveYield2/archive, not this repository: ${forbiddenVersionedWorkflows.join(', ')}`);
}
for (const required of ['audit-controller-execution.yml', 'v7-execution-infrastructure-qualification.yml']) {
  if (!workflowNames.includes(required)) throw new Error(`Missing canonical V7 workflow: ${required}`);
}

const processNames = await fs.readdir(path.join(root, 'process'));
const staleManifests = processNames.filter((name) => /^RUNNER_MANIFEST_v\d+\.json$/.test(name) || /^V7_BRIDGE_SMOKE_RECEIPT_v\d+\.json$/.test(name));
if (staleManifests.length > 0) throw new Error(`Superseded process artifacts belong in CurveYield2/archive: ${staleManifests.join(', ')}`);

const skeletonParent = path.join(root, 'packages', 'github-native-sim');
const skeletonEntries = await fs.readdir(skeletonParent, { withFileTypes: true });
const canonicalSkeletonDir = path.basename(V7_POLICY.phase6.skeletonRoot);
const staleSkeletonKits = skeletonEntries
  .filter((entry) => entry.isDirectory() && /^harness-skeletons-v\d+$/.test(entry.name) && entry.name !== canonicalSkeletonDir)
  .map((entry) => entry.name);
if (staleSkeletonKits.length > 0) {
  throw new Error(`Superseded Phase 6 skeleton kits belong in CurveYield2/archive: ${staleSkeletonKits.join(', ')}`);
}

const manifestCheck = await checkRunnerManifestV2({ runnerRoot: root });
if (manifestCheck.status !== 'PASS') throw new Error(`Canonical runner manifest drift: ${manifestCheck.reason ?? 'unknown'}`);

console.log(`Syntax valid: ${files.length} JavaScript modules; V7 canonical/Archive/Anvil policy guards valid`);
