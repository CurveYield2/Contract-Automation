import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runTargetCompilePreflightV1 } from '../src/compile-target-preflight-v1.mjs';
import { digestDirectory } from '../src/phase6-staged-snapshot-v1.mjs';

async function project({ withOpenZeppelin = true, solcVersion = '0.8.28' } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'compile-target-preflight-'));
  await fs.mkdir(path.join(root, 'contracts', 'interfaces'), { recursive: true });
  await fs.writeFile(path.join(root, 'foundry.toml'), `[profile.default]\nsrc="contracts"\nlibs=["lib"]\nsolc_version="${solcVersion}"\nremappings=["@openzeppelin/=lib/openzeppelin-contracts/"]\n`);
  await fs.writeFile(path.join(root, 'contracts', 'interfaces', 'IVault.sol'), 'pragma solidity ^0.8.28; interface IVault { function totalAssets() external view returns (uint256); }\n');
  await fs.writeFile(path.join(root, 'contracts', 'Strategy.sol'), 'pragma solidity ^0.8.28; import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol"; import {IVault} from "./interfaces/IVault.sol"; contract Strategy is Ownable { IVault public vault; constructor(address owner_, IVault v) Ownable(owner_) { vault=v; } }\n');
  if (withOpenZeppelin) {
    await fs.mkdir(path.join(root, 'lib', 'openzeppelin-contracts', 'contracts', 'access'), { recursive: true });
    await fs.writeFile(path.join(root, 'lib', 'openzeppelin-contracts', 'contracts', 'access', 'Ownable.sol'), 'pragma solidity ^0.8.20; abstract contract Ownable { constructor(address) {} }\n');
  }
  return root;
}

function commands({ forgeVersion = '1.7.1', vyperVersion = '0.4.3' } = {}) {
  return async ({ command, args }) => {
    if (command === 'forge' && args[0] === '--version') return { exitCode: 0, stdout: `forge Version: ${forgeVersion}`, stderr: '' };
    if (command === 'forge' && args[0] === 'remappings') return { exitCode: 0, stdout: '@openzeppelin/=lib/openzeppelin-contracts/\n', stderr: '' };
    if (command === 'vyper' && args[0] === '--version') return { exitCode: 0, stdout: `${vyperVersion}+commit.preflight`, stderr: '' };
    throw new Error(`unexpected command ${command} ${(args ?? []).join(' ')}`);
  };
}

async function input(root, overrides = {}) {
  const snapshot = await digestDirectory(root);
  return {
    projectRoot: root,
    sourceSnapshotDigest: snapshot.digestSha256,
    expectedSourceSnapshotDigest: snapshot.digestSha256,
    requestedCompilers: [{ language: 'solidity', version: '0.8.28' }],
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'cancun',
    viaIR: false,
    expectedArtifacts: ['contracts/Strategy.sol:Strategy'],
    ...overrides,
  };
}

test('compile target preflight resolves the actual Foundry import graph before build', async () => {
  const root = await project();
  const receipt = await runTargetCompilePreflightV1(await input(root), { runCommand: commands() });
  assert.equal(receipt.status, 'PREFLIGHT_PASS');
  assert.equal(receipt.importGraph.unresolvedImports.length, 0);
  assert.equal(receipt.importGraph.imports.some((x) => x.specifier.includes('@openzeppelin')), true);
  assert.equal(receipt.buildView.manifest, 'foundry.toml');
});

test('compile target preflight reproduces BoostHub v4 unresolved OpenZeppelin import failure with exact paths', async () => {
  const root = await project({ withOpenZeppelin: false });
  const receipt = await runTargetCompilePreflightV1(await input(root), { runCommand: commands() });
  assert.equal(receipt.status, 'PREFLIGHT_FAIL');
  assert.equal(receipt.firstFailure, 'COMPILE_IMPORT_GRAPH_UNRESOLVED');
  const failure = receipt.diagnostics.find((x) => x.failureCode === 'COMPILE_IMPORT_GRAPH_UNRESOLVED');
  assert.equal(failure.historicalSignatureId, 'COMPILE-001');
  assert.match(JSON.stringify(failure.observed), /@openzeppelin\/contracts\/access\/Ownable\.sol/);
  assert.match(failure.remediation, /dependency|remapping|project root/i);
});

test('compile target preflight rejects a package root that is not the actual build root', async () => {
  const outer = await fs.mkdtemp(path.join(os.tmpdir(), 'compile-wrong-root-'));
  const nested = path.join(outer, 'package');
  await fs.mkdir(nested, { recursive: true });
  await fs.writeFile(path.join(nested, 'foundry.toml'), '[profile.default]\n');
  const snapshot = await digestDirectory(outer);
  const receipt = await runTargetCompilePreflightV1({ ...(await input(outer)), sourceSnapshotDigest: snapshot.digestSha256, expectedSourceSnapshotDigest: snapshot.digestSha256 }, { runCommand: commands() });
  assert.equal(receipt.firstFailure, 'COMPILE_PROJECT_ROOT_BUILD_MANIFEST_MISSING');
  assert.match(JSON.stringify(receipt.diagnostics), /package\/foundry\.toml/);
});

test('compile target preflight reports exact requested/observed Solc compiler mismatch', async () => {
  const root = await project({ solcVersion: '0.8.27' });
  const receipt = await runTargetCompilePreflightV1(await input(root), { runCommand: commands() });
  assert.equal(receipt.firstFailure, 'COMPILE_COMPILER_VERSION_MISMATCH');
  const failure = receipt.diagnostics.find((x) => x.failureCode === 'COMPILE_COMPILER_VERSION_MISMATCH');
  assert.match(JSON.stringify(failure), /0\.8\.28/);
  assert.match(JSON.stringify(failure), /0\.8\.27/);
});

test('compile target preflight keeps Forge toolchain drift distinct from Solc compiler drift', async () => {
  const root = await project();
  const receipt = await runTargetCompilePreflightV1(await input(root), { runCommand: commands({ forgeVersion: '1.8.0' }) });
  assert.equal(receipt.firstFailure, 'COMPILE_BUILD_TOOL_PROBE_FAILURE');
  const failure = receipt.diagnostics.find((x) => x.failureCode === 'COMPILE_BUILD_TOOL_PROBE_FAILURE');
  assert.match(JSON.stringify(failure.observed), /1\.8\.0/);
  assert.match(JSON.stringify(failure.expected), /PASS/);
});
