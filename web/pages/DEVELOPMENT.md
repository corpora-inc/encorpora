# Corpán Pages Development Guide

This document explains how to develop the Corpán pages website (GitHub Pages) locally with live reloading.

## Quick Start

### Prerequisites

- Node.js 20+
- npm

### Install Dependencies

```bash
# Root dependencies (dev orchestration)
npm install

# web/io/ site dependencies
cd web/io && npm install && cd ../..

# Game dependencies
cd corpan/packs/hover-runner && npm install --legacy-peer-deps && cd ../../..
cd corpan/packs/juice-squeeze && npm install && cd ../../..
```

### Development Mode

Run everything with live reloading:

```bash
npm run dev
```

This starts:
- **web/io/** - Next.js dev server (port 3000) with hot reload
- **web/pages/** - Watcher that rebuilds Corpan pages on change
- **packs/** - Vite watch build for hover-runner + juice-squeeze
- **watch-packs** - Copies pack builds to web/io/out
- **serve** - Dev proxy server (port 8000) that composes everything

Open **http://localhost:8000** and you'll see:
- `/` → Next.js dev server (hot reload)
- `/corpan` → Auto-rebuilt Corpan pages
- `/corpan/packs/hover-runner` → Auto-rebuilt pack
- `/corpan/packs/juice-squeeze` → Auto-rebuilt pack
- `/assets` → Static assets

### What Gets Auto-Rebuilt

| Path | Source | Trigger |
|------|--------|---------|
| `/` | `web/io/` | Any file change in web/io/ (Next.js hot reload) |
| `/corpan` | `web/pages/` | Template or data changes |
| `/corpan/packs/hover-runner` | `corpan/packs/hover-runner/` | Source file changes |
| `/corpan/packs/juice-squeeze` | `corpan/packs/juice-squeeze/` | Source file changes |
| `/assets` | `corpan/**` (canonical assets) | Avatar or logo updates |

## Architecture

### Composable Build System

```
web/io/                    → Next.js site (root)
web/pages/                 → Corpan page templates
corpan/packs/*/        → Individual pack builds
         ↓
    Composed into
         ↓
    web/io/out/            → Complete site
```

### Dev Mode Flow

1. **Next.js dev server** runs on port 3000 (memory, hot reload)
2. **web/pages/watch.js** watches templates → rebuilds to `web/io/out/corpan/`
3. **Vite watch** rebuilds packs → `corpan/packs/*/dist/`
4. **web/scripts/watch-packs.js** copies pack builds → `web/io/out/corpan/packs/`
5. **web/scripts/dev-server.js** (port 8000) proxies:
   - `/` → Next.js (port 3000)
   - `/corpan`, `/assets` → Static files from `web/io/out/`

## Development Commands

```bash
# Start everything with watchers
npm run dev

# Build everything for production
npm run build

# Clean all build artifacts
npm run clean

# Serve production build
npm run serve
```

## Individual Component Development

### Work on web/io/ site only

```bash
cd web/io
npm run dev
# Visit http://localhost:3000
```

### Work on Corpan pages only

```bash
# Terminal 1: Watch and rebuild
node web/pages/watch.js

# Terminal 2: Serve
cd web/io/out && python3 -m http.server 8000
```

### Work on a pack only

```bash
cd corpan/packs/hover-runner

# Option 1: Vite dev server (hot reload)
npm run dev  # Visit http://localhost:5173

# Option 2: Watch build
npm run dev:watch  # Builds to dist/ on change
```

```bash
cd corpan/packs/juice-squeeze

# Option 1: Vite dev server (hot reload)
npm run dev  # Visit http://localhost:5173

# Option 2: Watch build
npm run dev:watch  # Builds to dist/ on change
```

## Adding a New Game

1. Create pack in `corpan/packs/my-pack/`
2. Add `dev:watch` script to the pack's `package.json`
3. Update root `package.json`:
   - Add to `dev:packs` (or create separate dev:my-pack)
   - Update `web/scripts/watch-packs.js` to watch new pack
   - Update `build:packs` to build new pack
4. Add metadata to `web/pages/data/packs.json` (set `listed: false` for shadow launches)
5. (Optional) Add `avatarSource` in `web/pages/data/packs.json`

## Troubleshooting

### Port already in use

```bash
# Find and kill process on port 8000
lsof -ti:8000 | xargs kill

# Or use different port
PORT=8001 npm run dev
```

### Builds not updating

```bash
# Clean and restart
npm run clean
npm run dev
```

Check the console output for watcher status:
- `[pages] ✓ Watchers ready` - pages watcher is working
- `[watch-packs] ✓ Watchers ready` - pack watcher is working
- Look for "Changed:", "Added:", or "Removed:" messages when editing files

### Next.js not proxying correctly

Check that Next.js is running on port 3000:
```bash
curl http://localhost:3000
```

### Game not appearing

1. Check pack built to `dist/`: `ls corpan/packs/hover-runner/dist/`
2. Check copied to output: `ls web/io/out/corpan/packs/hover-runner/`
3. Check manifest exists: `cat web/io/out/corpan/packs/hover-runner/manifest.json`
4. For other packs, swap the pack name in the paths above.

## Production Build

```bash
# Build everything
npm run build

# Verify output
ls -la web/io/out/corpan/packs/

# Test production build locally
npm run serve
# Visit http://localhost:8000
```

## File Watching Behavior

- **web/io/**: Next.js handles watching and hot reload
- **web/pages/**: Chokidar watches `templates/`, `data/`, and canonical asset sources (via `web/pages/watch.js`)
- **packs/**: Vite watches source files, builds to `dist/`
- **watch-packs**: Chokidar watches `dist/` and `manifest.json`, copies to `web/io/out/` (via `web/scripts/watch-packs.js`)

This multi-layer watching ensures:
- Fast rebuilds (only affected parts rebuild)
- No unnecessary copying
- Clean separation of concerns

## Directory Structure

```
web/pages/
├── templates/           # HTML templates with placeholders
│   ├── corpan.html     # /corpan landing page
│   ├── packs.html      # /corpan/packs listing
│   └── game-landing.html # Individual pack landing pages
├── data/               # JSON data files
│   └── packs.json      # Pack metadata
├── build.js            # Build script (composable)
├── watch.js            # File watcher for dev mode
└── DEVELOPMENT.md      # This file
```

## How Templates Work

Templates use `{{PLACEHOLDER}}` syntax:

**corpan.html**: No placeholders, static landing page

**packs.html**:
- `{{PACKS_DATA}}` - Replaced with JSON array from `data/packs.json`

**game-landing.html**:
- `{{GAME_ID}}` - Game identifier
- `{{GAME_NAME}}` - Display name
- `{{GAME_DESCRIPTION}}` - Short description
- `{{GAME_VERSION}}` - Version string
- `{{GAME_AVATAR}}` - Path to avatar image
- `{{VIDEO_SECTION}}` - Generated HTML with YouTube embeds

Build script (`build.js`) reads templates, replaces placeholders, and writes to `web/io/out/corpan/`.
