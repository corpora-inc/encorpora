# GitHub Pages Setup

This document explains the scalable composable architecture for the GitHub Pages site.

## Architecture

The GitHub Pages site uses a **composable architecture**:

1. **`web/io/` site** → Root marketing website (Next.js)
2. **`web/pages/` templates** → Corpan app pages (static HTML)
3. **`corpan/games/`** → Individual game builds
4. **Final deployment** → Everything composed into `web/io/out/`

This allows us to scale to many apps, games, and content types - all composed into one cohesive site.

## Site Structure

```
https://corpora-inc.github.io/encorpora/
├── index.html                    # web/io/ root site (Next.js export)
├── books.html                    # web/io/ books page
├── privacy.html                  # web/io/ privacy page
├── assets/                       # Corpan assets (logo, avatars)
│   ├── logo-512.png
│   └── hover-runner-avatar.png
├── corpan/
│   ├── index.html                # Corpan landing page (composed)
│   └── games/
│       ├── index.html            # Games listing (composed)
│       └── hover-runner/
│           ├── manifest.json     # Game manifest
│           └── ...               # Game assets
└── _next/                        # Next.js assets
```

## Base path support

The build supports both GitHub Pages (`/encorpora`) and a custom domain root by setting `ENCORPORA_BASE_PATH` at build time:

- GitHub Pages: `ENCORPORA_BASE_PATH=/encorpora`
- Custom domain: leave `ENCORPORA_BASE_PATH` empty

## How It Works

### 1. Root Site (`web/io/`)

The Next.js site at `web/io/` is the source of truth for the root domain:

- Marketing pages (index, books, privacy)
- Monochrome design system
- Builds to `web/io/out/` via `npm run build`

### 2. Corpan Pages (`web/pages/`)

Corpan-specific pages are built from templates:

- **Corpan landing** (`web/pages/templates/corpan.html`): App information with logo
- **Games listing** (`web/pages/templates/games.html`): All Corpan games

### 3. Data Files

Game metadata in `web/pages/data/games.json`:

```json
{
  "id": "hover-runner",
  "name": "Hover Runner",
  "version": "0.1.0",
  "manifestUrl": "./hover-runner/manifest.json"
}
```

### 3.1 Assets

Static assets are copied from canonical locations in the repo at build time (e.g., `corpan/corpan-app/src-tauri/icons/512x512.png` for the logo, and per-game avatar sources from `avatarSource`).

### 4. Games (`corpan/games/`)

Each game is a standalone build:

- Own build process (npm run build)
- Outputs to `dist/` directory
- Has manifest.json for metadata

### 5. Composition

The build process composes everything into `web/io/out/`:

```bash
# 1. Build web/io/ site
cd web/io && npm run build  # → web/io/out/

# 2. Add Corpan pages
node web/pages/build.js web/io/out  # → web/io/out/corpan/

# 3. Add games
cp -R corpan/games/hover-runner/dist web/io/out/corpan/games/hover-runner/

# 4. Deploy
# web/io/out/ is deployed to GitHub Pages
```

### 6. GitHub Actions Workflow

The `.github/workflows/hover-runner-pages.yml` workflow automates this:

1. Builds `web/io/` site (Next.js) → `web/io/out/`
2. Builds Corpan pages into `web/io/out/corpan/`
3. Builds each game and copies to `web/io/out/corpan/games/`
4. Deploys `web/io/out/` to GitHub Pages

## Adding a New Game

### Step 1: Create game in `corpan/games/my-game/`

Build your game with the Corpan Game SDK. Ensure it has:
- `manifest.json` with game metadata
- Build script (`npm run build`) that outputs to `dist/`

### Step 2: Add to games data

Edit `web/pages/data/games.json`:

```json
{
  "id": "my-game",
  "name": "My Game",
  "description": "A fun language learning game",
  "status": "beta",
  "version": "1.0.0",
  "manifestUrl": "./my-game/manifest.json",
  "avatarSource": "corpan/games/my-game/my-game-avatar.png",
  "playUrl": "./my-game/",
  "github": "https://github.com/corpora-inc/encorpora/tree/main/corpan/games/my-game"
}
```

### Step 3: (Optional) Add game avatar

Point `avatarSource` at the canonical asset in the repo. The build copies it into `assets/` at publish time.

### Step 4: Update GitHub Actions workflow

Edit `.github/workflows/hover-runner-pages.yml`:

```yaml
- name: Install My Game Dependencies
  working-directory: corpan/games/my-game
  run: npm install --legacy-peer-deps

- name: Build My Game
  working-directory: corpan/games/my-game
  run: npm run build

- name: Copy My Game into web/io/out
  run: |
    mkdir -p web/io/out/corpan/games/my-game
    cp corpan/games/my-game/manifest.json web/io/out/corpan/games/my-game/
    cp -R corpan/games/my-game/dist/. web/io/out/corpan/games/my-game/
```

### Step 5: Test locally

```bash
./web/scripts/serve-local.sh
```

Open `http://localhost:8000/corpan/games/my-game/` to preview.

## Adding a New App

Adding a new app follows the same composable pattern as Corpan:

### Step 1: Create app pages

Create templates in `web/pages/templates/my-app/`:

```
web/pages/templates/my-app/
├── index.html      # Landing page
└── features.html   # Additional pages
```

Use the same monochrome design system as Corpan pages.

### Step 2: Update build script

Edit `web/pages/build.js` to build your app pages into the output directory:

```javascript
// Build My App pages
console.log('Building my-app pages...');
const myAppTemplate = readTemplate('my-app/index');
fs.writeFileSync(path.join(outputDir, 'my-app', 'index.html'), myAppTemplate);
```

### Step 3: Update workflow

Add build steps to `.github/workflows/hover-runner-pages.yml` to compose your app into `web/io/out/`.

### Step 4: (Optional) Link from web/io/ site

Add a link or section in `web/io/app/page.tsx` to feature your new app.

## Workflow Triggers

The workflow runs when:

- Changes are pushed to `main` branch in:
  - `web/io/**` (root site changes)
  - `corpan/games/**` (any game changes)
  - `web/pages/**` (Corpan page changes)
  - `.github/workflows/hover-runner-pages.yml` (workflow changes)
- Manually triggered via `workflow_dispatch`

## Local Development

### Prerequisites

- Node.js 20+
- Python 3 (for local server)

### Quick Start - Serve Complete Site

The `web/scripts/serve-local.sh` script builds and serves the complete composed site:

```bash
./web/scripts/serve-local.sh
```

This will:
1. Build `web/io/` site (Next.js) → `web/io/out/`
2. Build Corpan pages into `web/io/out/corpan/`
3. Build hover-runner into `web/io/out/corpan/games/hover-runner/`
4. Start server at `http://localhost:8000`

Browse:
- `http://localhost:8000/` - web/io/ root site
- `http://localhost:8000/corpan/` - Corpan page
- `http://localhost:8000/corpan/games/` - Games listing
- `http://localhost:8000/corpan/games/hover-runner/` - Play hover-runner

### Manual Build Steps

Build individual components:

#### web/io/ site only

```bash
cd web/io
npm install
npm run build  # → web/io/out/
```

#### Corpan pages only

```bash
node web/pages/build.js /some/output/dir
```

#### Individual game

```bash
cd corpan/games/hover-runner
npm install --legacy-peer-deps
npm run build  # → dist/
```

## Troubleshooting

### Build fails with "Template not found"

- Check that all template files exist in `web/pages/templates/`
- Verify file names match what `build.js` expects

### Data not showing on pages

- Verify JSON files in `web/pages/data/` are valid JSON
- Check browser console for JavaScript errors
- Ensure placeholder `{{GAMES_DATA}}` or `{{APPS_DATA}}` exists in template

### Game not loading

- Verify manifest.json is copied to correct location
- Check that game paths in `games.json` match actual deployment
- Use browser DevTools Network tab to debug missing assets

## Future Improvements

Potential enhancements:

1. **Static site generator**: Migrate to Astro or 11ty for more features
2. **Search functionality**: Add search across games
3. **Filtering/sorting**: Filter games by status, category, etc.
4. **Analytics**: Add usage tracking
5. **CI/CD improvements**: Parallel builds, caching, etc.
