import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveCompiledSourceFile } from '../src/phase0-compiled-source-resolve-v1.mjs';

async function write(root,rel){const f=path.join(root,...rel.split('/'));await fs.mkdir(path.dirname(f),{recursive:true});await fs.writeFile(f,'// x');return f;}

test('cached builds resolve remapped sources from a vendored package node_modules', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'resolve-src-'));
  const local = await write(root, 'upgrade/src/A.sol');
  const rootDep = await write(root, 'node_modules/@oz/B.sol');
  const vendored = await write(root, 'ipor-fusion/node_modules/@morpho-org/morpho-blue/src/interfaces/IIrm.sol');
  assert.equal(await resolveCompiledSourceFile(root, 'upgrade/src/A.sol'), local);
  assert.equal(await resolveCompiledSourceFile(root, '@oz/B.sol'), rootDep);
  assert.equal(await resolveCompiledSourceFile(root, '@morpho-org/morpho-blue/src/interfaces/IIrm.sol'), vendored);
  await assert.rejects(resolveCompiledSourceFile(root, '@none/C.sol'), /missing from staged project/);
});
