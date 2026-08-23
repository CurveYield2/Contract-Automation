import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { buildAnvilLaunchSpec, waitForChildSpawn } from '../src/anvil-engine.mjs';

test('pinned @foundry-rs/anvil package exposes its Node launcher in the installed package', () => {
  assert.equal(fs.existsSync(path.resolve('node_modules/@foundry-rs/anvil/bin.mjs')), true);
});

test('Anvil launch spec invokes the pinned package launcher with Node rather than a missing .bin symlink', () => {
  assert.deepEqual(
    buildAnvilLaunchSpec({
      cwd: '/repo',
      execPath: '/usr/bin/node',
      anvilArgs: ['--host', '127.0.0.1']
    }),
    {
      command: '/usr/bin/node',
      args: ['/repo/node_modules/@foundry-rs/anvil/bin.mjs', '--host', '127.0.0.1']
    }
  );
});

test('Anvil spawn errors are awaited and normalized instead of becoming unhandled process errors', async () => {
  const child = new EventEmitter();
  child.pid = undefined;
  child.exitCode = null;
  const waiting = waitForChildSpawn(child);
  queueMicrotask(() => {
    const error = new Error('spawn launcher ENOENT');
    error.code = 'ENOENT';
    child.emit('error', error);
  });
  await assert.rejects(waiting, /Anvil process failed to spawn: spawn launcher ENOENT/);
});

test('Anvil spawn readiness resolves on spawn event', async () => {
  const child = new EventEmitter();
  child.pid = 1234;
  child.exitCode = null;
  const waiting = waitForChildSpawn(child);
  queueMicrotask(() => child.emit('spawn'));
  await waiting;
});
