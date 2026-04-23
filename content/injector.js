let currentExtraction = null;
let xhrInterceptCallback = null;

async function getConfig() {
  const storage = await chrome.storage.sync.get([
    'configIndexUrl', 'githubPat', 'cacheTtlMinutes',
    'index', 'indexCachedAt', 'platforms'
  ]);

  const ttl = (storage.cacheTtlMinutes ?? 60) * 60 * 1000;
  const headers = storage.githubPat
    ? { Authorization: `Bearer ${storage.githubPat}` }
    : {};

  let index = storage.index;
  const indexAge = Date.now() - (storage.indexCachedAt ?? 0);

  if (!index || indexAge > ttl) {
    try {
      const res = await fetch(storage.configIndexUrl, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      index = await res.json();
      await chrome.storage.sync.set({ index, indexCachedAt: Date.now() });
    } catch (e) {
      console.error('Failed to fetch index:', e);
      return { index: storage.index, platforms: storage.platforms ?? {} };
    }
  }

  const platforms = storage.platforms ?? {};
  for (const entry of (index?.platforms ?? []).filter(p => p.active)) {
    const cached = platforms[entry.id];
    const age = Date.now() - (cached?.cachedAt ?? 0);
    if (!cached || age > ttl) {
      try {
        const res = await fetch(entry.url, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const config = await res.json();
        platforms[entry.id] = { ...config, cachedAt: Date.now() };
      } catch (e) {
        console.error(`Failed to fetch platform ${entry.id}:`, e);
      }
    }
  }

  await chrome.storage.sync.set({ platforms });
  return { index, platforms };
}

function extractJsonScript(config) {
  let scripts;
  if (config.scriptId) {
    const script = document.getElementById(config.scriptId);
    if (!script) return null;
    scripts = [script];
  } else {
    scripts = Array.from(document.querySelectorAll('script[type="application/json"]'));
  }

  for (const script of scripts) {
    try {
      let content = script.textContent;
      if (config.scriptClean) {
        content = content.replace(config.scriptClean, '');
      }
      const data = JSON.parse(content);
      return extractFields(data, config.fields);
    } catch (e) {
      continue;
    }
  }
  return null;
}

function extractFields(data, fields) {
  const result = {};
  for (const [fieldName, path] of Object.entries(fields)) {
    result[fieldName] = resolvePath(data, path) ?? null;
  }
  return result;
}

function resolvePath(obj, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return isNaN(key) ? acc[key] : acc[parseInt(key)];
  }, obj);
}

function matchesUrl(pattern, url) {
  if (!pattern) return false;
  return url.includes(pattern);
}

async function runExtraction(config) {
  if (config.type === 'json_script') {
    const data = extractJsonScript(config);
    if (data) {
      return {
        platform: config.id,
        platformLabel: config.label,
        configVersion: config.version,
        profileUrl: window.location.href,
        ...data
      };
    }
  } else if (config.type === 'xhr_intercept') {
    return new Promise((resolve) => {
      xhrInterceptCallback = (captured) => {
        if (matchesUrl(config.urlMatch, captured.url)) {
          const data = extractFields(captured.response, config.fields);
          resolve({
            platform: config.id,
            platformLabel: config.label,
            configVersion: config.version,
            profileUrl: window.location.href,
            ...data
          });
        }
      };
      setTimeout(() => resolve(null), 5000);
    });
  }
  return null;
}

async function initializeExtraction() {
  const { index, platforms } = await getConfig();
  if (!index || !index.platforms) return;

  for (const entry of index.platforms.filter(p => p.active)) {
    const config = platforms[entry.id];
    if (!config) continue;

    if (!matchesUrl(config.hostMatch, window.location.href)) continue;
    if (!matchesUrl(config.profileUrlPattern, window.location.href)) continue;

    if (config.type === 'json_script') {
      const result = await runExtraction(config);
      if (result) {
        currentExtraction = result;
        break;
      }
    } else if (config.type === 'xhr_intercept') {
      setupXhrInterception((captured) => {
        if (matchesUrl(config.urlMatch, captured.url)) {
          const data = extractFields(captured.response, config.fields);
          currentExtraction = {
            platform: config.id,
            platformLabel: config.label,
            configVersion: config.version,
            profileUrl: window.location.href,
            ...data
          };
        }
      });
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getExtraction') {
    sendResponse({ extraction: currentExtraction });
  }
});

initializeExtraction();
