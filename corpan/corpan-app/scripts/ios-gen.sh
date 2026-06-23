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

# Step 1: Regenerate platform icon variants from the source PNG.
# `tauri icon` writes sized variants into src-tauri/icons/ and populates the
# AppIcon asset catalogs that gen/apple/ uses. Required when gen/ is wiped.
ICON_SOURCE="$SRC_TAURI/icons/512x512_white.png"
if [ -f "$ICON_SOURCE" ]; then
  echo "[ios-gen] Regenerating icons from 512x512_white.png..."
  (cd "$SRC_TAURI" && cargo tauri icon icons/512x512_white.png) || \
    npx tauri icon src-tauri/icons/512x512_white.png
else
  echo "[ios-gen] WARNING: $ICON_SOURCE not found — skipping icon generation"
fi

# Step 2: Pre-copy supporting files that project.yml references.
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

# Step 3: Run tauri ios init (copies project.yml template, runs xcodegen)
echo "[ios-gen] Running tauri ios init..."
npx tauri ios init --ci

# Step 4: Sync required privacy strings into the generated plist. Tauri keeps
# gen/apple between runs, so a stale generated project can otherwise omit a new
# privacy key even after ios/project.yml is fixed.
bash "$SCRIPT_DIR/ios-privacy-preflight.sh"

# Step 5: Verify the rpath fix is in place
if grep -q "/usr/lib/swift" "$GEN_DIR/corpan.xcodeproj/project.pbxproj" 2>/dev/null; then
  echo "[ios-gen] Verified: /usr/lib/swift is in LD_RUNPATH_SEARCH_PATHS"
else
  echo "[ios-gen] WARNING: /usr/lib/swift NOT found in LD_RUNPATH_SEARCH_PATHS!"
  exit 1
fi

# Step 6: Patch xcscheme to add StoreKit configuration for sandbox testing.
# xcodegen does not generate the storeKitConfigurationFileReference despite
# project.yml specifying storeKitConfiguration. We patch it in post.
SCHEME_FILE="$GEN_DIR/corpan.xcodeproj/xcshareddata/xcschemes/corpan_iOS.xcscheme"
if [ -f "$SCHEME_FILE" ] && ! grep -q "StoreKitConfigurationFileReference" "$SCHEME_FILE"; then
  echo "[ios-gen] Patching scheme with StoreKit configuration..."
  # Insert the StoreKit reference as a child of <LaunchAction>, before <BuildableProductRunnable>
  sed -i '' '/<BuildableProductRunnable/{
    i\
      <StoreKitConfigurationFileReference\
         identifier = "../../../Corpan.storekit">\
      </StoreKitConfigurationFileReference>
  }' "$SCHEME_FILE"

  if grep -q "StoreKitConfigurationFileReference" "$SCHEME_FILE"; then
    echo "[ios-gen] Verified: StoreKit sandbox configuration patched into scheme"
  else
    echo "[ios-gen] WARNING: StoreKit scheme patch failed"
  fi
fi

echo "[ios-gen] Done. Run: npm run tauri ios dev"
