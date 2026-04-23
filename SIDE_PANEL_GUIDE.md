# Side Panel Guide

The extension now uses a **persistent side panel** instead of a modal popup. This keeps the extraction panel visible while you browse.

## How It Works

1. **Click the extension icon** on a creator profile page
2. **Side panel opens** on the right side of the browser
3. **Extraction runs automatically** and shows results in real-time
4. **Log displays** all extraction steps (success/failure)
5. **Edit fields** if needed and click **Save**
6. **Keep the panel open** while navigating between profiles

## Opening the Side Panel

- Click the extension icon on any supported platform (TikTok, YouTube, Instagram, Facebook)
- If you're not on a profile page, it will show "Not on a supported creator profile page"
- The panel stays open as you navigate to other profiles

## What You'll See

### Extraction Status
```
✓ Data extracted     (when data is found)
✗ No data extracted  (when extraction fails)
```

### Live Log
```
[10:34:22] Side panel opened
[10:34:23] Requesting extraction from tiktok.com
[10:34:23] ✓ Extraction found: tiktok
[10:34:23] Extracted 5/9 fields
```

### Extracted Fields
- Auto-populated from the page
- Greyed out if not found on the page
- Editable before saving
- Shows platform and URL (read-only)

### Action Buttons
- **Refresh**: Re-run extraction on current page
- **Save**: Send profile to Convex (if configured)

### Settings Link
- Opens extension options to configure Convex URL or index URL

## Troubleshooting the Side Panel

### Panel doesn't open
1. Make sure you're on a supported platform (tiktok.com, youtube.com, instagram.com, facebook.com)
2. Reload the extension: Go to `chrome://extensions/`, disable and re-enable
3. Check if side panel permission is granted

### Extraction shows "not found"
1. Click **Refresh** in the side panel
2. Wait 2-3 seconds for XHR interception (Instagram)
3. Check the log for error messages
4. Open DevTools and follow CONFIG_TESTING.md guide

### Save button is disabled
- Convex URL not configured
- Go to Settings and set your Convex deployment URL
- Or disable saving and just use extraction for preview

## Side Panel vs. Old Popup

| Feature | Side Panel | Old Popup |
|---------|-----------|----------|
| Stays visible | ✓ Yes | ✗ No |
| See page while editing | ✓ Yes | ✗ No |
| Live log display | ✓ Yes | ✗ No |
| Persistent history | ✓ Yes | ✗ No |
| Can browse while saving | ✓ Yes | ✗ No |

## Tips & Tricks

### Keeping the Panel Clean
- Click **Refresh** to clear old extraction
- Close and reopen the panel for a fresh start
- Logs auto-clear after 50 entries

### Testing Multiple Profiles
1. Open side panel
2. Navigate to profile 1 → click Refresh → review data
3. Navigate to profile 2 → click Refresh → review data
4. Save either profile with one click

### Debugging Extraction Issues
1. Open side panel on a profile
2. Check the log for errors
3. Open DevTools (F12) on the page
4. Follow CONFIG_TESTING.md to inspect the actual JSON
5. Update config and retry

### Performance
- Side panel loads ~100ms on cached configs
- XHR interception adds 500ms-2s for Instagram
- TikTok/YouTube instant (no network calls)

---

For detailed config testing, see CONFIG_TESTING.md
