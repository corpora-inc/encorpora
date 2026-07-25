# Encorpora Development Guide

This monorepo contains Corpora Inc's products and everything they ship on: the
Corpán language-learning app, the Dynawalla mathematics app, the pack system, the
content pipeline, and the site.

Development is trunk-based. Read [AGENTS.md](AGENTS.md) before you open a PR.

## Repository Structure

```
encorpora/
├── corpan/              # Corpán — language learning (Tauri + React)
│   ├── corpan-app/      # Main application
│   │   ├── src/         # React frontend
│   │   └── src-tauri/   # Rust backend
│   ├── packs/           # Pluggable language learning packs
│   │   ├── sdk/         # Pack development SDK
│   │   └── hover-runner/ # Reference pack
│   ├── plugins/         # Tauri/Rust plugin crates (shared with Dynawalla)
│   └── dja/             # Django content management system
│       ├── cor/         # Core models (Entry, Translation, Pack)
│       └── db.sqlite3   # Development database
│
├── dynawalla/           # Dynawalla: Apprentice of Numbers — children's maths (new)
│
├── web/io/                  # Marketing website (Next.js)
│   └── out/             # Built static site
│
├── web/pages/               # Corpán pages for GitHub Pages
│   ├── templates/       # HTML templates
│   ├── data/           # JSON data
│   └── assets/         # Static assets
│
└── web/scripts/            # Dev tooling for Pages site
    ├── dev-server.js   # Development proxy server
    └── watch-packs.js  # Pack build watcher
```

## Projects

### 1. Corpán App (`corpan/corpan-app/`)

Cross-platform language learning application built with Tauri (Rust + React).

**Tech Stack:**
- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Tauri (Rust) for native capabilities
- State: Zustand
- Database: Embedded SQLite

**Development:**
```bash
cd corpan/corpan-app

# Type check
npm run tsc

# Dev mode (React only)
npm run dev

# Full Tauri dev (with Rust backend)
npm run tauri dev

# Build for platform
npm run tauri build
```

See `corpan/CLAUDE.md` for detailed app development guide.

### 2. Django CMS (`corpan/dja/`)

Content management system for creating language learning content.

**Tech Stack:**
- Django 5+
- SQLite database
- Python 3.11+

**Development:**
```bash
cd corpan/dja

# Run dev server
python manage.py runserver

# Create migrations
python manage.py makemigrations
python manage.py migrate

# Access admin (requires superuser)
python manage.py createsuperuser

# Generate production database
python make_release_sqlite.py
```

**Key Models:**
- **Language**: Language codes (es, ko, etc.)
- **Domain**: Content categories
- **Entry**: English text with CEFR level
- **Translation**: Language-specific translations
- **Pack**: Ordered collections of entries
- **Narrator**: TTS voice metadata

### 3. Marketing Site (`web/io/`)

Next.js-based marketing website.

**Tech Stack:**
- Next.js 15+
- React
- TypeScript
- Tailwind CSS

**Development:**
```bash
cd web/io

# Dev mode
npm run dev  # Visit http://localhost:3000

# Build
npm run build  # Outputs to web/io/out/
```

### 4. Corpán Pages (`web/pages/`)

Static promotional pages for GitHub Pages deployment.

**Tech Stack:**
- Static HTML templates
- Node.js build scripts
- Chokidar for file watching

**Development:**
```bash
# From root:
npm run dev  # Starts full composed dev environment

# Or just pages:
node web/pages/watch.js
```

See `web/pages/DEVELOPMENT.md` for detailed Pages development guide.

### 5. Games (`corpan/packs/`)

Standalone language learning packs that integrate with the Corpán app.

**SDK:** `corpan/packs/sdk/`
**Reference Game:** `corpan/packs/hover-runner/`

**Development:**
```bash
cd corpan/packs/hover-runner

# Vite dev server
npm run dev  # Visit http://localhost:5173

# Watch build
npm run dev:watch
```

See `corpan/packs/sdk/README.md` for pack development guide.

## Common Development Workflows

### Working on the Corpán App

```bash
cd corpan/corpan-app
npm run tsc  # Type check
npm run tauri dev  # Run with hot reload
```

### Adding Content

```bash
cd corpan/dja
python manage.py runserver
# Use admin at http://localhost:8000/admin
# Create Entries, Translations, Packs
python make_release_sqlite.py
# Copy release.sqlite3 to app
```

### Developing Pages Site

```bash
# From root - runs everything with watchers
npm run dev
# Visit http://localhost:8000

# See web/pages/DEVELOPMENT.md for details
```

### Creating a New Game

```bash
# 1. Copy SDK to new pack directory
cp -r corpan/packs/sdk corpan/packs/my-pack

# 2. Implement pack logic
cd corpan/packs/my-pack
# Edit src/ files

# 3. Add to web/pages/data/packs.json
# 4. Update web/scripts/watch-packs.js
```

## Build & Deployment

### Build Everything

```bash
# From root - builds entire site
npm run build
```

This builds:
1. Next.js site → `web/io/out/`
2. Corpán pages → `web/io/out/corpan/`
3. Games → `web/io/out/corpan/packs/`

### Deploy to GitHub Pages

GitHub Actions automatically deploys on push to `main`:
- Workflow: `.github/workflows/deploy-pages.yml`
- Triggers: changes to `web/io/`, `web/pages/`, `corpan/packs/`, or the workflow
- Output: `https://encorpora.io/`

A merge to `main` **is** the deploy. Nobody uploads pack zips by hand.

### Build Corpán App

```bash
cd corpan/corpan-app

# iOS
npm run tauri ios build

# Android
npm run tauri android build

# Desktop
npm run tauri build
```

## Development Dependencies

### Root Level

```bash
npm install  # Installs concurrently, chokidar, wait-on
```

### Project Specific

```bash
# web/io/ site
cd web/io && npm install

# corpan-app
cd corpan/corpan-app && npm install

# Games
cd corpan/packs/hover-runner && npm install --legacy-peer-deps
```

## Troubleshooting

### Port Conflicts

```bash
# Kill process on port
lsof -ti:8000 | xargs kill

# Or use different port
PORT=8001 npm run dev
```

### Clean Build Artifacts

```bash
# Pages site
npm run clean  # Removes web/io/out, web/io/.next

# Corpán app
cd corpan/corpan-app
rm -rf dist/
rm -rf src-tauri/target/
```

### Watchers Not Working

Check console output for:
- `[pages] ✓ Watchers ready`
- `[watch-packs] ✓ Watchers ready`
- `[io] ready started server on 0.0.0.0:3000`

If watchers aren't triggering:
```bash
# Kill and restart
pkill -f "node.*watch"
npm run dev
```

## Documentation

- **This file**: Overview of entire monorepo
- **web/pages/DEVELOPMENT.md**: Pages site development
- **corpan/CLAUDE.md**: Corpán app development
- **corpan/packs/sdk/README.md**: Game development
- **corpan/dja/README.md**: Django CMS (if exists)

## Architecture Notes

### Data Flow

1. **Content Creation**: Django admin manages language data
2. **Database Generation**: `make_release_sqlite.py` creates production DB
3. **App Bundling**: SQLite embedded in Tauri app
4. **Runtime**: Rust queries SQLite → returns to React

### Pages Composition

1. **web/io/**: Next.js marketing site (root)
2. **web/pages/**: Static Corpán pages compose into `web/io/out/corpan/`
3. **packs/**: Pack builds compose into `web/io/out/corpan/packs/`
4. **Result**: Single unified site at `web/io/out/`

### Game System

- Games built with SDK
- Manifest defines entry point and metadata
- Host provides API for corpus access and TTS
- Native delivery via downloadable content packs

## Getting Started

1. **Clone the repo**
   ```bash
   git clone https://github.com/corpora-inc/encorpora.git
   cd encorpora
   ```

2. **Choose your project:**
   - **App development**: Go to `corpan/corpan-app/`
   - **Content management**: Go to `corpan/dja/`
   - **Website**: Run `npm install && npm run dev` from root
   - **Game development**: Go to `corpan/packs/`

3. **Follow project-specific docs** in their directories

## Contributing

- **App development**: See `corpan/CLAUDE.md`
- **Pages site**: See `web/pages/DEVELOPMENT.md`
- **Games**: See `corpan/packs/sdk/README.md`

## Platform-Specific Notes

### iOS

- Content packs downloaded to app data directory
- Requires Xcode for building
- See `corpan/corpan-app/src-tauri/ios/`

### Android

- Upload keystore: `corpan/corpan-app/src-tauri/upload-keystore.jks`
- Requires Android Studio for building
- See `corpan/corpan-app/src-tauri/android/`

### Web (Pages)

- Static deployment via GitHub Pages
- Promotional pages only (packs require app for full functionality)
- Automatic deployment via GitHub Actions
