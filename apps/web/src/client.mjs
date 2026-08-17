export class ApiError extends Error {
  constructor(code, message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function createApiClient({ apiUrl, apiKey, fetcher = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const baseUrl = String(apiUrl).replace(/\/$/, '');

  async function request(path, init = {}) {
    const headers = new Headers(init.headers ?? {});
    headers.set('authorization', `Bearer ${apiKey}`);
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    const response = await fetcher(`${baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      let payload = {};
      try { payload = await response.json(); } catch {}
      throw new ApiError(
        payload?.error?.code ?? 'request_failed',
        payload?.error?.message ?? `Request failed with status ${response.status}`,
        response.status,
        payload?.error?.details
      );
    }
    return response;
  }

  return {
    async getChains() {
      return (await request('/api/v1/chains')).json();
    },

    async uploadProject(file) {
      const session = await (await request('/api/v1/uploads', {
        method: 'POST',
        body: JSON.stringify({
          size: file.size,
          contentType: 'application/zip'
        })
      })).json();
      const uploadResponse = await fetcher(session.uploadUrl, {
        method: 'PUT',
        headers: session.requiredHeaders,
        body: file
      });
      if (!uploadResponse.ok) {
        throw new ApiError('upload_failed', `R2 upload failed with status ${uploadResponse.status}`, uploadResponse.status);
      }
      return session;
    },

    async createJob(job) {
      return (await request('/api/v1/jobs', {
        method: 'POST',
        body: JSON.stringify(job)
      })).json();
    },

    async getJob(jobId) {
      return (await request(`/api/v1/jobs/${encodeURIComponent(jobId)}`)).json();
    },

    async getResult(jobId) {
      return (await request(`/api/v1/jobs/${encodeURIComponent(jobId)}/result`)).json();
    },

    async getReport(jobId) {
      return (await request(`/api/v1/jobs/${encodeURIComponent(jobId)}/report`)).text();
    },

    async pollJob(jobId, { intervalMs = 4000, timeoutMs = 40 * 60 * 1000, onUpdate = () => {} } = {}) {
      const started = Date.now();
      while (Date.now() - started <= timeoutMs) {
        const status = await this.getJob(jobId);
        onUpdate(status);
        if (['completed', 'failed'].includes(status.status)) return status;
        await sleep(intervalMs);
      }
      throw new ApiError('poll_timeout', `Polling timed out after ${timeoutMs} ms`, 408);
    }
  };
}
