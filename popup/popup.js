let extraction = null;

async function initPopup() {
  const tab = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await chrome.tabs.sendMessage(tab[0].id, { action: 'getExtraction' });
  extraction = response.extraction;

  renderPopup();
}

function renderPopup() {
  const formDiv = document.getElementById('form');
  const statusDiv = document.getElementById('status');

  if (!extraction) {
    statusDiv.innerHTML = '<div class="status error">Not on a supported creator profile page</div>';
    document.getElementById('saveBtn').disabled = true;
    return;
  }

  formDiv.innerHTML = '';
  const standardFields = ['platform', 'platformLabel', 'profileUrl', 'configVersion'];

  const platformField = document.createElement('div');
  platformField.className = 'field-group';
  platformField.innerHTML = `
    <label>Platform</label>
    <input type="text" value="${extraction.platformLabel || extraction.platform}" disabled>
  `;
  formDiv.appendChild(platformField);

  const profileUrlField = document.createElement('div');
  profileUrlField.className = 'field-group';
  profileUrlField.innerHTML = `
    <label>Profile URL</label>
    <input type="text" value="${extraction.profileUrl}" disabled>
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
}

document.getElementById('saveBtn').addEventListener('click', async () => {
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');

  saveBtn.disabled = true;
  statusDiv.innerHTML = '<div class="status loading">Saving...</div>';

  try {
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
    } else {
      statusDiv.innerHTML = '<div class="status success">Profile saved successfully!</div>';
      setTimeout(() => window.close(), 1500);
    }
  } catch (e) {
    statusDiv.innerHTML = `<div class="status error">Error: ${e.message}</div>`;
  } finally {
    saveBtn.disabled = false;
  }
});

document.getElementById('cancelBtn').addEventListener('click', () => {
  window.close();
});

document.getElementById('optionsLink').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

initPopup();
