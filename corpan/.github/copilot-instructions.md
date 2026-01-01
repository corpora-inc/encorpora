# Corpan agent notes

- Prefer editing templates or plugins over `corpan-app/src-tauri/gen/`; treat `gen/` as build output.
- Native game-pack delivery lives in `plugins/tauri-plugin-game-packs`.
- Android PAD assets live in `corpan-app/src-tauri/android/asset-packs` and must be synced into `gen/android` after generation.
- iOS ODR assets live in `corpan-app/src-tauri/ios/assets` and require tagging in Xcode.

## Build checks

- Rust/Tauri: run `cargo check` in `corpan-app/src-tauri` after editing plugins.
- App: run `npm run tauri dev` in `corpan-app` to validate end-to-end startup.
