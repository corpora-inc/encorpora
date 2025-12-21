#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
GEN_ANDROID="$ROOT_DIR/gen/android"
PACKS_DIR="$ROOT_DIR/android/asset-packs"

if [ ! -d "$GEN_ANDROID" ]; then
  echo "Missing generated android project at $GEN_ANDROID" >&2
  exit 1
fi

if [ ! -d "$PACKS_DIR" ]; then
  echo "Missing asset packs at $PACKS_DIR" >&2
  exit 1
fi

# Copy asset pack modules into generated android project
rsync -a --delete "$PACKS_DIR/" "$GEN_ANDROID/"

# Ensure settings.gradle includes asset-pack plugin and module include
SETTINGS="$GEN_ANDROID/settings.gradle"
if ! rg -q "com.android.asset-pack" "$SETTINGS"; then
  perl -0pi -e 's/id \'com.android.library\'     version \'8.6.0\'\n/id \'com.android.library\'     version \'8.6.0\'\n    id \'com.android.asset-pack\'  version \'8.6.0\'\n/' "$SETTINGS"
fi

if ! rg -q "include ':endless_runner'" "$SETTINGS"; then
  perl -0pi -e "s/include ':app'\n/include ':app'\ninclude ':endless_runner'\n/" "$SETTINGS"
fi

# Ensure app/build.gradle.kts references asset packs
APP_BUILD="$GEN_ANDROID/app/build.gradle.kts"
if ! rg -q "assetPacks" "$APP_BUILD"; then
  perl -0pi -e 's/ndkVersion = "28.2.13676358"/ndkVersion = "28.2.13676358"\n\n    assetPacks += listOf(":endless_runner")/' "$APP_BUILD"
fi

echo "Android asset packs synced."
