# Game Installation Guide

Corpán supports two methods for installing games. Each has different benefits depending on your needs.

## Installation Methods

### 1. Web Play (manifest.json)

**Best for:** Development, testing, always having the latest version

**URL Format:**
```
https://corpora-inc.github.io/encorpora/corpan/games/hover-runner/manifest.json
```

**How it works:**
- Loads game files directly from the web each time you play
- No local storage required (beyond manifest metadata)
- Always gets the latest updates automatically
- Requires internet connection to play

**Pros:**
- ✅ Always up-to-date
- ✅ Minimal storage footprint
- ✅ Perfect for development/testing

**Cons:**
- ❌ Requires internet to play
- ❌ Subject to hosting availability

### 2. Offline Download (.zip)

**Best for:** Offline play, production use, bandwidth-conscious users

**URL Format:**
```
https://corpora-inc.github.io/encorpora/corpan/games/hover-runner.zip
```

**How it works:**
- Downloads complete game package (5-15 MB typically)
- Extracts and stores in app data directory
- Serves from local disk via `corpan-pack://` protocol
- Works 100% offline after installation

**Pros:**
- ✅ Works completely offline
- ✅ Faster load times (no network latency)
- ✅ Reliable (not subject to hosting issues)

**Cons:**
- ❌ Requires storage space
- ❌ Manual update needed for new versions
- ❌ Initial download required

## How to Install

### In the Corpán App

1. Open **Settings** (gear icon)
2. Scroll to **About** section
3. Tap the version number **7 times** to enable developer mode
4. A **"Games"** section will appear
5. Scroll to **"Install from URL"**
6. Paste either a `manifest.json` or `.zip` URL
7. Tap **"Install"**

### Developer Mode URLs

For Hover Runner:

**Web Play:**
```
https://corpora-inc.github.io/encorpora/corpan/games/hover-runner/manifest.json
```

**Offline:**
```
https://corpora-inc.github.io/encorpora/corpan/games/hover-runner.zip
```

## Technical Details

### Storage Locations

**Web Play games:**
- Manifest stored in: `localStorage` (< 1 KB)
- Game files: Not stored locally, loaded from web

**Offline games:**
- Installed to: `{app_data_dir}/corpan-packs/{game_id}/`
- Includes: `manifest.json`, `dist/app.js`, `dist/app.css`, etc.

### Protocol Handler

Offline games use the custom `corpan-pack://` protocol:

```
corpan-pack://localhost/hover_runner/manifest.json
  ↓ resolves to ↓
{app_data_dir}/corpan-packs/hover_runner/manifest.json
```

The protocol handler serves files directly from disk with zero network access.

### Manifest Resolution

The app intelligently handles both install types:

```typescript
// Web play - URLs resolve normally
"https://example.com/game/manifest.json"
  → Fetches from web on each load

// Offline - Special protocol
"corpan-pack://localhost/game_id/manifest.json"
  → Reads from local disk
```

## Creating Downloadable Games

### ZIP Structure

```
game-name.zip
├── manifest.json
└── dist/
    ├── app.js
    └── app.css
```

### Build Process

```bash
# Build the game
npm run build

# Create ZIP (from game directory)
zip -r game-name.zip manifest.json dist/

# Deploy both files
- /games/game-name/manifest.json (for web play)
- /games/game-name.zip (for offline download)
```

### Manifest Requirements

Both install methods require a valid `manifest.json`:

```json
{
  "id": "game_id",
  "name": "Game Name",
  "version": "1.0.0",
  "entry": "dist/app.js",
  "styles": ["dist/app.css"],
  "entryType": "script",
  "sdkVersion": "0.1.0"
}
```

**Note:** The `entry` and `styles` paths should include the `dist/` prefix. The game files are expected in a `dist/` subdirectory within the ZIP.

## Best Practices

### For Game Developers

- **Development**: Use web play for rapid iteration
- **Beta Testing**: Use offline downloads for reliability
- **Production**: Offer both options to users

### For End Users

- **Good Internet**: Web play is convenient and always updated
- **Limited/No Internet**: Offline downloads let you play anywhere
- **Storage Conscious**: Web play uses minimal storage

## Troubleshooting

### "Manifest not found" error

- Check the URL is accessible in a browser
- Verify the file is actually named `manifest.json`
- For web play: ensure HTTPS and CORS are configured

### "Pack hash mismatch" error

- The ZIP file was corrupted during download
- Try downloading again
- Check network connection

### Game won't load offline

- Verify it was installed using the `.zip` URL (not `manifest.json`)
- Check storage permissions
- Try reinstalling the game

## See Also

- [Content Packs Documentation](./src/contentPacks/README.md)
- [Production Setup Guide](./src/contentPacks/PRODUCTION_SETUP.md)
- [Game SDK Documentation](../games/sdk/README.md)
