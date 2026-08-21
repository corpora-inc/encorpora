# GitHub Pages Setup

This document explains the scalable composable architecture for the GitHub Pages site.

## Architecture

The GitHub Pages site uses a **composable architecture**:

1. **`web/io/` site** → Root marketing website (Next.js)
2. **`web/pages/` templates** → Corpan app pages (static HTML)
3. **`corpan/packs/`** → Individual pack builds
4. **Final deployment** → Everything composed into `web/io/out/`

This allows us to scale to many apps, packs, and content types - all composed into one cohesive site.

## Site Structure

```
https://encorpora.io/
├── index.html                    # web/io/ root site (Next.js export)
├── books.html                    # web/io/ books page
├── privacy.html                  # web/io/ privacy page
├── assets/                       # Corpan assets (logo, avatars)
│   ├── logo-512.png
│   └── hover-runner-avatar.png
├── corpan/
│   ├── index.html                # Corpan landing page (composed)
│   └── packs/
│       ├── index.html            # Packs listing (composed)
│       └── hover-runner/
│           ├── manifest.json     # Pack manifest
│           └── ...               # Pack assets
└── _next/                        # Next.js assets
```

## Base path

The site is served from the domain root, so all assets and links assume `/`.

## How It Works

### 1. Root Site (`web/io/`)

The Next.js site at `web/io/` is the source of truth for the root domain:

- Marketing pages (index, books, privacy)
- Monochrome design system
- Builds to `web/io/out/` via `npm run build`

### 2. Corpan Pages (`web/pages/`)

Corpan-specific pages are built from templates:

- **Corpan landing** (`web/pages/templates/corpan.html`): App information with logo
- **Packs listing** (`web/pages/templates/packs.html`): All Corpan packs

### 3. Data Files

Pack metadata in `web/pages/data/packs.json`:

```json
{
  "id": "hover-runner",
  "name": "Hover Runner",
  "version": "0.1.0",
  "manifestUrl": "./hover-runner/manifest.json"
}
```

### 3.1 Assets

Static assets are copied from canonical locations in the repo at build time (e.g., `corpan/corpan-app/src-tauri/icons/512x512.png` for the logo, and per-pack avatar sources from `avatarSource`).

### 4. Packs (`corpan/packs/`)

Each pack is a standalone build:

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

# 3. Add packs
cp -R corpan/packs/hover-runner/dist web/io/out/corpan/packs/hover-runner/

# 4. Deploy
# web/io/out/ is deployed to GitHub Pages
```

### 6. GitHub Actions Workflow

The `.github/workflows/deploy-pages.yml` workflow automates this:

1. Builds `web/io/` site (Next.js) → `web/io/out/`
2. Builds Corpan pages into `web/io/out/corpan/`
3. Builds each pack and copies to `web/io/out/corpan/packs/`
4. Deploys `web/io/out/` to GitHub Pages

## Adding a New Pack

### Step 1: Create pack in `corpan/packs/my-pack/`

Build your pack with the Corpan Pack SDK. Ensure it has:
- `manifest.json` with pack metadata
- Build script (`npm run build`) that outputs to `dist/`

### Step 2: Add to packs data

Edit `web/pages/data/packs.json`:

```json
{
  "id": "my-pack",
  "name": "My Pack",
  "description": "A fun language learning pack",
  "status": "beta",
  "version": "1.0.0",
  "manifestUrl": "./my-pack/manifest.json",
  "avatarSource": "corpan/packs/my-pack/my-pack-avatar.png",
  "landingUrl": "./my-pack/",
  "github": "https://github.com/corpora-inc/encorpora/tree/main/corpan/packs/my-pack"
}
```

### Step 3: (Optional) Add pack avatar

Point `avatarSource` at the canonical asset in the repo. The build copies it into `assets/` at publish time.

### Step 4: Update GitHub Actions workflow

Edit `.github/workflows/deploy-pages.yml`:

```yaml
- name: Install My Pack Dependencies
  working-directory: corpan/packs/my-pack
  run: npm install --legacy-peer-deps

- name: Build My Pack
  working-directory: corpan/packs/my-pack
  run: npm run build

- name: Copy My Pack into web/io/out
  run: |
    mkdir -p web/io/out/corpan/packs/my-pack
    cp corpan/packs/my-pack/manifest.json web/io/out/corpan/packs/my-pack/
    cp -R corpan/packs/my-pack/dist/. web/io/out/corpan/packs/my-pack/
```

### Step 5: Test locally

```bash
./web/scripts/serve-local.sh
```

Open `http://localhost:8000/corpan/packs/my-pack/` to preview.

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

Add build steps to `.github/workflows/deploy-pages.yml` to compose your app into `web/io/out/`.

### Step 4: (Optional) Link from web/io/ site

Add a link or section in `web/io/app/page.tsx` to feature your new app.

## Workflow Triggers

The workflow runs when:

- Changes are pushed to `main` branch in:
  - `web/io/**` (root site changes)
  - `corpan/packs/**` (any pack changes)
  - `web/pages/**` (Corpan page changes)
  - `.github/workflows/deploy-pages.yml` (workflow changes)
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
3. Build hover-runner into `web/io/out/corpan/packs/hover-runner/`
4. Start server at `http://localhost:8000`

Browse:
- `http://localhost:8000/` - web/io/ root site
- `http://localhost:8000/corpan/` - Corpan page
- `http://localhost:8000/corpan/packs/` - Packs listing
- `http://localhost:8000/corpan/packs/hover-runner/` - Play hover-runner

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

#### Individual pack

```bash
cd corpan/packs/hover-runner
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

### Pack not loading

- Verify manifest.json is copied to correct location
- Check that pack paths in `packs.json` match actual deployment
- Use browser DevTools Network tab to debug missing assets

## Future Improvements

Potential enhancements:

1. **Static site generator**: Migrate to Astro or 11ty for more features
2. **Search functionality**: Add search across packs
3. **Filtering/sorting**: Filter packs by status, category, etc.
4. **Analytics**: Add usage tracking
5. **CI/CD improvements**: Parallel builds, caching, etc.
