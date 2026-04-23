# Local Testing Guide

## Setup

### 1. Host Config Files Locally or Use Sample Configs

For local testing, you can either:

**Option A: Use a local HTTP server (recommended)**
```bash
cd sample-configs
python3 -m http.server 8000
```
This serves files at `http://localhost:8000/index.json`, etc.

**Option B: Use GitHub (production-like)**
Create a private GitHub repo with the config files from `sample-configs/` and generate a Personal Access Token.

### 2. Load Extension in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `/AnthrosExtension` directory
5. The extension should appear with ID and options

### 3. Configure Extension

1. Right-click extension icon → **Options**
2. Set **GitHub Config Index URL** to:
   - Local: `http://localhost:8000/index.json`
   - GitHub: `https://raw.githubusercontent.com/yourorg/anthros-scraper-configs/main/index.json`
3. Set **Convex Deployment URL** (or use a mock for testing)
4. Leave **GitHub PAT** empty if using public repo, else paste token
5. Click **Save Settings**
6. Click **Refresh Now** to fetch configs

### 4. Test Extraction

#### TikTok (json_script type)
1. Visit any public TikTok creator profile: `https://www.tiktok.com/@username`
2. Click extension icon
3. Should see extracted fields (username, displayName, bio, followers, etc.)
4. Edit fields if needed
5. Click **Save** (will POST to Convex URL configured)

#### YouTube (json_script with scriptMatch)
1. Visit any YouTube channel: `https://www.youtube.com/@channelname`
2. Click extension icon
3. Should see extracted fields
4. Verify format (e.g., subscribers as string like "1.2M subscribers")

#### Instagram (xhr_intercept type)
1. Visit any Instagram profile: `https://www.instagram.com/username`
2. Extension listens for XHR requests to `/api/v1/users/web_profile_info/`
3. Click extension icon
4. Should see extracted fields from intercepted API response
5. More reliable than DOM parsing; instant capture

#### Facebook (not active by default)
1. Requires DOM parsing (more fragile)
2. Enable in `sample-configs/index.json` by setting `active: true`
3. Visit public creator page
4. Test extraction

## Debugging

### Check Console Logs
1. Right-click extension icon → **Inspect popup** - see popup.js errors
2. Right-click extension icon → **Inspect service worker** - see background.js errors
3. On any profile page, open DevTools (F12) → **Console** - see content script logs

### Inspect Chrome Storage
```javascript
// In DevTools console on any site:
chrome.storage.sync.get(null, (result) => console.log(result));
```

### Test Config Fetch
1. Go to Options page
2. Click **Preview** next to any platform
3. Should see raw JSON config
4. Click **Refresh** to force re-fetch

### Mock Convex Response
If you don't have a real Convex endpoint, the extension will fail on save. Options:
- Create a simple local HTTP server that echoes POST requests
- Set `convexUrl` to `http://localhost:3001` and run a mock
- Use ngrok to tunnel to localhost

Example mock (node):
```javascript
const http = require('http');
http.createServer((req, res) => {
  if (req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'test-id', success: true }));
  }
}).listen(3001);
```

## Testing Checklist

- [ ] Extension loads without errors in Chrome
- [ ] Options page loads and settings persist
- [ ] Config index fetches successfully
- [ ] Platform configs fetch individually
- [ ] TikTok profile: extraction works, popup shows fields
- [ ] YouTube profile: extraction works with scriptMatch
- [ ] Instagram profile: XHR interception captures API response
- [ ] Editable preview in popup works
- [ ] Save button POSTs to Convex correctly
- [ ] Cache TTL respected (test by checking `cachedAt` timestamps)
- [ ] Stale config refreshes automatically
- [ ] **Refresh Now** button bypasses cache

## Common Issues

### "Not on a supported creator profile page"
- Check URL matches `profileUrlPattern` in config
- Confirm platform config is in `index.json` with `active: true`

### Fields showing "not found" (greyed out)
- Extract paths in config may be outdated
- Check page structure with DevTools → **Elements** (search for key JSON field names)
- Update paths in platform config and refresh

### XHR intercept not working (Instagram)
- Verify XHR setup script loads before page interacts with API
- Check `urlMatch` in config matches actual API endpoint
- Open Network tab in DevTools, filter by `users/web_profile_info`, verify response format

### Config not updating after GitHub push
- Check cache TTL hasn't expired (or click **Refresh Now**)
- Verify GitHub PAT has correct scopes (`repo`, `raw.githubusercontent.com` access)
- Try `curl` to manually fetch the URL

## Deployment to Production

Once testing is complete:

1. Update all config URLs in `sample-configs/index.json` to production GitHub URLs
2. Create private GitHub repo `anthros-scraper-configs` with all platform files
3. Generate GitHub PAT with `repo` scope
4. Bump extension version in `manifest.json`
5. Package extension as `.crx` or `.zip`
6. Load into Chrome Web Store or distribute to Ashley directly

---

For questions on specific extraction paths, consult the sample config comments or inspect live page JSON with DevTools.
