let currentExtraction = null;
let xhrInterceptCallbacks = [];

const DEBUG = true;

function log(msg, data) {
  if (DEBUG) {
    if (data !== undefined) {
      console.log(`[Anthros] ${msg}`, data);
    } else {
      console.log(`[Anthros] ${msg}`);
    }
  }
}

async function getConfig() {
  const storage = await chrome.storage.sync.get([
    'configIndexUrl', 'cacheTtlMinutes',
    'index', 'indexCachedAt', 'platforms'
  ]);

  const configIndexUrl = storage.configIndexUrl;
  const ttl = (storage.cacheTtlMinutes ?? 60) * 60 * 1000;

  let index;
  let platforms = storage.platforms ?? {};

  if (configIndexUrl) {
    log('Using configured index URL');
    const indexAge = Date.now() - (storage.indexCachedAt ?? 0);

    if (!storage.index || indexAge > ttl) {
      try {
        log('Fetching fresh index from', configIndexUrl);
        const res = await fetch(configIndexUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        index = await res.json();
        await chrome.storage.sync.set({ index, indexCachedAt: Date.now() });
        log('Index fetched successfully, platforms:', index.platforms.length);
      } catch (e) {
        log('Failed to fetch index:', e.message);
        index = storage.index || EMBEDDED_INDEX;
      }
    } else {
      log('Using cached index');
      index = storage.index;
    }

    for (const entry of (index?.platforms ?? []).filter(p => p.active)) {
      const cached = platforms[entry.id];
      const age = Date.now() - (cached?.cachedAt ?? 0);
      if (!cached || age > ttl) {
        try {
          log(`Fetching platform config: ${entry.id}`);
          const res = await fetch(entry.url, { cache: 'no-store' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const config = await res.json();
          platforms[entry.id] = { ...config, cachedAt: Date.now() };
          log(`Platform ${entry.id} loaded (v${config.version})`);
        } catch (e) {
          log(`Failed to fetch platform ${entry.id}:`, e.message);
          platforms[entry.id] = EMBEDDED_PLATFORMS[entry.id];
        }
      } else {
        log(`Using cached platform: ${entry.id}`);
      }
    }
  } else {
    log('Using embedded configs');
    index = EMBEDDED_INDEX;
    for (const entry of (index?.platforms ?? []).filter(p => p.active)) {
      platforms[entry.id] = EMBEDDED_PLATFORMS[entry.id];
      log(`Loaded embedded platform: ${entry.id}`);
    }
  }

  await chrome.storage.sync.set({ platforms });
  return { index, platforms };
}

function extractJsonScript(config) {
  let scripts;
  if (config.scriptId) {
    const script = document.getElementById(config.scriptId);
    if (!script) {
      log(`Script with ID ${config.scriptId} not found`);
      return null;
    }
    scripts = [script];
  } else if (config.scriptMatch) {
    scripts = Array.from(document.querySelectorAll('script')).filter(s => {
      return s.textContent && s.textContent.includes(config.scriptMatch);
    });
    if (scripts.length === 0) {
      log(`No script found matching: ${config.scriptMatch}`);
      return null;
    }
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
      log('Parsed JSON from script', { keys: Object.keys(data).slice(0, 3) });
      return extractFields(data, config.fields);
    } catch (e) {
      log(`Failed to parse script content: ${e.message}`);
      continue;
    }
  }
  return null;
}

function extractFields(data, fields) {
  const result = {};
  for (const [fieldName, path] of Object.entries(fields)) {
    const value = resolvePath(data, path);
    result[fieldName] = value ?? null;
  }
  const found = Object.values(result).filter(v => v !== null).length;
  log(`Extracted ${found}/${Object.keys(fields).length} fields`);
  return result;
}

function resolvePath(obj, path) {
  if (!path || typeof path !== 'string') return undefined;
  return path.split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    if (isNaN(key)) {
      return acc[key];
    } else {
      const idx = parseInt(key);
      return Array.isArray(acc) ? acc[idx] : undefined;
    }
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
  log('Initializing extraction for', window.location.href);
  const { index, platforms } = await getConfig();
  if (!index || !index.platforms) {
    log('No index or platforms available');
    return;
  }

  for (const entry of index.platforms.filter(p => p.active)) {
    const config = platforms[entry.id];
    if (!config) {
      log(`Platform ${entry.id} in index but config not loaded`);
      continue;
    }

    if (!matchesUrl(config.hostMatch, window.location.href)) {
      continue;
    }
    if (!matchesUrl(config.profileUrlPattern, window.location.href)) {
      continue;
    }

    log(`Found matching platform: ${entry.id} (${config.label})`);

    if (config.type === 'json_script') {
      const result = await runExtraction(config);
      if (result) {
        currentExtraction = result;
        log('Extraction successful', { fields: Object.keys(result) });
        break;
      } else {
        log('json_script extraction failed');
      }
    } else if (config.type === 'xhr_intercept') {
      log('Setting up XHR interception');
      setupXhrInterception((captured) => {
        if (matchesUrl(config.urlMatch, captured.url)) {
          log('XHR matched, extracting fields');
          const data = extractFields(captured.response, config.fields);
          currentExtraction = {
            platform: config.id,
            platformLabel: config.label,
            configVersion: config.version,
            profileUrl: window.location.href,
            ...data
          };
          log('XHR extraction successful', { fields: Object.keys(data) });
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
