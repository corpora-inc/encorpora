# Corpan content packs (prototype)

Content packs are web bundles loaded at runtime via a manifest URL. The host injects the pack's script/style tags and calls a `mount()` method registered on `window.CorpanGames`.

## Manifest fields

```json
{
  "id": "endless_runner",
  "name": "Endless Runner",
  "version": "0.1.0",
  "entry": "app.js",
  "styles": ["app.css"],
  "entryType": "script",
  "sdkVersion": "0.1.0",
  "baseUrl": "./"
}
```

## Host API

- `speak(uiCode, text)`
- `getStackConfig()`
- `onStackConfigChange(listener)`
- `getRandomEntry()`
- `getEntryById(entryId)`

## Runtime contract

- Game bundles must register themselves on `window.CorpanGames[id]` with a `mount(container, hostApi, initialState)` function.
- The host resolves asset URLs relative to the manifest URL (or `baseUrl` if provided).
- Packs can be loaded from `/games/<id>/manifest.json` (dev) or any remote manifest URL.
- Platform-delivered packs are served locally via the `corpan-pack://` scheme (Android uses `http://corpan-pack.localhost/`).
- Native delivery is implemented in `plugins/tauri-plugin-game-packs`.

## Platform delivery (no server)

For iOS/Android IAP delivery, see `corpan-app/src/contentPacks/PLATFORM_DELIVERY.md`.
