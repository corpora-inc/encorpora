# Encorpora Pages

This directory contains the landing page templates and build scripts for the GitHub Pages site.

## Structure

```
pages/
├── templates/          # HTML templates
│   ├── root.html       # Root landing page (encorpora)
│   ├── corpan.html     # Corpan app page
│   └── games.html      # Games listing page
├── data/               # JSON data files
│   ├── apps.json       # Apps metadata
│   └── games.json      # Games metadata
├── build.js            # Build script
└── package.json        # Package metadata
```

## Usage

### Building locally

```bash
node build.js <output-directory>
```

Example:
```bash
node build.js ./dist
```

This will generate:
- `dist/index.html` - Root landing page
- `dist/corpan/index.html` - Corpan landing page
- `dist/corpan/games/index.html` - Games listing page

### Adding a new app

1. Edit `data/apps.json` and add your app metadata
2. Optionally create a dedicated landing page template
3. Update `build.js` to generate the new page

### Adding a new game

1. Edit `data/games.json` and add your game metadata
2. The game will automatically appear on the games listing page

## GitHub Actions

The `.github/workflows/hover-runner-pages.yml` workflow builds and deploys:
1. Landing pages (from this directory)
2. Game builds (from `corpan/games/*/dist`)

The final site structure on GitHub Pages:
```
https://corpora-inc.github.io/encorpora/
├── index.html                                      # Root landing page
├── corpan/
│   ├── index.html                                  # Corpan landing page
│   └── games/
│       ├── index.html                              # Games listing
│       └── hover-runner/
│           ├── manifest.json                       # Game manifest
│           └── ...game files...                    # Game assets
```
