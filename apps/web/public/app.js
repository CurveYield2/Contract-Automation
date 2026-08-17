import { createApiClient } from './client.js';

const elements = Object.fromEntries([...document.querySelectorAll('[id]')].map((element) => [element.id, element]));
let latestResult = null;
let latestJobId = null;

const savedApiUrl = localStorage.getItem('preflightsim.apiUrl');
if (savedApiUrl) elements['api-url'].value = savedApiUrl;
const rememberedKey = localStorage.getItem('preflightsim.apiKey');
const sessionKey = sessionStorage.getItem('preflightsim.apiKey');
if (rememberedKey || sessionKey) elements['api-key'].value = rememberedKey || sessionKey;
elements['remember-key'].checked = Boolean(rememberedKey);

function setProgress(message, isError = false) {
  elements.progress.textContent = message;
  elements.progress.style.borderColor = isError ? 'var(--danger)' : 'var(--accent)';
}

function credentials() {
  const apiUrl = elements['api-url'].value.trim().replace(/\/$/, '');
  const apiKey = elements['api-key'].value.trim();
  if (!apiUrl || !apiKey) throw new Error('API URL and API key are required.');
  localStorage.setItem('preflightsim.apiUrl', apiUrl);
  if (elements['remember-key'].checked) {
    localStorage.setItem('preflightsim.apiKey', apiKey);
    sessionStorage.removeItem('preflightsim.apiKey');
  } else {
    sessionStorage.setItem('preflightsim.apiKey', apiKey);
    localStorage.removeItem('preflightsim.apiKey');
  }
  return { apiUrl, apiKey };
}

function client() {
  return createApiClient(credentials());
}

function selectedProjectType() {
  return document.querySelector('input[name="projectType"]:checked').value;
}

function updateProjectFields() {
  const type = selectedProjectType();
  elements['github-project'].classList.toggle('hidden', type !== 'github');
  elements['inline-project'].classList.toggle('hidden', type !== 'inline');
  elements['upload-project'].classList.toggle('hidden', type !== 'upload');
}

document.querySelectorAll('input[name="projectType"]').forEach((radio) => radio.addEventListener('change', updateProjectFields));

async function projectPayload(api) {
  const type = selectedProjectType();
  if (type === 'github') {
    return {
      type,
      repository: elements['github-repository'].value.trim(),
      ref: elements['github-ref'].value.trim() || 'main'
    };
  }
  if (type === 'inline') {
    return {
      type,
      files: { [elements['inline-path'].value.trim()]: elements['inline-source'].value }
    };
  }
  const file = elements['project-file'].files[0];
  if (!file) throw new Error('Choose a ZIP project first.');
  setProgress(`Uploading ${file.name}…`);
  const upload = await api.uploadProject(file);
  return { type: 'upload', objectKey: upload.objectKey };
}

function parseBlock() {
  const value = elements.block.value.trim();
  if (value === 'latest') return 'latest';
  if (!/^\d+$/.test(value)) throw new Error('Fork block must be "latest" or a non-negative integer.');
  return Number(value);
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

elements['test-connection'].addEventListener('click', async () => {
  try {
    elements['service-state'].textContent = 'Testing…';
    const response = await client().getChains();
    elements['service-state'].textContent = `${Object.keys(response.chains).length} chains available`;
    setProgress('API connection succeeded.');
  } catch (error) {
    elements['service-state'].textContent = 'Connection failed';
    setProgress(error.message, true);
  }
});

elements['job-form'].addEventListener('submit', async (event) => {
  event.preventDefault();
  elements['submit-job'].disabled = true;
  elements['download-json'].disabled = true;
  elements['open-report'].disabled = true;
  latestResult = null;
  try {
    const api = client();
    const mode = elements.mode.value;
    const workflow = mode === 'compile' ? { steps: [] } : JSON.parse(elements.workflow.value);
    const project = await projectPayload(api);
    const request = {
      mode,
      project,
      compilerVersion: elements['compiler-version'].value.trim(),
      ...(mode === 'simulate' ? { chain: elements.chain.value, block: parseBlock() } : {}),
      workflow,
      optimizer: {
        enabled: elements['optimizer-enabled'].checked,
        runs: Number(elements['optimizer-runs'].value)
      },
      viaIR: elements['via-ir'].checked
    };
    const oz = elements['openzeppelin-version'].value.trim();
    const evmVersion = elements['evm-version'].value.trim();
    if (oz) request.openZeppelinVersion = oz;
    if (evmVersion) request.evmVersion = evmVersion;

    setProgress('Submitting job to GitHub Actions…');
    const created = await api.createJob(request);
    latestJobId = created.jobId;
    elements['job-id'].textContent = latestJobId;
    const terminal = await api.pollJob(latestJobId, {
      onUpdate(status) {
        setProgress(`${status.status}: ${status.stage ?? 'working'}`);
        elements['result-json'].textContent = JSON.stringify(status, null, 2);
      }
    });
    latestResult = await api.getResult(latestJobId);
    elements['result-json'].textContent = JSON.stringify(latestResult, null, 2);
    elements['download-json'].disabled = false;
    elements['open-report'].disabled = false;
    setProgress(`Job ${terminal.status}.` , terminal.status === 'failed');
  } catch (error) {
    setProgress(error.message, true);
    elements['result-json'].textContent = JSON.stringify({ error: error.message, code: error.code }, null, 2);
  } finally {
    elements['submit-job'].disabled = false;
  }
});

elements['download-json'].addEventListener('click', () => {
  if (latestResult) download(`${latestJobId}.json`, JSON.stringify(latestResult, null, 2), 'application/json');
});

elements['open-report'].addEventListener('click', async () => {
  if (!latestJobId) return;
  try {
    const html = await client().getReport(latestJobId);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    setProgress(error.message, true);
  }
});

elements['load-vault-example'].addEventListener('click', async () => {
  document.querySelector('input[name="projectType"][value="github"]').checked = true;
  updateProjectFields();
  elements['github-repository'].value = 'CurveYield/contract-automation';
  elements['github-ref'].value = 'main';
  elements.workflow.value = JSON.stringify({
    steps: [
      { action: 'deploy', alias: 'token', contract: 'TestToken', source: 'fixtures/contracts/VaultSystem.sol', args: [] },
      { action: 'deploy', alias: 'staking', contract: 'TestStaking', source: 'fixtures/contracts/VaultSystem.sol', args: ['$token'] },
      { action: 'deploy', alias: 'strategy', contract: 'TestStrategy', source: 'fixtures/contracts/VaultSystem.sol', args: ['$token', '$staking'] },
      { action: 'deploy', alias: 'vault', contract: 'TestVault', source: 'fixtures/contracts/VaultSystem.sol', args: ['$token', '$strategy'] },
      { action: 'call', target: '$strategy', function: 'setVault', args: ['$vault'] },
      { action: 'call', target: '$token', function: 'mint', args: ['$account0', '1000000000000000000000'] },
      { action: 'call', target: '$token', function: 'approve', args: ['$vault', '1000000000000000000000'] },
      { action: 'call', target: '$vault', function: 'deposit', args: ['100000000000000000000'] },
      { action: 'call', target: '$staking', function: 'addRewards', args: ['$strategy', '10000000000000000000'] },
      { action: 'call', target: '$strategy', function: 'harvest', args: [] },
      { action: 'assertCall', target: '$staking', function: 'balanceOf', args: ['$strategy'], equals: '110000000000000000000' },
      { action: 'call', target: '$vault', function: 'withdraw', args: ['50000000000000000000'] }
    ]
  }, null, 2);
  setProgress('Vault example loaded. Deploy the repository first or replace it with your own project.');
});
