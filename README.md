# Anthros Creator Saver

A Chrome extension that scrapes creator profile data from social platforms and saves it to the Anthros Convex database. Extraction logic is driven by remote JSON config files hosted on GitHub, enabling updates without redeploying the extension.

## Features

- **One-click profile saving** - Click the extension icon on any supported creator profile
- **Remote-driven extraction** - Update scraping logic by editing GitHub config files
- **Zero-latency config updates** - Changes take effect within the cache TTL (default 60 minutes)
- **Per-platform configuration** - Each platform has its own versioned config file
- **Multiple extraction methods**:
  - `json_script`: Parse JSON from script tags (TikTok, YouTube)
  - `xhr_intercept`: Intercept XHR responses (Instagram)
- **Smart caching** - Each platform config cached independently with TTL-based invalidation
- **Editable preview** - Review and correct extracted fields before saving
- **Direct Convex integration** - Profiles saved to Anthros database via HTTP action

## Project Structure

```
/AnthrosExtension
  manifest.json                 MV3 configuration
  background.js                 Service worker (Convex integration)
  content/
    injector.js                 Main content script, runs on all page loads
    resolver.js                 Utility for walking dot-notation JSON paths
    xhr-intercept.js            XHR response interception
  popup/
    popup.html                  Save profile UI
    popup.js                    Popup logic (extraction preview, save)
  options/
    options.html                Settings page
    options.js                  Config management, platform status
  sample-configs/
    index.json                  Registry of platforms
    platforms/
      tiktok.json               TikTok extraction config
      youtube.json              YouTube extraction config
      instagram.json            Instagram extraction config
      facebook.json             Facebook extraction config
  LOCAL_TESTING_GUIDE.md        Setup and debugging guide
```

## Quick Start

### 1. Load Extension

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `/AnthrosExtension` directory

### 2. Configure Extension

1. Right-click extension icon → **Options**
2. Set **GitHub Config Index URL** to your config repo URL
   - Local testing: `http://localhost:8000/index.json`
   - Production: `https://raw.githubusercontent.com/yourorg/anthros-scraper-configs/main/index.json`
3. Set **Convex Deployment URL** to your Convex deployment
4. (Optional) Add **GitHub PAT** if using private config repo
5. Click **Save Settings** and **Refresh Now**

### 3. Test Extraction

1. Visit a TikTok profile: `https://www.tiktok.com/@creator`
2. Click extension icon
3. Review extracted fields in the popup
4. Click **Save** to send to Convex

## Configuration

### index.json (Registry)

Defines which platforms are active and where their configs live.

```json
{
  "version": 1,
  "platforms": [
    {
      "id": "tiktok",
      "label": "TikTok",
      "url": "https://raw.githubusercontent.com/org/repo/main/platforms/tiktok.json",
      "active": true
    }
  ]
}
```

- `id`: Machine-readable identifier
- `label`: Human-readable display name
- `url`: Full URL to platform config file
- `active`: Enable/disable platform without deleting config

### Platform Config Files

Each platform has a JSON file with extraction paths and metadata.

**json_script type (TikTok, YouTube)**

```json
{
  "id": "tiktok",
  "label": "TikTok",
  "version": 3,
  "hostMatch": "tiktok.com",
  "profileUrlPattern": "tiktok.com/@",
  "type": "json_script",
  "scriptId": "__UNIVERSAL_DATA_FOR_REHYDRATION__",
  "fields": {
    "username": "__DEFAULT_SCOPE__.webapp.user-detail.userInfo.user.uniqueId",
    "displayName": "__DEFAULT_SCOPE__.webapp.user-detail.userInfo.user.nickname",
    "bio": "__DEFAULT_SCOPE__.webapp.user-detail.userInfo.user.signature",
    "followers": "__DEFAULT_SCOPE__.webapp.user-detail.userInfo.stats.followerCount",
    "verified": "__DEFAULT_SCOPE__.webapp.user-detail.userInfo.user.verified"
  }
}
```

**xhr_intercept type (Instagram)**

```json
{
  "id": "instagram",
  "label": "Instagram",
  "version": 7,
  "hostMatch": "instagram.com",
  "profileUrlPattern": "instagram.com/",
  "type": "xhr_intercept",
  "urlMatch": "/api/v1/users/web_profile_info/",
  "fields": {
    "username": "data.user.username",
    "displayName": "data.user.full_name",
    "bio": "data.user.biography",
    "followers": "data.user.edge_followed_by.count",
    "verified": "data.user.is_verified"
  }
}
```

**Fields in config:**

| Field | Type | Purpose |
|---|---|---|
| `id` | string | Machine-readable ID |
| `label` | string | Display name |
| `version` | integer | Config version, incremented on updates |
| `hostMatch` | string | URL must include this string |
| `profileUrlPattern` | string | URL must include this string (profile-specific) |
| `type` | string | `json_script` or `xhr_intercept` |
| `scriptId` | string (json_script) | Element ID of script tag containing JSON |
| `scriptMatch` | string (json_script) | Search for script containing this text (e.g., "var ytInitialData") |
| `scriptClean` | string (json_script) | Remove this prefix before parsing JSON (e.g., "var ytInitialData = ") |
| `urlMatch` | string (xhr_intercept) | URL must include this string to intercept |
| `fields` | object | Keys are field names, values are dot-notation paths to extract |

### Caching Strategy

Each platform's config is cached independently with a TTL (default 60 minutes):

```javascript
// From chrome.storage.sync
{
  configIndexUrl: "...",
  githubPat: "...",
  cacheTtlMinutes: 60,
  index: { ...fetched index.json ... },
  indexCachedAt: 1713870000000,
  platforms: {
    tiktok: { ...tiktok.json content..., cachedAt: 1713870000000 },
    instagram: { ...instagram.json content..., cachedAt: 1713860000000 }
  }
}
```

**On page load:**
1. Check if index cache is stale → fetch fresh index if needed
2. For each active platform in index:
   - If platform config cache is stale → fetch fresh config
   - Otherwise use cached config
3. Match current URL against `hostMatch` and `profileUrlPattern`
4. Run extraction using matched platform config

## Data Flow

```
User visits creator profile (e.g., tiktok.com/@creator)
        ↓
Content script (injector.js) loads
        ↓
Fetch index from cache or GitHub
        ↓
Fetch stale platform configs
        ↓
Match URL to active platforms
        ↓
Extract data (json_script or xhr_intercept)
        ↓
Store in currentExtraction
        ↓
User clicks extension icon
        ↓
Popup requests extraction from content script
        ↓
Display editable preview
        ↓
User confirms save
        ↓
Background worker POSTs to Convex
        ↓
Profile saved to database
```

## Extraction Methods

### json_script

Parses JSON from a script tag on the page.

1. Locate script by `scriptId` (e.g., `document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__')`)
2. Or search all scripts for text matching `scriptMatch` (e.g., "var ytInitialData")
3. Extract textContent, remove prefix if `scriptClean` specified
4. Parse as JSON
5. Walk field paths using dot-notation (e.g., `a.b.c[0].d`)
6. Return extracted fields

### xhr_intercept

Intercepts XHR responses during page load.

1. Patch `XMLHttpRequest.prototype.open` and `send`
2. Listen for responses matching `urlMatch` in the URL
3. Parse response JSON
4. Walk field paths
5. Return extracted fields

More fragile than json_script (depends on API endpoint stability) but faster (captures data at network layer).

## Convex Integration

On save, the background worker POSTs to:
```
POST {convexUrl}/save-creator
```

**Payload:**
```json
{
  "platform": "tiktok",
  "profileUrl": "https://tiktok.com/@handle",
  "username": "handle",
  "displayName": "Creator Name",
  "bio": "Bio text",
  "followers": 84200,
  "verified": false,
  "scrapedAt": "2026-04-23T10:00:00Z",
  "source": "chrome_extension",
  "configVersion": 3,
  "customField1": "value1"
}
```

**Deduplication:** If `profileUrl` already exists, the record is updated (not duplicated).

## Debugging

### Enable Logging

All logging is controlled by the `DEBUG` flag in `content/injector.js`:

```javascript
const DEBUG = true;  // Set to false in production
```

Logs appear in browser DevTools console with `[Anthros]` prefix.

### Check Chrome Storage

```javascript
// In DevTools console
chrome.storage.sync.get(null, result => console.log(result));
```

### Inspect Extraction

1. Go to Options page
2. Click **Preview** next to any platform
3. See cached JSON and when it was fetched

### Watch XHR Interception

1. Open DevTools → **Network** tab
2. Filter by API endpoint name
3. Click **Refresh** in Options page
4. Watch requests come in

## Troubleshooting

**"Not on a supported creator profile page"**
- URL must match both `hostMatch` AND `profileUrlPattern` in config
- Check that platform is in index.json with `active: true`

**Fields showing "not found"**
- Platform changed page structure
- Update field paths in platform config
- Increment `version` number
- Push to GitHub
- Click **Refresh** in Options page (or wait for cache TTL)

**Save fails with "Convex URL not configured"**
- Go to Options page
- Paste Convex deployment URL
- Click Save Settings

**XHR interception not working**
- Check DevTools Network tab for actual API endpoint URL
- Update `urlMatch` in config
- Ensure extension has `host_permissions` for the domain

## Adding a New Platform

1. Create a new file `platforms/newplatform.json` with extraction config
2. Add entry to `index.json` with `active: true`
3. Push to GitHub
4. Extension picks up the new platform within cache TTL

No code changes or extension redeployment required (for json_script types).

## Updating Extraction Logic

1. Edit `platforms/xxx.json` with new field paths
2. Increment `version` field
3. Push to GitHub
4. Changes take effect after cache TTL expires (or click **Refresh Now** in Options)

## Development

### Local Testing

See `LOCAL_TESTING_GUIDE.md` for detailed setup instructions.

### Code Organization

- **content/injector.js** - Entry point, loads configs, matches URLs, runs extraction
- **content/resolver.js** - Utility for dot-notation path walking
- **content/xhr-intercept.js** - XHR patching for API interception
- **background.js** - Service worker, Convex HTTP integration
- **popup/** - Save dialog UI
- **options/** - Settings and platform management

### Testing Checklist

- [ ] Extension loads without errors
- [ ] Settings persist across reloads
- [ ] Config index fetches successfully
- [ ] TikTok extraction works
- [ ] YouTube extraction works
- [ ] Instagram XHR interception works
- [ ] Save to Convex succeeds
- [ ] Cache TTL respected
- [ ] Manual refresh bypasses cache

## Production Deployment

1. Update config URLs in index.json to production GitHub URLs
2. Create private GitHub repo with all platform configs
3. Generate GitHub PAT with `repo` scope
4. Increment manifest.json version
5. Test thoroughly in Chrome dev mode
6. Package as .crx or .zip
7. Distribute to users

## Non-Goals (V1)

- Login to social platforms
- Private account scraping
- Automated batch scraping
- Multi-user sync
- Android or Firefox support
- Export to CSV from extension

---

For questions, see `LOCAL_TESTING_GUIDE.md` or inspect page source with DevTools.
