chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveCreator') {
    console.log('[Anthros BG] Saving creator:', request.data.platform);
    saveCreatorProfile(request.data)
      .then(result => {
        console.log('[Anthros BG] Save successful:', result);
        sendResponse(result);
      })
      .catch(err => {
        console.error('[Anthros BG] Save failed:', err);
        sendResponse({ error: err.message });
      });
    return true;
  }
});

async function saveCreatorProfile(data) {
  const storage = await chrome.storage.sync.get(['convexUrl']);
  const convexUrl = storage.convexUrl;

  if (!convexUrl) {
    throw new Error('Convex URL not configured. Go to extension options to set it.');
  }

  const standardFields = [
    'platform', 'profileUrl', 'username', 'displayName', 'bio',
    'followers', 'verified', 'configVersion', 'platformLabel'
  ];

  const payload = {
    platform: data.platform,
    profileUrl: data.profileUrl,
    username: data.username || null,
    displayName: data.displayName || null,
    bio: data.bio || null,
    followers: data.followers || null,
    verified: data.verified || null,
    scrapedAt: new Date().toISOString(),
    source: 'chrome_extension',
    configVersion: data.configVersion
  };

  for (const [key, value] of Object.entries(data)) {
    if (!standardFields.includes(key) && value !== null && value !== undefined) {
      payload[key] = value;
    }
  }

  console.log('[Anthros BG] POSTing to:', convexUrl);
  const response = await fetch(`${convexUrl}/save-creator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Convex HTTP ${response.status}: ${text}`);
  }

  return await response.json();
}
