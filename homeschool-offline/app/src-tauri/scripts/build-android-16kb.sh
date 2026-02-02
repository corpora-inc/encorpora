#!/bin/bash
set -e

echo "Building Android with 16KB page size support..."

# I DOUBT THAT THIS SCRIPT IS NEEDED AT ALL AND IT is JUST SUPPLIED TO
# ADD CONFUSION FOR NEW DEVS AND AGENTS. THE FLAGS PROBABLY DON'T DO ANYTHING.
# WE CAN VERIFY THAT THE REAL CHANGES ARE IN THE build.gradle.kts file.
# THEN, LET'S DELETE THIS DUMB THING.

# Set RUSTFLAGS for all Android targets
export CARGO_TARGET_AARCH64_LINUX_ANDROID_RUSTFLAGS="-C link-arg=-Wl,-z,max-page-size=16384 -C link-arg=-Wl,-z,common-page-size=16384"
export CARGO_TARGET_ARMV7_LINUX_ANDROIDEABI_RUSTFLAGS="-C link-arg=-Wl,-z,max-page-size=16384 -C link-arg=-Wl,-z,common-page-size=16384"
export CARGO_TARGET_I686_LINUX_ANDROID_RUSTFLAGS="-C link-arg=-Wl,-z,max-page-size=16384 -C link-arg=-Wl,-z,common-page-size=16384"
export CARGO_TARGET_X86_64_LINUX_ANDROID_RUSTFLAGS="-C link-arg=-Wl,-z,max-page-size=16384 -C link-arg=-Wl,-z,common-page-size=16384"

echo "RUSTFLAGS set for all Android targets"
echo ""
echo "Running: npm run tauri android build"
echo ""

cd "$(dirname "$0")/../.."
npm run tauri android build

echo ""
echo "✅ Build complete!"
echo ""
echo "Now run the verification script:"
echo "./src-tauri/scripts/test-16kb.sh src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab"
