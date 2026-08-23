import test from 'node:test';
import assert from 'node:assert/strict';
import { startGanacheEngine } from '../../runner/src/engine.mjs';

function serializeError(error, depth = 0) {
  if (depth > 5) return { truncated: true };
  if (!error || typeof error !== 'object') return { value: String(error) };
  const out = {
    constructor: error.constructor?.name ?? null,
    name: error.name ?? null,
    message: error.message ?? null,
    code: error.code ?? null,
    stack: error.stack ?? null,
  };
  for (const key of Object.getOwnPropertyNames(error)) {
    if (['name', 'message', 'stack', 'cause', 'errors'].includes(key)) continue;
    try {
      const value = error[key];
      out[key] = typeof value === 'bigint' ? value.toString() : value;
    } catch {}
  }
  if (error.cause) out.cause = serializeError(error.cause, depth + 1);
  if (Array.isArray(error.errors)) out.errors = error.errors.map((item) => serializeError(item, depth + 1));
  return out;
}

test('diagnostic: Ganache can initialize canonical Ethereum block 25737717 through public RPC', { timeout: 120000 }, async () => {
  let engine;
  try {
    engine = await startGanacheEngine({
      artifacts: { get() { throw new Error('artifact access is not expected during engine startup'); } },
      workflow: { steps: [] },
      chainId: 1,
      forkUrl: 'https://ethereum-rpc.publicnode.com',
      block: 25737717,
      quiet: true,
    });
    const blockNumber = await engine.provider.getBlockNumber();
    console.log(`PHASE7_ENGINE_DIAGNOSTIC_SUCCESS=${JSON.stringify({ blockNumber })}`);
    assert.ok(blockNumber >= 25737717);
  } catch (error) {
    console.error(`PHASE7_ENGINE_DIAGNOSTIC_ERROR=${JSON.stringify(serializeError(error))}`);
    throw error;
  } finally {
    if (engine?.close) await engine.close().catch(() => {});
  }
});
