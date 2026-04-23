# Config Testing & Validation

This guide helps you validate extraction configs against real platform pages.

## Quick Test Procedure

1. **Load extension** in Chrome dev mode
2. **Go to Options** (right-click extension → Settings)
3. Set **Config Index URL** to: `http://localhost:8000/index.json` (if serving locally)
4. Click **Refresh Now**
5. **Open the platform profile page**
6. **Open side panel** (click extension icon)
7. **Check the log** for extraction status and errors

## Validating Each Platform

### TikTok (json_script)

**Test Profile:** https://www.tiktok.com/@tiktok

**What to check:**
1. Side panel should show "✓ Data extracted"
2. Fields should appear: username, displayName, bio, followers, verified
3. Log should show success messages

**If extraction fails:**

Open DevTools console (F12) and run:
```javascript
// Find the script ID
const scripts = Array.from(document.querySelectorAll('script'));
scripts.forEach(s => {
  if (s.id === '__UNIVERSAL_DATA_FOR_REHYDRATION__') {
    const data = JSON.parse(s.textContent);
    console.log(JSON.stringify(data, null, 2).substring(0, 500));
  }
});
```

Then check the actual structure and update `platforms/tiktok.json` paths.

**Common issues:**
- Script ID changed → check if `__UNIVERSAL_DATA_FOR_REHYDRATION__` still exists
- Path structure changed → navigate the JSON to find new location
- If no `__UNIVERSAL_DATA_FOR_REHYDRATION__` script, use `scriptMatch` with a unique substring

### YouTube (json_script with scriptMatch)

**Test Channel:** https://www.youtube.com/@YouTube

**What to check:**
1. Side panel should show "✓ Data extracted"
2. Fields should appear: username (channel handle), displayName, bio, subscribers, videoCount
3. Log should show successful script matching

**If extraction fails:**

Open DevTools console:
```javascript
// Find the script containing ytInitialData
const scripts = Array.from(document.querySelectorAll('script'));
const ytScript = scripts.find(s => s.textContent.includes('var ytInitialData'));
if (ytScript) {
  const content = ytScript.textContent;
  const cleaned = content.replace('var ytInitialData = ', '');
  const data = JSON.parse(cleaned);
  
  // Explore the structure
  console.log(Object.keys(data)); // Look for header key
  console.log(JSON.stringify(data.header, null, 2).substring(0, 500));
}
```

Then update paths in `platforms/youtube.json` based on actual structure.

**Common issues:**
- YouTube uses different JSON wrapper keys across pages
- Subscriber count returned as string (e.g., "1.2M subscribers") - needs post-processing
- Header structure varies by channel type (creator vs. brand vs. channel)

### Instagram (xhr_intercept)

**Test Profile:** https://www.instagram.com/instagram/

**What to check:**
1. Side panel should show "✓ Data extracted" (after a moment)
2. Fields should appear: username, displayName, bio, followers, verified
3. Log should show "✓ XHR matched, extracting fields"

**If extraction fails:**

Open DevTools → **Network** tab:
1. Filter by "users/web_profile_info"
2. Reload page
3. Click on the matching request
4. Go to **Response** tab
5. Expand the JSON structure
6. Find the actual path to username, followers, etc.
7. Update `platforms/instagram.json` fields

Expected response structure:
```json
{
  "data": {
    "user": {
      "username": "instagram",
      "full_name": "Instagram",
      "biography": "...",
      "edge_followed_by": { "count": 123456 },
      "is_verified": true
    }
  }
}
```

**Common issues:**
- API endpoint URL changed → check actual request URL in Network tab
- Response structure changed → verify with actual API response
- XHR happens after page load → side panel catches it asynchronously
- Private account → API still works but `is_verified` might be different

### Facebook (DOM parsing - currently disabled)

**Test Profile:** https://www.facebook.com/facebook/

**What to check (when enabled):**
1. Currently in `active: false` state
2. Would require DOM parsing (more brittle)
3. Recommended approach: use json_script if Facebook embeds data

**If you want to enable:**
1. Set `active: true` in `index.json`
2. Open DevTools on Facebook profile
3. Look for creator name, bio, profile image
4. Write CSS selectors to extract them
5. Update `platforms/facebook.json` with selectors

---

## Fixing Broken Extraction

### Step 1: Identify the failure

Check side panel log for:
- "No script found matching: xxx" → script changed or moved
- "✗ Extraction failed" → script exists but path is wrong
- "(not found)" fields → specific path is wrong
- No log entry → config not loaded or page doesn't match pattern

### Step 2: Inspect the page

Use DevTools to find the actual data:

**For json_script:**
```javascript
// Find all scripts with their IDs and first 100 chars
Array.from(document.querySelectorAll('script')).forEach((s, i) => {
  console.log(`[${i}] ID: ${s.id || 'none'}, Type: ${s.type || 'none'}`);
  console.log('  Content:', s.textContent.substring(0, 100));
});
```

**For json_script with text matching:**
```javascript
// Find script by content
const script = Array.from(document.querySelectorAll('script')).find(s => 
  s.textContent.includes('YOUR_SEARCH_STRING')
);
if (script) {
  // Extract and parse
  let content = script.textContent;
  // Apply scriptClean if needed
  const data = JSON.parse(content);
  console.log(JSON.stringify(data, null, 2));
}
```

**For xhr_intercept:**
```javascript
// Watch Network tab for matching requests
// Filter by endpoint name
// Check Response tab for actual data structure
```

### Step 3: Update the config

Edit `sample-configs/platforms/xxx.json`:

1. Update the problematic field path
2. Increment the `version` number
3. Update `scriptId`, `scriptMatch`, or `urlMatch` if needed
4. Save and commit

### Step 4: Test the fix

1. Go to Options page
2. Click **Refresh** next to the platform
3. Revisit the profile page
4. Check side panel for extraction

---

## Config Schema Reference

All platforms must have:

```json
{
  "id": "platform-id",              // Machine-readable
  "label": "Platform Name",         // Display name
  "version": 1,                     // Increment on changes
  "hostMatch": "example.com",       // URL must contain this
  "profileUrlPattern": "example.com/user",  // URL profile pattern
  "type": "json_script",            // or xhr_intercept
  "fields": {
    "fieldName": "path.to.value",   // Dot-notation paths
    "anotherField": "data.items.0.name"
  }
}
```

**json_script specific:**
- `scriptId`: Element ID containing JSON (e.g., "__UNIVERSAL_DATA_FOR_REHYDRATION__")
- `scriptMatch`: Text to search for (e.g., "var ytInitialData")
- `scriptClean`: Prefix to remove before parsing (e.g., "var ytInitialData = ")

**xhr_intercept specific:**
- `urlMatch`: XHR URL must contain this (e.g., "/api/v1/users/web_profile_info/")

---

## Known Challenges

### Path Structure Changes
Platforms update their JSON structure regularly. Symptoms:
- Extraction returns null values
- Side panel shows "(not found)" for most fields
- Log shows successful parsing but empty results

**Solution:** Inspect the page, update paths, increment version

### Platform-Specific Quirks

**TikTok:**
- Data structure deeply nested
- Follower count already numeric
- Verified status is boolean
- Bio can be very long

**YouTube:**
- Different header structure for different channel types
- Subscriber count is a formatted string
- May need regex to parse "1.2M" → 1200000
- Video count also formatted

**Instagram:**
- API response is most reliable source
- Bio can contain URLs and mentions
- Verified status is always boolean
- follower count at `edge_followed_by.count`

**Facebook:**
- Least reliable (DOM parsing required)
- Different layout for pages vs. profiles
- Creator info scattered across multiple elements
- May need multiple CSS selectors

---

## Testing Checklist

- [ ] TikTok extraction works (username, displayName, followers)
- [ ] YouTube extraction works (channel handle, video count)
- [ ] Instagram extraction works (XHR captured, data extracted)
- [ ] All "not found" fields investigated and paths validated
- [ ] No errors in side panel log
- [ ] Extraction completes within 2 seconds
- [ ] Can handle edge cases (very long bios, special characters)
- [ ] Configs load successfully on refresh
- [ ] Convex save works (if URL configured)

---

## Debugging Tips

**Enable detailed logging:**
In `content/injector.js`, ensure:
```javascript
const DEBUG = true;
```

**Watch browser console:**
Right-click extension → **Inspect** opens full extension UI
- Inspect popup: `chrome-extension://xxx/side-panel/side-panel.html`
- Inspect service worker: background.js logs appear here
- Inspect content script: logs appear on the page's DevTools

**Test path resolution:**
```javascript
// In DevTools console (on the page)
function resolvePath(obj, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return isNaN(key) ? acc[key] : acc[parseInt(key)];
  }, obj);
}

// Test it
const obj = { a: { b: { c: [1, 2, 3] } } };
console.log(resolvePath(obj, 'a.b.c.1')); // Should be 2
```

**Monitor network requests:**
DevTools → Network tab → Filter by endpoint
- Instagram: filter for "users/web_profile_info"
- TikTok/YouTube: no network calls needed (data in page)

---

## Submitting Config Updates

Once you've validated a fix:

1. Update `sample-configs/platforms/xxx.json`
2. Increment `version`
3. Commit with clear message:
   ```
   Fix tiktok extraction: update path to follower count
   
   Changed: __DEFAULT_SCOPE__.webapp.user-detail.userInfo.stats.followerCount
   Reason: Platform updated JSON structure
   Version: 3 → 4
   ```
4. Push to branch
5. Test in extension one more time

---

For any config that consistently breaks, consider using `xhr_intercept` approach or opening an issue with the actual page structure.
