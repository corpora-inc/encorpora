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
pages/
├── templates/          # HTML templates
│   ├── corpan.html     # Corpan app page
│   └── games.html      # Games listing page
├── data/               # JSON data files
│   └── games.json      # Games metadata
├── assets/             # Static assets
│   ├── logo-512.png    # Corpán logo (512x512)
│   └── hover-runner-avatar.png  # Game avatars
├── build.js            # Build script
└── package.json        # Package metadata
```

## Architecture

These pages are **composed** into the `io/` site build:

1. `io/` Next.js site builds → `io/out/` (root)
2. This build script adds → `io/out/corpan/`
3. Game builds are copied → `io/out/corpan/games/`
4. Final result: complete site in `io/out/`

## Usage

### Building Corpan pages

```bash
node build.js <output-directory>
```

Example (composing into io/out):
```bash
cd io && npm run build  # First build io/ site
cd ..
node pages/build.js io/out  # Add Corpan pages
```

This generates:
- `<output>/corpan/index.html` - Corpan landing page
- `<output>/corpan/games/index.html` - Games listing
- `<output>/assets/` - Images (logo, avatars)

### Adding a new game

1. Edit `data/games.json` with game metadata
2. Add avatar to `assets/my-game-avatar.png` (optional)
3. Update `templates/games.html` gameAvatars map
4. Update GitHub workflow to build and copy game

### Local testing

Use the root `serve-local.sh` script which builds everything:

```bash
# From repo root
./serve-local.sh
```

## Final Deployed Structure

```
https://corpora-inc.github.io/encorpora/
├── index.html                  # io/ root site
├── books.html                  # io/ books page
├── assets/
│   ├── logo-512.png            # Corpán logo
│   └── hover-runner-avatar.png # Game avatars
├── corpan/
│   ├── index.html              # Corpan landing
│   └── games/
│       ├── index.html          # Games listing
│       └── hover-runner/
│           ├── manifest.json
│           └── ...
└── _next/                      # Next.js assets
```
