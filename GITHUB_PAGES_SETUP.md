# GitHub Pages Setup

This document explains the new scalable structure for the GitHub Pages site.

## Site Structure

The GitHub Pages site is now organized with proper namespacing and landing pages at each level:

```
https://corpora-inc.github.io/encorpora/
├── index.html                    # Root landing page (all apps)
├── corpan/
│   ├── index.html                # Corpan landing page
│   └── games/
│       ├── index.html            # Games listing page
│       └── hover-runner/
│           ├── manifest.json     # Game manifest
│           ├── app.js            # Game code
│           ├── app.css           # Game styles
│           └── ...               # Other game assets
```

## How It Works

### 1. Landing Pages

Landing pages are built from templates in the `pages/` directory:

- **Root page** (`pages/templates/root.html`): Lists all apps
- **Corpan page** (`pages/templates/corpan.html`): Corpan app information
- **Games page** (`pages/templates/games.html`): Lists all Corpan games

### 2. Data Files

App and game metadata is stored in JSON files:

- `pages/data/apps.json`: App metadata (name, description, links, etc.)
- `pages/data/games.json`: Game metadata (name, version, manifest URL, etc.)

### 3. Build Script

The `pages/build.js` script generates static HTML files from templates and data:

```bash
node pages/build.js <output-directory>
```

### 4. GitHub Actions Workflow

The `.github/workflows/hover-runner-pages.yml` workflow:

1. Builds landing pages using `pages/build.js`
2. Builds each game (e.g., hover-runner)
3. Assembles everything into the proper directory structure
4. Deploys to GitHub Pages

## Adding a New Game

### Step 1: Add game metadata

Edit `pages/data/games.json` and add your game:

```json
{
  "id": "my-game",
  "name": "My Game",
  "description": "A fun language learning game",
  "icon": "🎮",
  "status": "beta",
  "version": "1.0.0",
  "manifestUrl": "./my-game/manifest.json",
  "playUrl": "./my-game/",
  "github": "https://github.com/corpora-inc/encorpora/tree/main/corpan/games/my-game"
}
```

### Step 2: Update GitHub Actions workflow

Edit `.github/workflows/hover-runner-pages.yml` to build your game:

```yaml
# Add to the build job
- name: Install My Game Dependencies
  working-directory: corpan/games/my-game
  run: npm install --legacy-peer-deps

- name: Build My Game
  working-directory: corpan/games/my-game
  run: npm run build

# Update the Assemble step
- name: Assemble Pages Artifact
  run: |
    # ... existing code ...

    # Copy my-game files
    cp corpan/games/my-game/manifest.json .pages/corpan/games/my-game/
    cp -R corpan/games/my-game/dist/. .pages/corpan/games/my-game/
```

### Step 3: Test locally

```bash
# Build landing pages
node pages/build.js /tmp/test-pages

# Build your game
cd corpan/games/my-game
npm run build

# Copy game to test pages
mkdir -p /tmp/test-pages/corpan/games/my-game
cp manifest.json /tmp/test-pages/corpan/games/my-game/
cp -R dist/* /tmp/test-pages/corpan/games/my-game/

# Serve locally to test
cd /tmp/test-pages
python -m http.server 8000
```

Open `http://localhost:8000` to preview.

## Adding a New App

### Step 1: Add app metadata

Edit `pages/data/apps.json`:

```json
{
  "id": "my-app",
  "name": "My App",
  "description": "An awesome new app",
  "icon": "✨",
  "status": "active",
  "links": {
    "homepage": "./my-app/",
    "github": "https://github.com/corpora-inc/encorpora/tree/main/my-app"
  }
}
```

### Step 2: Create landing page (optional)

If you want a dedicated landing page:

1. Create `pages/templates/my-app.html`
2. Update `pages/build.js` to generate the page
3. Update the GitHub Actions workflow to include your app's content

### Step 3: Commit and push

The workflow will automatically rebuild and deploy the site.

## Workflow Triggers

The workflow runs when:

- Changes are pushed to `main` branch in:
  - `corpan/games/**` (any game changes)
  - `pages/**` (landing page changes)
  - `.github/workflows/hover-runner-pages.yml` (workflow changes)
- Manually triggered via `workflow_dispatch`

## Local Development

### Prerequisites

- Node.js 20+
- Python 3 (for local server)

### Quick Start - Serve Entire Site Locally

The easiest way to test the entire site locally:

```bash
# From the repository root
./serve-local.sh
```

This script will:
1. Build all landing pages
2. Build hover-runner game
3. Assemble everything into `.local-pages/`
4. Start a local server at `http://localhost:8000`

You can then browse:
- `http://localhost:8000/` - Root landing page
- `http://localhost:8000/corpan/` - Corpan page
- `http://localhost:8000/corpan/games/` - Games listing
- `http://localhost:8000/corpan/games/hover-runner/` - Play hover-runner

### Manual Build Steps

If you want to build components separately:

#### Building landing pages only

```bash
cd pages
node build.js ../dist
```

#### Building hover-runner only

```bash
cd corpan/games/hover-runner
npm install --legacy-peer-deps
npm run build
```

#### Preview landing pages only

```bash
cd dist
python -m http.server 8000
# or
npx serve
```

## Troubleshooting

### Build fails with "Template not found"

- Check that all template files exist in `pages/templates/`
- Verify file names match what `build.js` expects

### Data not showing on pages

- Verify JSON files in `pages/data/` are valid JSON
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
