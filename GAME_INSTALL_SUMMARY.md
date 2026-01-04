# Game Installation - Summary of Changes

## Overview

Corpán now supports **two installation methods** for games, each serving different use cases. Both methods are fully documented and integrated into the UI.

## Installation Methods

### 1. Web Play (`manifest.json`)
- **URL**: `https://corpora-inc.github.io/encorpora/corpan/games/hover-runner/manifest.json`
- **Use case**: Development, testing, always getting latest version
- **Storage**: Minimal (manifest only)
- **Internet**: Required to play
- **Updates**: Automatic (loads fresh each time)

### 2. Offline Download (`.zip`)
- **URL**: `https://corpora-inc.github.io/encorpora/corpan/games/hover-runner.zip`
- **Use case**: Production, offline play, reliability
- **Storage**: 5-15 MB per game
- **Internet**: Only needed for initial download
- **Updates**: Manual reinstall required

## Changes Made

### 1. Build System ✅
**Files:** `package.json`, `.github/workflows/hover-runner-pages.yml`

- Added ZIP packaging step to build process
- ZIP deployed alongside web files
- Structure: `manifest.json` + `dist/` folder

### 2. Corpán App UI ✅
**File:** `corpan/corpan-app/src/components/GamesPanel.tsx`

- Updated developer install section
- Clarifies both URL types work
- Shows differences between methods

### 3. GitHub Pages ✅
**File:** `web/pages/templates/game-landing.html`

- Added "Developer Install" section
- Two copy-paste buttons (one for each method)
- Clear badges: "Always Latest" vs "Works Offline"
- JavaScript copy-to-clipboard functionality

### 4. Documentation ✅
**File:** `corpan/corpan-app/GAME_INSTALLATION.md`

- Complete guide for both methods
- Technical details (protocols, storage)
- Best practices for developers and users
- Troubleshooting section

## URLs Deployed to GitHub Pages

After merging to `main`, these URLs will be available:

```
# Game landing page
https://corpora-inc.github.io/encorpora/corpan/games/hover-runner/

# Web play (manifest)
https://corpora-inc.github.io/encorpora/corpan/games/hover-runner/manifest.json

# Offline download (ZIP)
https://corpora-inc.github.io/encorpora/corpan/games/hover-runner.zip

# Web play game files
https://corpora-inc.github.io/encorpora/corpan/games/hover-runner/dist/app.js
https://corpora-inc.github.io/encorpora/corpan/games/hover-runner/dist/app.css
```

## How Users Install Games

### Enable Developer Mode
1. Open Corpán app
2. Go to Settings
3. Scroll to version number
4. Tap version **7 times**
5. "Games" section appears

### Install a Game
1. Go to Settings → Games
2. Scroll to "Install from URL"
3. Copy URL from game landing page (either method)
4. Paste into input field
5. Tap "Install"

### Play the Game
- Web play: Loads from network each time
- Offline: Loads from disk via `corpan-pack://` protocol

## Technical Implementation

### Offline Game Storage
```
{app_data_dir}/corpan-packs/
└── hover_runner/
    ├── manifest.json
    └── dist/
        ├── app.js (14 MB)
        └── app.css (12 KB)
```

### Protocol Handler
```rust
// Custom protocol serves local files
corpan-pack://localhost/hover_runner/manifest.json
  ↓
{app_data_dir}/corpan-packs/hover_runner/manifest.json
```

### Install Detection
The `installPack()` function automatically detects URL type:

```typescript
// Detects .zip extension → downloads and extracts
installPack({ manifestUrl: "...hover-runner.zip", source: "manual" })

// Detects .json or no extension → web play
installPack({ manifestUrl: "...manifest.json", source: "manual" })
```

## Testing

### Local Testing
```bash
# Build everything
export ENCORPORA_BASE_PATH=/encorpora
npm run build

# Check outputs
ls web/io/out/corpan/games/hover-runner.zip  # ZIP exists ✅
cat web/io/out/corpan/games/hover-runner/manifest.json  # Manifest ✅
open web/io/out/corpan/games/hover-runner/index.html  # Landing page ✅
```

### Production Testing (after deploy)
1. Visit: https://corpora-inc.github.io/encorpora/corpan/games/hover-runner/
2. Click "Copy" on Web Play URL
3. Paste into Corpán app
4. Verify installation works
5. Repeat for Offline Download URL

## Next Steps

1. **Merge to main** - Deploys ZIP and updated pages
2. **Test both install methods** in production
3. **Add more games** following same pattern
4. **Consider catalog** - Auto-discovery of available games

## Benefits

✅ **Flexibility**: Users choose their preferred method
✅ **Offline support**: No internet required after download
✅ **Developer friendly**: Easy testing with web play
✅ **Well documented**: Clear guidance in app and docs
✅ **Future proof**: Scalable to many games

## Files Modified

```
.github/workflows/hover-runner-pages.yml  # Add ZIP build
package.json                               # Add package:games script
corpan/corpan-app/src/components/GamesPanel.tsx  # Update UI
web/pages/templates/game-landing.html     # Add install section
corpan/corpan-app/GAME_INSTALLATION.md    # New documentation
```

All changes maintain backward compatibility while adding the new offline capability.
