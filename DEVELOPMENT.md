# Development Notes

## Architecture Decisions

### Remote Config-Driven Extraction

The core principle: **no hardcoded field paths**. All extraction logic lives in GitHub config files, not extension code.

**Benefits:**
- Update extraction without redeploying extension
- Add new platforms without code changes
- Config versions let us track breaking changes
- GitHub is the single source of truth

**Tradeoff:**
- Slightly slower on first page load (1-2 config fetches)
- Mitigated by aggressive caching with per-platform TTL

### Per-Platform Config Caching

Each platform config is cached independently:
```javascript
platforms: {
  tiktok: { ...config..., cachedAt: 1713870000000 },
  instagram: { ...config..., cachedAt: 1713860000000 }
}
```

**Why not cache as a single blob?**
- Allows selective refresh (only refresh stale platforms)
- Instagram changes more frequently than TikTok
- Avoids unnecessary refetches when only one platform updates
- Scales well as more platforms are added

**Cache invalidation:**
- Set via `cacheTtlMinutes` in options (default 60)
- Each platform tracked separately by `cachedAt` timestamp
- Manual refresh button bypasses TTL
- Stale configs refetched automatically on page load

### Service Worker vs Content Script Communication

The extension uses three channels:

1. **Content script ↔ Page**: Direct DOM access, JSON parsing, XHR interception
2. **Content script ↔ Service worker**: Message passing for Convex save
3. **Popup ↔ Content script**: Message passing for extraction preview

**Why not do Convex POST from content script?**
- Service workers have broader CORS access
- Better error handling and retry logic in background
- Can queue unsent saves if needed in future
- Cleaner separation of concerns

### XHR Interception Design

The `xhr-intercept.js` patches XMLHttpRequest at the native prototype level:

```javascript
XMLHttpRequest.prototype.open = function(method, url) {
  this._xhrUrl = url;  // Store URL for matching
  ...
}
```

**Why this approach?**
- Works before page scripts run
- Captures all XHR requests globally
- Matches on URL to filter relevant API calls
- Instagram API responses include all profile data in one request

**Limitation:**
- Only works for classic XMLHttpRequest (not Fetch API)
- Instagram might migrate to Fetch, requiring adaptation

### Dot-Notation Path Resolution

Field extraction uses simple dot-notation with array index support:

```javascript
"followers": "data.user.edge_followed_by.count"
"firstResult": "results.0.name"  // Array index
```

**Why not JSONPath or XPath?**
- Simpler to understand and maintain
- 90% of use cases covered
- Smaller code footprint
- Less error-prone than complex query languages

**Limitation:**
- Can't handle complex filters or conditionals
- If a platform embeds data at variable paths, we're stuck
- Mitigation: config version pinning, manual config updates

## Testing Strategy

### Unit Testing

Currently minimal. Should add:
- `resolvePath()` with various path formats
- `extractFields()` with null/undefined values
- XHR filtering with URL patterns

### Integration Testing

Manual testing with real pages is primary validation:
1. Load extension in Chrome dev mode
2. Visit real creator profiles
3. Verify popup shows correct fields
4. Save to Convex and check database

### Config Testing

Sample configs in `sample-configs/` provide baseline:
- TikTok: json_script with deeply nested object
- YouTube: json_script with scriptMatch
- Instagram: xhr_intercept with API response
- Facebook: placeholder for DOM parsing (not yet implemented)

## Known Limitations

### TikTok (json_script)
- Path `__DEFAULT_SCOPE__.webapp.user-detail...` assumes specific JSON structure
- TikTok frequently changes frontend, so these paths break often
- Mitigation: Monitor breakage, update config quickly

### YouTube (json_script)
- YouTube's `ytInitialData` structure is complex and changes periodically
- Subscribe count often obfuscated (returned as "1.2M subscribers" string)
- May need post-processing to parse numeric values

### Instagram (xhr_intercept)
- Only works for public profiles
- API endpoint might change
- Rate limiting could affect rapid profile saves
- XHR interception doesn't catch Fetch API calls

### Facebook (not implemented)
- Most reliable source is DOM parsing (brittle)
- Profile page structure varies by account type
- Low adoption suggests lower priority
- Currently marked `active: false`

## Future Enhancements

### Short Term
- Add Fetch API interception (for Instagram if they migrate)
- Numeric parsing for follower counts (convert "1.2M" → 1200000)
- Field validation (reject non-string values for username, etc.)
- Bulk save (multiple profiles at once)

### Medium Term
- Browser-local queue for failed saves (retry with exponential backoff)
- Config schema validation before use
- Automatic config update detection (poll more frequently than cache TTL)
- Multiple user support (per-user Convex tokens)

### Long Term
- Scheduled background scraping (low priority)
- Cross-browser support (Firefox extension)
- Webhook for GitHub config updates (instant push vs. cache TTL)
- Admin dashboard for config management (instead of GitHub editing)

## Debugging Techniques

### Check What's in the Page

On any creator profile:
```javascript
// Inspect page scripts
document.querySelectorAll('script').forEach(s => 
  console.log(s.id, s.textContent.substring(0, 100))
);

// Find JSON-like content
document.querySelectorAll('script[type="application/json"]').forEach(s =>
  console.log(JSON.parse(s.textContent))
);
```

### Watch Network Calls

```javascript
// In DevTools console
fetch('https://raw.githubusercontent.com/org/repo/main/platforms/tiktok.json')
  .then(r => r.json())
  .then(console.log);
```

### Test Path Resolution

```javascript
// In console on any page with data
const data = { a: { b: { c: [1, 2, 3] } } };
resolvePath(data, 'a.b.c.1');  // Returns 2
resolvePath(data, 'a.x.y');     // Returns undefined
```

### Manual XHR Capture

```javascript
// Manually trigger the interception
const requests = [];
XMLHttpRequest.prototype.addEventListener = function(event, callback) {
  if (event === 'readystatechange') {
    requests.push({ url: this._xhrUrl, response: this.responseText });
  }
};
```

## Performance Considerations

### Page Load Impact

**Worst case (first visit, no cache):**
- Fetch index.json: ~200ms
- Fetch 3 platform configs: ~600ms total
- Extract data: 10-50ms
- Total: ~850ms

**Best case (cached):**
- All data from chrome.storage.sync: ~50ms
- Extract data: 10-50ms
- Total: ~100ms

**Mitigation:**
- Cache aggressively (60-minute TTL)
- Use network cache headers (no-store prevents browser caching)
- Lazy-load configs only for active platforms

### Memory Usage

**Chrome.storage.sync limits:**
- ~100KB per extension
- Index.json: ~1KB
- 4 platform configs × ~2KB = ~8KB
- Total: ~10KB (well under limit)

**DOM parsing overhead:**
- Minimal (querySelector is fast on modern pages)
- XHR interception adds ~5KB code

## Maintenance Checklist

When platforms update their page structure:

1. **Identify the change**
   - Run extraction, check DevTools console for `[Anthros]` error logs
   - Inspect page source for new JSON structure

2. **Update config**
   - Edit `platforms/xxx.json` in config repo
   - Update field paths to match new structure
   - Increment `version` field
   - Commit and push

3. **Test**
   - Visit creator profile
   - Options page → **Refresh** (forces reload)
   - Click extension icon, verify extraction

4. **Monitor**
   - Check for follow-up issues
   - Log extraction success/failure in background

## Code Style

- No external dependencies (vanilla JS)
- Simple, readable code over clever optimizations
- Inline comments only for non-obvious logic
- Log messages with `[Anthros]` prefix for debugging
- Use modern ES6+ features (arrow functions, async/await, destructuring)

## Security

### Chrome Storage

- `chrome.storage.sync` is encrypted in transit
- Synced with user's Google account
- GitHub PAT stored unencrypted locally (risk: user's computer compromise)
- Convex URL stored in clear (no sensitive auth needed)

### Network Requests

- No cookies or credentials sent (public profiles only)
- GitHub PAT sent as Bearer token in Authorization header
- All requests use HTTPS

### Input Validation

- Platform config fetched from GitHub (trusted source)
- No user input into field paths (mitigates injection)
- Convex token managed server-side (not in extension)

### Mitigations for Future

- Consider encrypted storage for GitHub PAT
- Verify config file signatures (GitHub signing)
- Content Security Policy stricter rules
- Rate limiting on Convex saves

---

Questions? Check console logs with DEBUG=true, or inspect page source with DevTools.
