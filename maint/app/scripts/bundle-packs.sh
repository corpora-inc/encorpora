#!/usr/bin/env bash
# Place the signed packs a build ships into src-tauri/resources/packs/<pack>/
# (each pack's current version: manifest.json and its files). The app installs
# and verifies them on first run against the key compiled into the shell.
#   MAINT_PACKS (default ~/.cache/harvest/packs/maint-dev/root): an installed packs root.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="${MAINT_PACKS:-$HOME/.cache/harvest/packs/maint-dev/root}"
DEST=src-tauri/resources/packs
mkdir -p "$DEST"
find "$DEST" -mindepth 1 -maxdepth 1 -exec trash {} + 2>/dev/null || true
for pack in "$ROOT"/*/; do
  name="$(basename "$pack")"
  version="$(tr -d '[:space:]' < "$pack/current")"
  cp -R "$pack/$version" "$DEST/$name"
  echo "bundled $name $version"
done
