import { createApiClient } from '../client.js';

const byId = (id) => document.getElementById(id);
const form = byId('agent-job-form');
const apiUrl = byId('agent-api-url');
const apiKey = byId('agent-api-key');
const requestText = byId('agent-request');
const fileInput = byId('agent-project-file');
const output = byId('agent-output');
const message = byId('agent-message');
const next = byId('agent-next');
const jobLink = byId('agent-job-link');

apiUrl.value = sessionStorage.getItem('preflightsim.apiUrl') || apiUrl.value;
apiKey.value = sessionStorage.getItem('preflightsim.apiKey') || '';

function api() {
  const url = apiUrl.value.trim().replace(/\/$/, '');
  const key = apiKey.value.trim();
  if (!url || !key) throw new Error('API URL and API key are required.');
  sessionStorage.setItem('preflightsim.apiUrl', url);
  sessionStorage.setItem('preflightsim.apiKey', key);
  return createApiClient({ apiUrl: url, apiKey: key });
}

function show(value, text, failed = false) {
  output.textContent = JSON.stringify(value, null, 2);
  message.textContent = text;
  message.style.borderColor = failed ? 'var(--danger)' : 'var(--accent)';
}

byId('agent-format').addEventListener('click', () => {
  try {
    requestText.value = JSON.stringify(JSON.parse(requestText.value), null, 2);
    show({ validJson: true }, 'JSON formatted.');
  } catch (error) {
    show({ error: error.message }, 'Invalid JSON.', true);
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  byId('agent-submit').disabled = true;
  next.classList.add('hidden');
  try {
    const client = api();
    const request = JSON.parse(requestText.value);
    const file = fileInput.files[0];
    if (file) {
      show({ stage: 'uploading', file: file.name }, `Uploading ${file.name}…`);
      const upload = await client.uploadProject(file);
      request.project = { type: 'upload', objectKey: upload.objectKey };
    }
    show({ stage: 'submitting' }, 'Submitting job…');
    const created = await client.createJob(request);
    const url = created.agentJobUrl || `./job.html?job=${encodeURIComponent(created.jobId)}`;
    jobLink.href = url;
    next.classList.remove('hidden');
    show(created, 'Job queued. Open the permanent job page to monitor it.');
  } catch (error) {
    show({ error: { code: error.code, message: error.message, details: error.details } }, 'Submission failed.', true);
  } finally {
    byId('agent-submit').disabled = false;
  }
});
