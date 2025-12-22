# Endless Learner (Corpan content pack)

## Standalone dev (no Corpan)

1) Install deps and run Vite:

```
cd games/endless-learner
npm install
npm run dev
```

2) Open the dev harness:

```
http://localhost:5173
```

This uses the SDK mock host API (browser TTS + fake corpus response) so you can iterate quickly without the Corpan app.

## In-app dev (Corpan wrapper)

1) Build + serve with auto-reload (writes `dist/app.js` + `dist/app.css` and
   bumps `manifest.json` for live reload):

```
cd games/endless-learner
npm run dev:corpan
```

2) Run Corpan:

```
cd corpan-app
npm run tauri dev
```

4) Install the manifest URL from Settings → Games:

```
http://localhost:8989/endless-learner/manifest.json
```

5) Launch the game from the installed list.

Now edits to the pack should rebuild and live-reload inside the running app.

## Store delivery (native asset packs)

For TestFlight / Play Store, the pack is bundled into platform-specific asset
packs so the stores handle download and entitlement:

- iOS ODR assets live in:
  `corpan-app/src-tauri/ios/assets/corpan-packs/endless_learner/`
- Android PAD assets live in:
  `corpan-app/src-tauri/android/asset-packs/endless_learner/src/main/assets/`

After building the pack, copy the outputs into those folders:

```
cd games/endless-learner
npm run build:assets
```

You can also run both steps in one command:

```
npm run build:all
```

## Notes

- Pack ID: `endless_learner` (asset packs can’t use hyphens).
- The host will provide real TTS + corpus APIs when launched inside Corpan.
- Vite builds into `dist/`; the manifest points at `dist/app.js` + `dist/app.css`.
- See `games/endless-learner/GAMEPLAY.md` for the target loop and `games/endless-learner/ROADMAP.md` for the iteration plan.
