let extraction = null;
let logs = [];

const MAX_LOGS = 50;

function addLog(msg, type = 'info') {
  const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logs.push({ entry, type });
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
  updateLogDisplay();
}

function updateLogDisplay() {
  const logDiv = document.getElementById('log');
  logDiv.innerHTML = logs
    .map(({ entry, type }) => `<div class="log-entry ${type}">${entry}</div>`)
    .join('');
  logDiv.scrollTop = logDiv.scrollHeight;
}

async function initSidePanel() {
  try {
    addLog('Side panel opened', 'info');
    const tab = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab[0]) {
      showError('Could not get active tab');
      return;
    }

    const tabUrl = tab[0]?.url || 'unknown';
    const displayUrl = tabUrl ? tabUrl.split('/').slice(0, 3).join('/') : 'unknown';
    addLog(`Requesting extraction from ${displayUrl}`, 'info');

    try {
      const response = await chrome.tabs.sendMessage(tab[0].id, { action: 'getExtraction' });
      extraction = response.extraction;
    } catch (e) {
      addLog(`✗ Content script error: ${e.message}`, 'error');
      showError(`Content script not loaded. Make sure you're on a creator profile page.`);
      return;
    }

    if (extraction) {
      addLog(`✓ Extraction found: ${extraction.platform}`, 'success');
    } else {
      addLog('No extraction found on this page', 'error');
    }

    renderSidePanel();
  } catch (e) {
    console.error('[Anthros SidePanel] Init failed:', e);
    showError(`Error: ${e.message}`);
    addLog(`✗ ${e.message}`, 'error');
  }
}

function showError(msg) {
  const statusDiv = document.getElementById('status');
  statusDiv.innerHTML = `<div class="status error">${msg}</div>`;
  document.getElementById('saveBtn').disabled = true;
}

function renderSidePanel() {
  const formDiv = document.getElementById('form');
  const statusDiv = document.getElementById('status');
  const extractionStatusDiv = document.getElementById('extractionStatus');

  if (!extraction) {
    statusDiv.innerHTML = '<div class="status info">Not on a supported creator profile page. Visit TikTok, YouTube, Instagram, or Facebook.</div>';
    formDiv.innerHTML = '';
    extractionStatusDiv.innerHTML = '';
    document.getElementById('saveBtn').disabled = true;
    return;
  }

  statusDiv.innerHTML = '';
  formDiv.innerHTML = '';

  const platformLabel = extraction.platformLabel || extraction.platform;
  const extractionClass = Object.values(extraction).some(v => v !== null && v !== extraction.profileUrl && v !== extraction.platform && v !== extraction.platformLabel && v !== extraction.configVersion) ? 'found' : 'not-found';
  const extractionMsg = extractionClass === 'found' ? '✓ Data extracted' : '✗ No data extracted';

  extractionStatusDiv.innerHTML = `<div class="extraction-status ${extractionClass}">
    <strong>${platformLabel}</strong> ${extractionMsg}
  </div>`;

  const standardFields = ['platform', 'platformLabel', 'profileUrl', 'configVersion'];

  const platformField = document.createElement('div');
  platformField.className = 'field-group';
  platformField.innerHTML = `
    <label>Platform</label>
    <input type="text" value="${platformLabel}" disabled>
  `;
  formDiv.appendChild(platformField);

  const profileUrlField = document.createElement('div');
  profileUrlField.className = 'field-group';
  profileUrlField.innerHTML = `
    <label>URL</label>
    <input type="text" value="${extraction.profileUrl}" disabled style="font-size: 11px;">
  `;
  formDiv.appendChild(profileUrlField);

  for (const [key, value] of Object.entries(extraction)) {
    if (standardFields.includes(key)) continue;

    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'field-group';

    const label = document.createElement('label');
    label.textContent = key;
    fieldGroup.appendChild(label);

    const input = document.createElement(key === 'bio' ? 'textarea' : 'input');
    input.id = `field-${key}`;
    input.type = 'text';
    input.value = value ?? '';

    if (value === null) {
      input.style.opacity = '0.5';
      input.placeholder = '(not found)';
    }

    fieldGroup.appendChild(input);
    formDiv.appendChild(fieldGroup);
  }

  document.getElementById('saveBtn').disabled = false;
}

document.getElementById('saveBtn').addEventListener('click', async () => {
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');

  saveBtn.disabled = true;
  addLog('Saving profile...', 'info');

  try {
    const storage = await chrome.storage.sync.get(['convexUrl']);
    const convexUrl = storage.convexUrl;

    if (!convexUrl) {
      addLog('⚠ Convex URL not configured - save disabled', 'info');
      statusDiv.innerHTML = '<div class="status info">Convex URL not configured. Go to Settings to configure.</div>';
      saveBtn.disabled = false;
      return;
    }

    const formDiv = document.getElementById('form');
    const inputs = formDiv.querySelectorAll('input, textarea');
    const data = { ...extraction };

    inputs.forEach(input => {
      if (input.id.startsWith('field-')) {
        const key = input.id.substring(6);
        data[key] = input.value || null;
      }
    });

    const response = await chrome.runtime.sendMessage({
      action: 'saveCreator',
      data: data
    });

    if (response.error) {
      statusDiv.innerHTML = `<div class="status error">Error: ${response.error}</div>`;
      addLog(`✗ Save failed: ${response.error}`, 'error');
    } else {
      statusDiv.innerHTML = '<div class="status success">✓ Profile saved successfully!</div>';
      addLog('✓ Profile saved to Convex', 'success');
    }
  } catch (e) {
    statusDiv.innerHTML = `<div class="status error">Error: ${e.message}</div>`;
    addLog(`✗ ${e.message}`, 'error');
  } finally {
    saveBtn.disabled = false;
  }
});

document.getElementById('refreshBtn').addEventListener('click', async () => {
  extraction = null;
  logs = [];
  document.getElementById('log').innerHTML = '';
  await initSidePanel();
});

document.getElementById('optionsLink').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

initSidePanel();
