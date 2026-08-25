import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const workflowPath = path.join(repoRoot, '.github/workflows/audit-controller-execution.yml');
const cliPath = path.join(repoRoot, 'packages/github-native-sim/src/v7-cli.mjs');

test('canonical V7 execution emits sanitized durable result and controller evidence after execution', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const cli = fs.readFileSync(cliPath, 'utf8');

  assert.match(workflow, /npm run v7:execute -- --request \.v7-request\/request\.json/);
  assert.match(workflow, /path:\s*\.audit-evidence\/v7-execution/);

  assert.match(cli, /deploymentGasEvidence:\s*result\.deploymentGasEvidence/);
  assert.match(cli, /simulationEvidence:\s*result\.simulation/);
  assert.match(cli, /artifactDigest/);
  assert.match(cli, /failedStepCount:\s*result\.failedStepCount/);
  assert.match(cli, /controller-evidence\.json/);
  assert.match(cli, /execution-summary\.json/);
  assert.match(cli, /process\.stdout\.write\(`\$\{JSON\.stringify\(\{ \.\.\.summary, \.\.\.\(result\.error \? \{ error: result\.error \} : \{\}\) \}, null, 2\)\}\\n`\)/);
});
