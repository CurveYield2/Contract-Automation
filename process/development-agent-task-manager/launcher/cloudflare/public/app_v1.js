const form = document.querySelector('#launch-form');
const launchButton = document.querySelector('#launch-button');
const statusBox = document.querySelector('#status');
const statusLabel = document.querySelector('#status-label');
const statusDetail = document.querySelector('#status-detail');
const links = document.querySelector('#links');
const outputLink = document.querySelector('#output-link');
const projectLink = document.querySelector('#project-link');
const artifactLink = document.querySelector('#artifact-link');

let pollTimer = null;

function setStatus(label, detail = '') {
  statusBox.classList.remove('hidden');
  statusLabel.textContent = label;
  statusDetail.textContent = detail;
}

function clearLinks() {
  links.classList.add('hidden');
  outputLink.removeAttribute('href');
  projectLink.removeAttribute('href');
  artifactLink.removeAttribute('href');
  projectLink.classList.remove('hidden');
  artifactLink.classList.add('hidden');
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

function updateTaskQuery(managerId) {
  const url = new URL(location.href);
  url.searchParams.set('task', managerId);
  history.replaceState({}, '', url);
}

async function poll(managerId) {
  clearTimeout(pollTimer);
  try {
    const state = await api(`/api/tasks/${encodeURIComponent(managerId)}`, { method: 'GET' });
    if (state.status === 'COMPLETE') {
      setStatus('Completed', 'The verified implementation has been merged into the target repository main branch.');
      clearLinks();
      outputLink.href = state.outputUrl;
      if (state.projectUrl) {
        projectLink.href = state.projectUrl;
      } else {
        projectLink.classList.add('hidden');
      }
      if (state.artifactUrl) {
        artifactLink.href = state.artifactUrl;
        artifactLink.classList.remove('hidden');
      }
      links.classList.remove('hidden');
      launchButton.disabled = false;
      return;
    }
    if (state.status === 'BLOCKED') {
      setStatus('Blocked', state.reason || 'The task requires attention before it can merge.');
      launchButton.disabled = false;
      pollTimer = setTimeout(() => poll(managerId), 30000);
      return;
    }
    setStatus(state.status === 'STARTING' ? 'Starting' : 'Running', 'Execution continues in GitHub. You may close this page.');
    pollTimer = setTimeout(() => poll(managerId), state.status === 'STARTING' ? 10000 : 30000);
  } catch (error) {
    setStatus('Status unavailable', error.message);
    pollTimer = setTimeout(() => poll(managerId), 30000);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearTimeout(pollTimer);
  clearLinks();
  launchButton.disabled = true;
  setStatus('Submitting', 'Creating the durable task request in GitHub.');
  try {
    const body = {
      taskName: document.querySelector('#task-name').value,
      instruction: document.querySelector('#instruction').value,
      targetRepository: document.querySelector('#target-repository').value,
    };
    const result = await api('/api/tasks', { method: 'POST', body: JSON.stringify(body) });
    updateTaskQuery(result.managerId);
    setStatus('Starting', `Task ${result.managerId} was admitted to GitHub.`);
    await poll(result.managerId);
  } catch (error) {
    setStatus('Launch failed', error.message);
    launchButton.disabled = false;
  }
});

const existing = new URL(location.href).searchParams.get('task');
if (existing && /^[A-Za-z0-9._-]{1,160}$/.test(existing)) {
  launchButton.disabled = true;
  setStatus('Loading task', existing);
  poll(existing);
}
