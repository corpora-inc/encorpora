# Hover Runner

A Babylon.js prototype for Corpan. The scene renders a dynamic road ribbon, a hoverboard placeholder, and smooth 4-quadrant movement with keyboard, tap, or device tilt.

## Commands

```bash
npm install
npm run dev
```

To mirror the asset-pack workflow:

```bash
npm run build:all
```

## Logo models

The Corpán logo is generated as a single GLB with a baked hierarchy and
an `corpan_ear_pivot` transform for animation.

```bash
npm run build:models
```

Outputs:
- `corpan/games/hover-runner/src/assets/models/corpan_logo.glb`
- `corpan/games/hover-runner/public/models/corpan-logo/corpan_logo.glb`
