#!/usr/bin/env bash
# Build the macOS app: Maintenance Associate.app, engine in process, packs bundled.
#   maint/app/scripts/build-mac.sh            (release .app)
# Writes nothing outside this checkout except the cargo target directory.
set -euo pipefail
cd "$(dirname "$0")/.."
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$HOME/.cache/harvest/target-maint-tauri}"
scripts/bundle-packs.sh
# Icons from the app's own mark (generated, not committed).
[ -f src-tauri/icons/icon.icns ] || npx tauri icon public/icon.svg -o src-tauri/icons >/dev/null
nice -n 20 npx tauri build --bundles app
echo "$CARGO_TARGET_DIR/release/bundle/macos/Maintenance Associate.app"
