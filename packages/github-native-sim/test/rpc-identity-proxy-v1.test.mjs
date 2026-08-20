import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const proxyModule = await import('../../runner/src/rpc-identity-proxy-v1.mjs').catch(() => ({}));
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  assert.equal(response.status, 200);
  return response.json();
}

test('fork RPC identity proxy rewrites only eth_chainId and net_version while preserving all state payloads', async () => {
  assert.equal(typeof proxyModule.startRpcIdentityProxy, 'function', 'startRpcIdentityProxy must be exported');
  const upstreamCalls = [];
  const upstreamFetch = async (url, options) => {
    assert.equal(url, 'https://virtual-archive.example/rpc');
    const request = JSON.parse(options.body);
    upstreamCalls.push(request);
    const answer = (item) => {
      if (item.method === 'eth_chainId') return { jsonrpc: '2.0', id: item.id, result: '0xee0059' };
      if (item.method === 'net_version') return { jsonrpc: '2.0', id: item.id, result: '15597657' };
      if (item.method === 'eth_getBlockByNumber') return { jsonrpc: '2.0', id: item.id, result: { hash: `0x${'1'.repeat(64)}`, stateRoot: `0x${'2'.repeat(64)}` } };
      if (item.method === 'eth_getCode') return { jsonrpc: '2.0', id: item.id, result: '0x60016000' };
      return { jsonrpc: '2.0', id: item.id, result: null };
    };
    const payload = Array.isArray(request) ? request.map(answer) : answer(request);
    return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), async text() { return JSON.stringify(payload); } };
  };

  const proxy = await proxyModule.startRpcIdentityProxy({
    upstreamUrl: 'https://virtual-archive.example/rpc',
    chainId: 1,
    fetchImpl: upstreamFetch
  });
  try {
    const chain = await postJson(proxy.url, { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] });
    assert.equal(chain.result, '0x1');
    const network = await postJson(proxy.url, { jsonrpc: '2.0', id: 2, method: 'net_version', params: [] });
    assert.equal(network.result, '1');
    const block = await postJson(proxy.url, { jsonrpc: '2.0', id: 3, method: 'eth_getBlockByNumber', params: ['0x188b9f5', false] });
    assert.deepEqual(block.result, { hash: `0x${'1'.repeat(64)}`, stateRoot: `0x${'2'.repeat(64)}` });
    const batch = await postJson(proxy.url, [
      { jsonrpc: '2.0', id: 4, method: 'eth_chainId', params: [] },
      { jsonrpc: '2.0', id: 5, method: 'eth_getCode', params: [`0x${'3'.repeat(40)}`, '0x188b9f5'] },
      { jsonrpc: '2.0', id: 6, method: 'net_version', params: [] }
    ]);
    assert.equal(batch[0].result, '0x1');
    assert.equal(batch[1].result, '0x60016000');
    assert.equal(batch[2].result, '1');
    assert.equal(JSON.stringify(batch).includes('virtual-archive.example'), false);
  } finally {
    await proxy.close();
  }

  assert.deepEqual(upstreamCalls.map((request) => Array.isArray(request) ? request.map((item) => item.method) : request.method), [
    'eth_chainId',
    'net_version',
    'eth_getBlockByNumber',
    ['eth_chainId', 'eth_getCode', 'net_version']
  ]);
});

test('Ganache fork engine routes only fork traffic through the localhost identity proxy and keeps the pinned block', () => {
  const engine = fs.readFileSync(path.join(repoRoot, 'packages/runner/src/engine.mjs'), 'utf8');
  assert.match(engine, /startRpcIdentityProxy/);
  assert.match(engine, /upstreamUrl:\s*forkUrl/);
  assert.match(engine, /chainId/);
  assert.match(engine, /buildGanacheOptions\(\{[^}]*forkUrl:\s*identityProxy\.url/s);
  assert.match(engine, /if \(block !== 'latest'\) options\.fork\.blockNumber = block/);
  assert.match(engine, /await identityProxy\.close\(\)/);
});
