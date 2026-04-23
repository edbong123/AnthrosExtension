chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveCreator') {
    saveCreatorProfile(request.data).then(sendResponse).catch(err => {
      sendResponse({ error: err.message });
    });
    return true;
  }
});

async function saveCreatorProfile(data) {
  const storage = await chrome.storage.sync.get(['convexUrl']);
  const convexUrl = storage.convexUrl;

  if (!convexUrl) {
    throw new Error('Convex URL not configured');
  }

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
    configVersion: data.configVersion,
    ...Object.fromEntries(
      Object.entries(data).filter(([k]) =>
        ![
          'platform', 'profileUrl', 'username', 'displayName', 'bio',
          'followers', 'verified', 'configVersion', 'platformLabel'
        ].includes(k)
      )
    )
  };

  const response = await fetch(`${convexUrl}/save-creator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
}
