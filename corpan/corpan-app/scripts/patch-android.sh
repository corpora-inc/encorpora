#!/usr/bin/env bash
set -euo pipefail

# Reproducible post-init patch for Tauri’s generated Android project.
# - Pins compile/target SDK 36 (required by androidx.core 1.17.0 which
#   tauri-plugin-iap transitively pulls in)
# - Pins NDK r28.2.13676358 (16 KB page-size ready)
# - Sets Java/Kotlin language level to 17
# - Adds a clearly marked patch block; safe to re-run any time

APP_ROOT="src-tauri/gen/android"
APP_DIR="${APP_ROOT}/app"
KTS_FILE="${APP_DIR}/build.gradle.kts"
GROOVY_FILE="${APP_DIR}/build.gradle"
PROPS="${APP_ROOT}/gradle.properties"

if [ ! -d "$APP_DIR" ]; then
  echo "Android project not found at ${APP_DIR}. Run: cargo tauri android init"
  exit 1
fi

mkdir -p "$(dirname "$PROPS")"
touch "$PROPS"

# --- Clean any previous patch blocks so re-running is safe ---
if [ -f "$KTS_FILE" ]; then
  sed -i '' '/BEGIN: corpan patch (idempotent)/,/END: corpan patch/d' "$KTS_FILE" || true
fi
if [ -f "$GROOVY_FILE" ]; then
  sed -i '' '/BEGIN: corpan patch (idempotent)/,/END: corpan patch/d' "$GROOVY_FILE" || true
fi

# --- Append a fresh, self-contained patch block ---
if [ -f "$KTS_FILE" ]; then
  printf "\n" >> "$KTS_FILE"
  cat >> "$KTS_FILE" <<'KTS'
/* BEGIN: corpan patch (idempotent) */
android {
    // Pin modern SDK + NDK. compileSdk must be 36+ for androidx.core 1.17.0
    // (pulled in transitively by tauri-plugin-iap).
    compileSdk = 36
    defaultConfig {
        targetSdk = 36
    }
    ndkVersion = "28.2.13676358"

    // Java 17 language level
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// Kotlin JVM target = 17 (no plugin block assumptions)
tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    kotlinOptions.jvmTarget = "17"
}
/* END: corpan patch */
KTS
elif [ -f "$GROOVY_FILE" ]; then
  printf "\n" >> "$GROOVY_FILE"
  cat >> "$GROOVY_FILE" <<'GROOVY'
/* BEGIN: corpan patch (idempotent) */
android {
    // Pin modern SDK + NDK. compileSdk must be 36+ for androidx.core 1.17.0
    // (pulled in transitively by tauri-plugin-iap).
    compileSdk 36
    defaultConfig {
        targetSdk 36
    }
    ndkVersion "28.2.13676358"

    // Java 17 language level
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

// Kotlin JVM target = 17 (works even if kotlin{} isn’t declared)
tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
    kotlinOptions {
        jvmTarget = "17"
    }
}
/* END: corpan patch */
GROOVY
else
  echo "No build.gradle(.kts) found under ${APP_DIR}"
  exit 1
fi

# --- gradle.properties: add the warning suppressor ON ITS OWN LINE, once ---
# (No android.nonFinalResIds here to avoid boolean parsing pitfalls.)
# Ensure final newline, then dedupe and append.
printf "\n" >> "$PROPS"

# Remove existing copies of the property
grep -v '^android.javaCompile.suppressSourceTargetDeprecationWarning=' "$PROPS" > "${PROPS}.tmp" || true
mv "${PROPS}.tmp" "$PROPS"

# Append a clean line
echo 'android.javaCompile.suppressSourceTargetDeprecationWarning=true' >> "$PROPS"

echo "✓ Patched: SDK=36, targetSdk=36, ndk=28.2.13676358, Java/Kotlin=17"
echo "You can now run: cargo tauri android dev"
