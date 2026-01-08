# Encorpora Pages

This directory contains the landing page templates and build scripts for the GitHub Pages site.

## Design Philosophy

The pages follow a minimalist, monochrome design aesthetic:

- **Color scheme**: Primary black (#171717) and gray (#737373) on white background
- **Hover effects**: Subtle transformations and opacity changes (no tacky animations)
- **Typography**: System fonts with precise letter-spacing and weights
- **Borders**: 1px solid borders that darken on hover (#e5e5e5 → #171717)
- **Transitions**: 0.15-0.2s cubic-bezier easing for smooth interactions

This creates a world-class, understated interface where content shines.

## Structure

```
web/pages/
├── templates/          # HTML templates
│   ├── corpan.html     # Corpan app page
│   └── games.html      # Games listing page
├── data/               # JSON data files
│   └── games.json      # Games metadata
├── build.js            # Build script
└── package.json        # Package metadata
```

## Architecture

These pages are **composed** into the `web/io/` site build:

1. `web/io/` Next.js site builds → `web/io/out/` (root)
2. This build script adds → `web/io/out/corpan/`
3. Game builds are copied → `web/io/out/corpan/games/`
4. Final result: complete site in `web/io/out/`

## Usage

### Building Corpan pages

```bash
node build.js <output-directory>
```

Example (composing into web/io/out):
```bash
cd web/io && npm run build && cd ../..  # First build web/io/ site
node web/pages/build.js web/io/out  # Add Corpan pages
```

This generates:
- `<output>/corpan/index.html` - Corpan landing page
- `<output>/corpan/games/index.html` - Games listing
- `<output>/assets/` - Images (logo, avatars)

### Adding a new game

1. Edit `data/games.json` with game metadata
2. (Optional) Set `avatarSource` to a canonical repo asset
3. Update GitHub workflow to build and copy game

### Local testing

Use the `web/scripts/serve-local.sh` script which builds everything:

```bash
# From repo root
./web/scripts/serve-local.sh
```

## Final Deployed Structure

```
https://encorpora.io/
├── index.html                  # web/io/ root site
├── books.html                  # web/io/ books page
├── assets/                     # Copied from canonical repo assets
├── corpan/
│   ├── index.html              # Corpan landing
│   └── games/
│       ├── index.html          # Games listing
│       └── hover-runner/
│           ├── manifest.json
│           └── ...
└── _next/                      # Next.js assets
```
