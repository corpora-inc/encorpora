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

exit 0

echo "Android asset packs synced."
