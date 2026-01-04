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

# io/ site dependencies
cd io && npm install && cd ..

# Game dependencies
cd corpan/games/hover-runner && npm install --legacy-peer-deps && cd ../../..
```

### Development Mode

Run everything with live reloading:

```bash
npm run dev
```

This starts:
- **io/** - Next.js dev server (port 3000) with hot reload
- **pages/** - Watcher that rebuilds Corpan pages on change
- **games/** - Vite watch build for hover-runner
- **watch-games** - Copies game builds to io/out
- **serve** - Dev proxy server (port 8000) that composes everything

Open **http://localhost:8000** and you'll see:
- `/` → Next.js dev server (hot reload)
- `/corpan` → Auto-rebuilt Corpan pages
- `/corpan/games/hover-runner` → Auto-rebuilt game
- `/assets` → Static assets

### What Gets Auto-Rebuilt

| Path | Source | Trigger |
|------|--------|---------|
| `/` | `io/` | Any file change in io/ (Next.js hot reload) |
| `/corpan` | `pages/` | Template or data changes |
| `/corpan/games/hover-runner` | `corpan/games/hover-runner/` | Source file changes |
| `/assets` | `pages/assets/` | Asset changes |

## Architecture

### Composable Build System

```
io/                    → Next.js site (root)
pages/                 → Corpan page templates
corpan/games/*/        → Individual game builds
         ↓
    Composed into
         ↓
    io/out/            → Complete site
```

### Dev Mode Flow

1. **Next.js dev server** runs on port 3000 (memory, hot reload)
2. **pages/watch.js** watches templates → rebuilds to `io/out/corpan/`
3. **Vite watch** rebuilds games → `corpan/games/*/dist/`
4. **scripts/watch-games.js** copies game builds → `io/out/corpan/games/`
5. **scripts/dev-server.js** (port 8000) proxies:
   - `/` → Next.js (port 3000)
   - `/corpan`, `/assets` → Static files from `io/out/`

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

### Work on io/ site only

```bash
cd io
npm run dev
# Visit http://localhost:3000
```

### Work on Corpan pages only

```bash
# Terminal 1: Watch and rebuild
node pages/watch.js

# Terminal 2: Serve
cd io/out && python3 -m http.server 8000
```

### Work on hover-runner game only

```bash
cd corpan/games/hover-runner

# Option 1: Vite dev server (hot reload)
npm run dev  # Visit http://localhost:5173

# Option 2: Watch build
npm run dev:watch  # Builds to dist/ on change
```

## Adding a New Game

1. Create game in `corpan/games/my-game/`
2. Add `dev:watch` script to game's `package.json`
3. Update root `package.json`:
   - Add to `dev:games` (or create separate dev:my-game)
   - Update `scripts/watch-games.js` to watch new game
   - Update `build:games` to build new game
4. Add metadata to `pages/data/games.json`
5. Optionally add avatar to `pages/assets/`

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
- `[watch-games] ✓ Watchers ready` - game watcher is working
- Look for "Changed:", "Added:", or "Removed:" messages when editing files

### Next.js not proxying correctly

Check that Next.js is running on port 3000:
```bash
curl http://localhost:3000
```

### Game not appearing

1. Check game built to `dist/`: `ls corpan/games/hover-runner/dist/`
2. Check copied to output: `ls io/out/corpan/games/hover-runner/`
3. Check manifest exists: `cat io/out/corpan/games/hover-runner/manifest.json`

## Production Build

```bash
# Build everything
npm run build

# Verify output
ls -la io/out/corpan/games/

# Test production build locally
npm run serve
# Visit http://localhost:8000
```

## File Watching Behavior

- **io/**: Next.js handles watching and hot reload
- **pages/**: Chokidar watches `templates/`, `data/`, `assets/` (via `pages/watch.js`)
- **games/**: Vite watches source files, builds to `dist/`
- **watch-games**: Chokidar watches `dist/` and `manifest.json`, copies to `io/out/` (via `scripts/watch-games.js`)

This multi-layer watching ensures:
- Fast rebuilds (only affected parts rebuild)
- No unnecessary copying
- Clean separation of concerns

## Directory Structure

```
pages/
├── templates/           # HTML templates with placeholders
│   ├── corpan.html     # /corpan landing page
│   ├── games.html      # /corpan/games listing
│   └── game-landing.html # Individual game landing pages
├── data/               # JSON data files
│   └── games.json      # Game metadata
├── assets/             # Static assets (images, etc.)
│   ├── logo-512.png
│   └── hover-runner-avatar.png
├── build.js            # Build script (composable)
├── watch.js            # File watcher for dev mode
└── DEVELOPMENT.md      # This file
```

## How Templates Work

Templates use `{{PLACEHOLDER}}` syntax:

**corpan.html**: No placeholders, static landing page

**games.html**:
- `{{GAMES_DATA}}` - Replaced with JSON array from `data/games.json`

**game-landing.html**:
- `{{GAME_ID}}` - Game identifier
- `{{GAME_NAME}}` - Display name
- `{{GAME_DESCRIPTION}}` - Short description
- `{{GAME_VERSION}}` - Version string
- `{{GAME_AVATAR}}` - Path to avatar image
- `{{VIDEO_SECTION}}` - Generated HTML with YouTube embeds

Build script (`build.js`) reads templates, replaces placeholders, and writes to `io/out/corpan/`.
