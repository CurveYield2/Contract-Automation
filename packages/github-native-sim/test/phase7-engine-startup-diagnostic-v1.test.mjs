import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
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

async function startTracingProxy() {
  let sequence = 0;
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const rawRequest = Buffer.concat(chunks).toString('utf8');
    const current = ++sequence;
    let parsed;
    try { parsed = JSON.parse(rawRequest); } catch { parsed = null; }
    console.log(`PHASE7_RPC_REQUEST_${current}=${JSON.stringify(parsed)}`);
    try {
      const upstream = await fetch('https://ethereum-rpc.publicnode.com', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: rawRequest,
      });
      const rawResponse = await upstream.text();
      console.log(`PHASE7_RPC_RESPONSE_${current}=${JSON.stringify({ status: upstream.status, body: rawResponse.slice(0, 4000) })}`);
      response.writeHead(upstream.status, {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
        'content-length': Buffer.byteLength(rawResponse),
      });
      response.end(rawResponse);
    } catch (error) {
      console.error(`PHASE7_RPC_TRANSPORT_ERROR_${current}=${JSON.stringify(serializeError(error))}`);
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'trace proxy transport failure' }));
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

test('diagnostic: trace Ganache fork initialization at canonical Ethereum block 25737717', { timeout: 120000 }, async () => {
  let engine;
  let trace;
  try {
    trace = await startTracingProxy();
    engine = await startGanacheEngine({
      artifacts: { get() { throw new Error('artifact access is not expected during engine startup'); } },
      workflow: { steps: [] },
      chainId: 1,
      forkUrl: trace.url,
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
    if (trace?.close) await trace.close().catch(() => {});
  }
});
