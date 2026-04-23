async function loadSettings() {
  const storage = await chrome.storage.sync.get([
    'configIndexUrl', 'cacheTtlMinutes', 'convexUrl',
    'index', 'indexCachedAt', 'platforms'
  ]);

  document.getElementById('configIndexUrl').value = storage.configIndexUrl || '';
  document.getElementById('cacheTtlMinutes').value = storage.cacheTtlMinutes || 60;
  document.getElementById('convexUrl').value = storage.convexUrl || '';

  updatePlatformStatus(storage);
}

function updatePlatformStatus(storage) {
  const statusDiv = document.getElementById('platformStatus');
  const index = storage.index;
  const platforms = storage.platforms || {};
  const indexCachedAt = storage.indexCachedAt || 0;

  if (!index || !index.platforms) {
    statusDiv.innerHTML = '<p style="color: #999; font-size: 13px;">No platforms loaded. Save settings and refresh to load.</p>';
    return;
  }

  let html = `<table class="platform-table">
    <thead>
      <tr>
        <th>Platform</th>
        <th>Version</th>
        <th>Status</th>
        <th>Cached</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>`;

  for (const entry of index.platforms) {
    const config = platforms[entry.id];
    const version = config?.version || '—';
    const active = entry.active ? 'active' : 'inactive';
    const cachedAt = config?.cachedAt || 0;
    const now = Date.now();
    const ageMs = now - cachedAt;
    const ageMin = Math.floor(ageMs / 60000);
    const cachedTime = config ? (ageMin < 1 ? 'just now' : `${ageMin} min ago`) : '—';

    html += `<tr>
      <td><strong>${entry.label}</strong></td>
      <td>${version}</td>
      <td><span class="status-badge ${active}">${active}</span></td>
      <td><span class="cached-time">${cachedTime}</span></td>
      <td>
        <div class="platform-actions">
          <button class="btn-secondary btn-small" onclick="previewPlatform('${entry.id}')">Preview</button>
          <button class="btn-secondary btn-small" onclick="refreshPlatform('${entry.id}')">Refresh</button>
        </div>
      </td>
    </tr>`;
  }

  html += '</tbody></table>';

  const indexAgeMin = Math.floor((now - indexCachedAt) / 60000);
  const indexCachedText = indexCachedAt > 0 ? (indexAgeMin < 1 ? 'just now' : `${indexAgeMin} min ago`) : '—';

  html += `<div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #eee;">
    <p style="margin: 0 0 8px 0; font-size: 13px; color: #666;">
      <strong>Last index refresh:</strong> ${indexCachedText}
      <button class="btn-secondary btn-small" onclick="refreshIndex()" style="margin-left: 8px;">Refresh Index</button>
    </p>
  </div>`;

  statusDiv.innerHTML = html;
}

async function previewPlatform(platformId) {
  const storage = await chrome.storage.sync.get(['platforms']);
  const config = storage.platforms?.[platformId];

  if (!config) {
    alert('Platform config not found');
    return;
  }

  const preview = JSON.stringify(config, null, 2);
  alert(`Platform: ${platformId}\n\n${preview}`);
}

async function refreshPlatform(platformId) {
  const statusDiv = document.getElementById('status');
  statusDiv.innerHTML = '<div class="status info">Refreshing platform...</div>';

  try {
    const storage = await chrome.storage.sync.get([
      'configIndexUrl', 'index'
    ]);

    const index = storage.index;
    if (!index) {
      throw new Error('Index not loaded');
    }

    const entry = index.platforms.find(p => p.id === platformId);
    if (!entry) {
      throw new Error('Platform not found in index');
    }

    const res = await fetch(entry.url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const config = await res.json();

    const platforms = (await chrome.storage.sync.get(['platforms'])).platforms || {};
    platforms[platformId] = { ...config, cachedAt: Date.now() };
    await chrome.storage.sync.set({ platforms });

    statusDiv.innerHTML = '<div class="status success">Platform refreshed successfully</div>';
    loadSettings();
  } catch (e) {
    statusDiv.innerHTML = `<div class="status error">Error: ${e.message}</div>`;
  }
}

async function refreshIndex() {
  const statusDiv = document.getElementById('status');
  statusDiv.innerHTML = '<div class="status info">Refreshing index...</div>';

  try {
    const storage = await chrome.storage.sync.get([
      'configIndexUrl'
    ]);

    if (!storage.configIndexUrl) {
      throw new Error('Config index URL not set');
    }

    const res = await fetch(storage.configIndexUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const index = await res.json();

    await chrome.storage.sync.set({
      index,
      indexCachedAt: Date.now()
    });

    statusDiv.innerHTML = '<div class="status success">Index refreshed successfully</div>';
    loadSettings();
  } catch (e) {
    statusDiv.innerHTML = `<div class="status error">Error: ${e.message}</div>`;
  }
}

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  const configIndexUrl = document.getElementById('configIndexUrl').value.trim();
  const cacheTtlMinutes = parseInt(document.getElementById('cacheTtlMinutes').value) || 60;
  const convexUrl = document.getElementById('convexUrl').value.trim();

  try {
    if (!configIndexUrl) throw new Error('Config index URL is required');

    await chrome.storage.sync.set({
      configIndexUrl,
      cacheTtlMinutes,
      convexUrl: convexUrl || ''
    });

    statusDiv.innerHTML = '<div class="status success">Settings saved successfully</div>';
    setTimeout(() => {
      statusDiv.innerHTML = '';
    }, 3000);
  } catch (e) {
    statusDiv.innerHTML = `<div class="status error">Error: ${e.message}</div>`;
  }
});

document.getElementById('refreshNowBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  statusDiv.innerHTML = '<div class="status info">Refreshing all configs...</div>';

  try {
    const storage = await chrome.storage.sync.get([
      'configIndexUrl', 'cacheTtlMinutes'
    ]);

    if (!storage.configIndexUrl) {
      throw new Error('Config index URL not set');
    }

    const indexRes = await fetch(storage.configIndexUrl, { cache: 'no-store' });
    if (!indexRes.ok) throw new Error(`Index HTTP ${indexRes.status}`);
    const index = await indexRes.json();

    const platforms = {};
    for (const entry of (index.platforms || []).filter(p => p.active)) {
      const res = await fetch(entry.url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Platform ${entry.id} HTTP ${res.status}`);
      const config = await res.json();
      platforms[entry.id] = { ...config, cachedAt: Date.now() };
    }

    await chrome.storage.sync.set({
      index,
      indexCachedAt: Date.now(),
      platforms
    });

    statusDiv.innerHTML = '<div class="status success">All configs refreshed successfully</div>';
    loadSettings();
  } catch (e) {
    statusDiv.innerHTML = `<div class="status error">Error: ${e.message}</div>`;
  }
});

loadSettings();
