#!/usr/bin/env bash
# ios-gen.sh — Reproducible iOS project generation for Corpan
#
# Generates gen/apple/ from the ios/project.yml template via Tauri + xcodegen.
# Pre-copies supporting files (StoreKit config, entitlements) that project.yml
# references but Tauri doesn't copy.
#
# Usage:  ./scripts/ios-gen.sh          # from corpan-app/
#         ./scripts/ios-gen.sh --clean  # delete gen/apple/ first
#
# After running:  npm run tauri ios dev
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_TAURI="$APP_DIR/src-tauri"
IOS_DIR="$SRC_TAURI/ios"
GEN_DIR="$SRC_TAURI/gen/apple"

cd "$APP_DIR"

# Clean if requested
if [[ "${1:-}" == "--clean" ]]; then
  echo "[ios-gen] Cleaning gen/apple/..."
  rm -rf "$GEN_DIR"
fi

# Step 1: Pre-copy supporting files that project.yml references.
# Tauri copies project.yml but not companion files like StoreKit configs
# and entitlements. xcodegen needs them at gen/apple/ when it runs.
echo "[ios-gen] Pre-copying supporting files..."
mkdir -p "$GEN_DIR/corpan_iOS"

if [ -f "$IOS_DIR/Corpan.storekit" ]; then
  cp "$IOS_DIR/Corpan.storekit" "$GEN_DIR/"
  echo "  -> Corpan.storekit"
fi

if [ -f "$IOS_DIR/corpan_iOS/corpan_iOS.entitlements" ]; then
  cp "$IOS_DIR/corpan_iOS/corpan_iOS.entitlements" "$GEN_DIR/corpan_iOS/"
  echo "  -> corpan_iOS.entitlements"
fi

# Step 2: Run tauri ios init (copies project.yml template, runs xcodegen)
echo "[ios-gen] Running tauri ios init..."
npx tauri ios init --ci

# Step 3: Verify the rpath fix is in place
if grep -q "/usr/lib/swift" "$GEN_DIR/corpan.xcodeproj/project.pbxproj" 2>/dev/null; then
  echo "[ios-gen] Verified: /usr/lib/swift is in LD_RUNPATH_SEARCH_PATHS"
else
  echo "[ios-gen] WARNING: /usr/lib/swift NOT found in LD_RUNPATH_SEARCH_PATHS!"
  exit 1
fi

echo "[ios-gen] Done. Run: npm run tauri ios dev"
