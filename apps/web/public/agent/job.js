import { createApiClient } from '../client.js';

const byId = (id) => document.getElementById(id);
const apiUrl = byId('job-api-url');
const apiKey = byId('job-api-key');
const jobId = byId('job-id-input');
let stopped = false;
let latestResult = null;

apiUrl.value = sessionStorage.getItem('preflightsim.apiUrl') || apiUrl.value;
apiKey.value = sessionStorage.getItem('preflightsim.apiKey') || '';
jobId.value = new URL(location.href).searchParams.get('job') || '';

function api() {
  const url = apiUrl.value.trim().replace(/\/$/, '');
  const key = apiKey.value.trim();
  if (!url || !key) throw new Error('API URL and API key are required.');
  sessionStorage.setItem('preflightsim.apiUrl', url);
  sessionStorage.setItem('preflightsim.apiKey', key);
  return createApiClient({ apiUrl: url, apiKey: key });
}

function renderStatus(status) {
  byId('job-status').textContent = status.status || 'unknown';
  byId('job-stage').textContent = status.stage || 'unknown';
  byId('job-updated').textContent = status.updatedAt || 'unknown';
  byId('job-output').textContent = JSON.stringify(status, null, 2);
  byId('job-message').textContent = `${status.status}: ${status.stage || 'working'}`;
}

async function load() {
  stopped = false;
  const client = api();
  const id = jobId.value.trim();
  if (!/^job_[A-Za-z0-9]+$/.test(id)) throw new Error('A valid job ID is required.');
  while (!stopped) {
    const status = await client.getJob(id);
    renderStatus(status);
    if (status.status === 'completed' || status.status === 'failed') {
      latestResult = await client.getResult(id);
      byId('job-output').textContent = JSON.stringify(latestResult, null, 2);
      byId('job-download').disabled = false;
      byId('job-report').disabled = false;
      return;
    }
    if (!byId('job-auto-poll').checked) return;
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
}

byId('agent-job-status').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await load();
  } catch (error) {
    byId('job-message').textContent = error.message;
    byId('job-message').style.borderColor = 'var(--danger)';
    byId('job-output').textContent = JSON.stringify({ error: error.message, code: error.code }, null, 2);
  }
});

byId('job-stop').addEventListener('click', () => {
  stopped = true;
  byId('job-message').textContent = 'Polling stopped.';
});

byId('job-download').addEventListener('click', () => {
  if (!latestResult) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(latestResult, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${jobId.value.trim()}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
});

byId('job-report').addEventListener('click', async () => {
  try {
    const html = await api().getReport(jobId.value.trim());
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    byId('job-message').textContent = error.message;
  }
});
