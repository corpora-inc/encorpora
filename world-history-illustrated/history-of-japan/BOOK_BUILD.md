# History of Japan — Build Guide

## Quick Reference

```bash
cd ~/encorpora/world-history-illustrated/history-of-japan

# Check image status
bookctl scan .
bookctl status .

# Render map images (from Python scripts in maps/)
bookctl map . --all                        # all map scripts
bookctl map . --image=ring-of-fire-map.png # one specific map

# Generate SD3.5 candidates for non-map images
bookctl generate . --all --num 4

# Review and accept SD3.5 candidates
bookctl review .

# Build PDF + EPUB
./build.sh
./build.sh --pdf-only
./build.sh --epub-only
./build.sh --focus=3 --window=1   # build just chapters 2-4
```

## Prerequisites

### System packages (installed via sudo apt-get)
- `pandoc`
- `texlive-xetex`, `texlive-latex-extra`, `texlive-fonts-extra`
- `texlive-fonts-recommended`, `texlive-science`, `texlive-pictures`
- `texlive-lang-cjk`, `texlive-lang-chinese`, `texlive-lang-japanese`
- `fonts-noto-core` (provides Noto Serif / Noto Sans for LaTeX)
- `latexmk`

### Python (all in ~/projects/image-gen/.venv)
- `bookctl` — installed editable from `~/projects/bookctl`
- `staticmap`, `Pillow` — for map generation
- `diffusers`, `torch` (cu130) — for SD3.5 image generation

### Activating the venv
```bash
source ~/projects/image-gen/.venv/bin/activate
# OR use full paths: ~/projects/image-gen/.venv/bin/bookctl
```

## Pipeline: Map Script → Image → Book

### Step 1: Write/edit a map script

Map scripts live in `maps/<image-stem>.py`. The filename must match the
image reference in the manuscript (e.g., `ring-of-fire-map.py` →
`images/ring-of-fire-map.png`).

Each script receives the output path as `sys.argv[1]` and uses `MapMaker`:

```python
#!/usr/bin/env python3
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "projects" / "bookctl"))
from bookctl.backends.mapmaker import MapMaker

output = Path(sys.argv[1]) if len(sys.argv) > 1 else \
    Path(__file__).parent.parent / "images" / "my-map.png"

m = MapMaker(
    width=1800, height=1400,
    center=(138, 33),   # (lon, lat)
    zoom=5,
    tiles="esri_world_imagery",  # or: osm, esri_world_topo, opentopomap
)
m.add_marker((138.73, 35.36), color="#FFD700", size=14)
m.add_label((140, 35), "Mt. Fuji", color="#FFD700", size=16, bold=True)
m.add_line([(130, 30), (140, 35), (145, 40)], color="#FF4444", width=3)
m.render(output)
```

**Do NOT add titles in the map** — captions come from markdown/pandoc.

### Step 2: Render the map

```bash
bookctl map . --image=ring-of-fire-map.png
# Output: images/ring-of-fire-map.png (1800x1400, 300dpi)
```

### Step 3: Verify with scan

```bash
bookctl scan .
# ring-of-fire-map.png should show "OK" (green)
```

### Step 4: Build the book

```bash
./build.sh              # PDF + EPUB
./build.sh --pdf-only   # just PDF (faster)
```

## MapMaker API Reference

### Constructor
```python
MapMaker(width, height, center=(lon, lat), zoom=N, tiles="provider")
```

### Tile providers
- `"osm"` — OpenStreetMap (street map)
- `"esri_world_imagery"` — Esri satellite imagery (commercial OK, no attribution needed)
- `"esri_world_topo"` — Esri topographic
- `"opentopomap"` — OpenTopoMap terrain/hillshade
- Or any custom URL: `"https://tiles.example.com/{z}/{x}/{y}.png"`

### Methods
- `add_marker((lon, lat), color="#FF4444", size=8)` — circle dot
- `add_line([(lon,lat), ...], color="#FF4444", width=3)` — polyline
- `add_polygon([(lon,lat), ...], fill="#FF444444", outline="#FF4444")` — filled polygon
- `add_label((lon, lat), "text", color="white", size=14, bold=False)` — text with halo
- `render(output_path)` — save as 300dpi PNG

### Coordinates
All coordinates are `(longitude, latitude)` — lon first, lat second.

## Directory Structure

```
history-of-japan/
├── book.yaml              # bookctl config
├── build.sh               # pandoc build script
├── defaults.yaml          # pandoc defaults (xelatex, memoir, 6x9)
├── custom_headings.tex    # LaTeX preamble (fonts, CJK, math, etc.)
├── custom_cover.tex       # title page
├── epub.css               # EPUB stylesheet
├── project.json           # book metadata
├── .gitignore             # ignores .bookctl/, *.pdf, *.epub
├── .gitattributes         # images/*.png tracked by Git LFS
├── manuscript/
│   ├── 01-land-of-fire-and-water.md
│   ├── ...
│   └── 15-japan-today.md
├── maps/
│   └── ring-of-fire-map.py   # programmatic map scripts
└── images/
    ├── ring-of-fire-map.png   # generated from map script
    ├── mount-fuji-four-seasons.png  # from SD3.5
    └── ...                    # 43 total images
```

## Current State (as of 2026-02-15)

- 15 chapters, 32,157 words
- 43 image references in manuscript
- 40 images OK (accepted from SD3.5 candidates)
- 1 image from map script (ring-of-fire-map.png)
- 3 images with candidates ready for review
- 0 missing

## bookctl Package Location

```
~/projects/bookctl/
├── pyproject.toml
└── bookctl/
    ├── __init__.py
    ├── cli.py           # click CLI (scan, generate, map, review, status)
    ├── config.py        # book.yaml pydantic model
    ├── scanner.py       # finds ![](images/...) refs, checks filesystem + map scripts
    ├── generator.py     # SD3.5 candidate generation orchestrator
    ├── reviewer.py      # interactive terminal review
    ├── utils.py         # path helpers
    └── backends/
        ├── __init__.py  # ImageBackend ABC
        ├── sd35.py      # Stable Diffusion 3.5 Large backend
        └── mapmaker.py  # MapMaker class (staticmap + Pillow)
```

Installed editable into `~/projects/image-gen/.venv/`:
```bash
~/projects/image-gen/.venv/bin/pip install -e ~/projects/bookctl
```
