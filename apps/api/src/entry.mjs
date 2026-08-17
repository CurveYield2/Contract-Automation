import apiWorker from './index.mjs';

function json(value, env, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': env.CORS_ORIGIN || '*',
      'cache-control': 'no-store'
    }
  });
}

export function setupReadiness(env) {
  const features = {
    storage: Boolean(env.JOBS),
    browserApiAuth: Boolean(env.CLIENT_API_KEY),
    customGptAuth: Boolean(env.GPT_API_KEY),
    githubBridgeAuth: Boolean(env.GITHUB_BRIDGE_API_KEY),
    runnerAuth: Boolean(env.RUNNER_API_KEY),
    githubDispatch: Boolean(env.GITHUB_TOKEN),
    largeUploads: Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY)
  };
  return {
    status: Object.values(features).every(Boolean) ? 'ready' : 'configuration_required',
    features
  };
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/v1/setup') {
      return json(setupReadiness(env), env);
    }
    return apiWorker.fetch(request, env, context);
  }
};
