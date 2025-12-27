# Platform delivery (ODR + PAD)

This describes the no-server IAP delivery path for Corpan game packs.

## Goals

- No custom backend required.
- Apple/Google handle purchase + hosting.
- Packs are downloaded on-demand and cached locally.
- Same manifest contract used by the content pack loader.

## iOS (On-Demand Resources)

- Each game pack is an ODR bundle tagged with its pack ID.
- The app requests the tag after purchase and receives a local file URL.
- The manifest is stored inside the ODR bundle.

### Xcode / App Store steps (required)

- Add the pack folder (e.g. `assets/corpan-packs/hover_runner/`) to the Xcode target resources.
- In Xcode, set the **On Demand Resource Tags** for that folder to the pack ID (`hover_runner`).
- In App Store Connect, enable ODR for the app and upload a build so Apple hosts the tag.
  - Pack sources live in `corpan-app/src-tauri/ios/assets/corpan-packs/`.

## Android (Play Asset Delivery)

- Each game pack is a PAD asset pack, identified by pack ID.
- The app requests the pack; Play downloads and exposes an asset path.
- The manifest is stored inside the PAD asset pack.

### Play Console steps (required)

- Ensure the asset pack module (`hover_runner`) is included in the Android App Bundle.
- Mark the pack as **on-demand** in the Play Console (or fast-follow if desired).
- Upload the new AAB so Play hosts the pack.

### Android build step

- Run `corpan-app/src-tauri/scripts/sync-android-asset-packs.sh` after generating the Android project. It syncs `src-tauri/android/asset-packs` into `src-tauri/gen/android`.

## Client flow (shared)

1. User purchases pack via App Store / Play Billing.
2. Native layer requests the asset pack by ID.
3. Native layer resolves `manifest.json` path in the pack.
4. JS calls `get_game_pack_manifest_url` to get a URL to the manifest.
5. ContentPackHost loads the manifest and assets via that URL.

## Native bridge (proposed)

- `plugin:game_packs|list_game_packs` -> [{ id, name, version }]
- `plugin:game_packs|get_game_pack_manifest_url` -> string

These functions should only return packs already available on-device.
The bridge is implemented in the monorepo at `plugins/tauri-plugin-game-packs`.

## Manifest location

Each pack must include:

```
<pack root>/manifest.json
<pack root>/app.js
<pack root>/app.css
...
```

The loader resolves assets relative to the manifest path.

## Notes

- The JS loader supports relative asset paths and module scripts.
- Packs are served locally via the `corpan-pack://` scheme (Android uses `http://corpan-pack.localhost/`).
- For local import or remote hosting, use the manifest URL install flow.
