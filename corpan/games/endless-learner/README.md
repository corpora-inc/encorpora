# Endless Learner (Corpan content pack)

## Standalone dev (no Corpan)

1) From `corpan/games` run a static server:

```
python3 -m http.server 8989
```

2) Open the standalone harness:

```
http://localhost:8989/endless-learner/dev.html
```

This uses the SDK mock host API (browser TTS + fake corpus response) so you can iterate quickly without the Corpan app.

## In-app dev (Corpan wrapper)

1) Run Corpan:

```
cd corpan-app
npm run tauri dev
```

2) Install the manifest URL from Settings → Games:

```
http://localhost:8989/endless-learner/manifest.json
```

3) Launch the game from the installed list.

## Notes

- Pack ID: `endless_learner` (asset packs can’t use hyphens).
- The host will provide real TTS + corpus APIs when launched inside Corpan.
- `dev.html` is only for local iteration; the production entry is `app.js` via `manifest.json`.
