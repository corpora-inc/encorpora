#!/bin/bash
set -e

# Idempotent patch script for Android build.gradle.kts
# Safe to run multiple times

BUILD_GRADLE="./gen/android/app/build.gradle.kts"

if [ ! -f "$BUILD_GRADLE" ]; then
  echo "Error: $BUILD_GRADLE not found"
  echo "Run 'npm run tauri android init' first"
  exit 1
fi

echo "Patching $BUILD_GRADLE for 16KB page size support..."

# Check if NDK version is already set
if grep -q "ndkVersion = \"28.2.13676358\"" "$BUILD_GRADLE"; then
  echo "  ✅ NDK version already set"
else
  echo "  🔧 Adding NDK version..."
  # Add after compileSdk line
  sed -i '' '/compileSdk = 36/a\
    // BEGIN IDEMPOTENT PATCH\
    ndkVersion = "28.2.13676358"\
    // END IDEMPOTENT PATCH
' "$BUILD_GRADLE"
fi

# Check if Java 17 is already set
if grep -q "JavaVersion.VERSION_17" "$BUILD_GRADLE"; then
  echo "  ✅ Java 17 already set"
else
  echo "  🔧 Upgrading to Java 17..."
  # Replace jvmTarget value
  sed -i '' 's/jvmTarget = "1.8"/jvmTarget = "17"/' "$BUILD_GRADLE"

  # Add compileOptions before kotlinOptions
  sed -i '' '/kotlinOptions {/i\
    compileOptions {\
        sourceCompatibility = JavaVersion.VERSION_17\
        targetCompatibility = JavaVersion.VERSION_17\
    }
' "$BUILD_GRADLE"
fi

echo "✅ Patch complete!"
