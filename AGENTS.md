# AGENTS.md

## Project Overview

**Anthros Chrome Extension** is a Chrome extension (Manifest V3) that scrapes creator profile data from social platforms (TikTok, YouTube, Instagram, Facebook) and saves it to the Anthros Convex database. Extraction logic is driven by remote JSON config files hosted on GitHub, so scraping rules can be updated without redeploying the extension.

**Stack:** Vanilla JavaScript, Chrome Extension APIs (MV3), Convex HTTP Actions, GitHub-hosted JSON configs.

---

## Repository Structure

```
/AnthrosExtension
  manifest.json               MV3 config, permissions, content script registration
  background.js               Service worker - handles Convex HTTP POST
  content/
    injector.js               Entry point - loads configs, matches URLs, runs extraction
    resolver.js               Dot-notation path walker for JSON traversal
    xhr-intercept.js          Patches XMLHttpRequest for API response capture
  popup/
    popup.html                Save profile UI
    popup.js                  Extraction preview and save logic
  options/
    options.html              Settings page
    options.js                Config management and platform status
  sample-configs/
    index.json                Platform registry
    platforms/
      tiktok.json
      youtube.json
      instagram.json
      facebook.json
```

---

## Key Concepts

### Config-Driven Extraction

All scraping logic lives in remote JSON files, not in extension code. Two extraction types:

- `json_script` - parse JSON from a script tag (TikTok, YouTube)
- `xhr_intercept` - intercept XHR responses (Instagram)

### Caching

Configs are cached in `chrome.storage.sync` with a TTL (default 60 min). Each platform is cached independently. On page load, stale configs are re-fetched before extraction runs.

### Data Flow

```
Page load -> injector.js -> fetch/cache configs -> URL match -> extract data
User clicks icon -> popup.js -> display preview -> confirm save
Background worker -> POST to Convex /save-creator
```

---

## Agent Guidelines

### General Rules

- Never hardcode extraction field paths in JS. All paths belong in platform JSON configs.
- Never skip incrementing `version` when editing a platform config file.
- Do not introduce build tools, bundlers, or npm dependencies. This is a zero-build extension.
- Keep `DEBUG = false` in `content/injector.js` for any production-facing code.

### Working with Configs

- Platform configs live in `sample-configs/platforms/`. The registry is `sample-configs/index.json`.
- To add a platform: create `platforms/newplatform.json`, add entry to `index.json` with `"active": true`.
- To update extraction: edit field paths, increment `version`, push. Cache will invalidate after TTL or manual refresh.
- Field values are dot-notation paths (e.g., `data.user.edge_followed_by.count`). Arrays use bracket notation (e.g., `results[0].name`).

### Convex Integration

- The background worker POSTs to `{convexUrl}/save-creator`.
- Deduplication is by `profileUrl`. Existing records are updated, not duplicated.
- Required payload fields: `platform`, `profileUrl`, `username`, `scrapedAt`, `source`.
- Do not modify the payload shape without coordinating with the Convex backend.

### Chrome Extension Constraints

- MV3: no persistent background pages. Service worker only.
- Content scripts run on all pages via `injector.js`. Keep them lightweight.
- Storage is `chrome.storage.sync`, not localStorage.
- Host permissions are declared in `manifest.json`. Update there if adding new platform domains.

### XHR Interception

- `xhr-intercept.js` patches `XMLHttpRequest.prototype.open` and `send`.
- This runs early in page load. Any errors here can break the page.
- Only intercept URLs matching `urlMatch` from the platform config. Never intercept broadly.

### Testing Checklist

Before any PR:

- [ ] Extension loads in `chrome://extensions/` without errors
- [ ] Settings persist across reloads
- [ ] Config index fetches from configured URL
- [ ] Extraction works on at least one supported platform
- [ ] Save to Convex returns success
- [ ] Cache TTL is respected
- [ ] Manual refresh in Options bypasses cache

---

## Out of Scope (V1)

Do not implement:

- Login or session management on social platforms
- Automated or batch scraping
- Multi-user sync
- Firefox or Android support
- CSV export from the extension
- Private account scraping
