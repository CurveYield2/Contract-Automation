// Stake DAO harvest executor — Cloudflare Worker entry (SPEC.md §5). The cron and the HTTP endpoints only forward to
// the BotState Durable Object, which holds all state and logic (Durable Objects get 30 s CPU on the free plan).
export { BotState } from './bot.js';

const MAX_SKEW_SEC = 300;

async function verify(request, env) {
  const ts = Number(request.headers.get('x-ts'));
  const sig = request.headers.get('x-sig') || '';
  if (!ts || Math.abs(Date.now() / 1000 - ts) > MAX_SKEW_SEC) return null;
  const body = await request.text();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.HMAC_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ts}.${body}`)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? body : null;
}

const stub = (env) => env.BOT.get(env.BOT.idFromName('main'));

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(stub(env).fetch('https://bot/tick', { method: 'POST' }));
  },

  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const route = { '/priority': 'priority', '/config': 'config', '/stats': 'stats' }[pathname];
    if (!route) return new Response('not found', { status: 404 });
    const body = await verify(request, env);
    if (body === null) return new Response('unauthorized', { status: 401 });
    return stub(env).fetch(`https://bot/${route}`, { method: 'POST', body });
  },
};
