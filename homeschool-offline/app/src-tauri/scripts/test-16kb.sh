#!/usr/bin/env bash
set -euo pipefail

# Test that all .so files in AAB have correct 16KB page alignment
# Usage: ./scripts/test-16kb.sh [path/to/app.aab]

AAB="${1:-src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab}"

if [ ! -f "$AAB" ]; then
  echo "Error: AAB file not found: $AAB"
  exit 1
fi

# Auto-detect Android SDK and find llvm-readobj
SDK="${ANDROID_SDK_ROOT:-}"
if [ -z "$SDK" ] || [ ! -d "$SDK" ]; then
  for CAND in "$HOME/Library/Android/sdk" "$HOME/Android"; do
    if [ -d "$CAND/ndk" ]; then
      SDK="$CAND"
      break
    fi
  done
fi

if [ -z "$SDK" ] || [ ! -d "$SDK" ]; then
  echo "Error: Android SDK not found. Set ANDROID_SDK_ROOT or install Android SDK."
  exit 1
fi

LLVM_READOBJ="$(find "$SDK/ndk" -path '*/toolchains/llvm/prebuilt/*/bin/llvm-readobj' -type f -print -quit 2>/dev/null)"

if [ -z "$LLVM_READOBJ" ] || [ ! -x "$LLVM_READOBJ" ]; then
  echo "Error: llvm-readobj not found in NDK at $SDK/ndk"
  echo "Make sure NDK is installed"
  exit 1
fi

echo "Using: $LLVM_READOBJ"

TMP="$(mktemp -d)"
trap "rm -rf $TMP" EXIT

unzip -qq "$AAB" '*/lib/*/*.so' -d "$TMP"

echo "Checking ELF p_align == 0x4000 (16 KB) in AAB's native libs..."
BAD=0

while IFS= read -r -d '' SO; do
  if "$LLVM_READOBJ" -l "$SO" | awk '
      /Program Headers/ {inPH=1}
      inPH && /LOAD/ {check=1}
      check && /p_align:/ {
        if ($2 != "0x4000") { bad=1 }
        check=0
      }
      END { exit bad }'; then
    echo "✅ PASS  $(basename "$SO")"
  else
    echo "❌ FAIL  $(basename "$SO")  (p_align != 0x4000)"
    BAD=1
  fi
done < <(find "$TMP" -name '*.so' -print0)

echo ""
if [ "$BAD" -eq 0 ]; then
  echo "✅ All native libs in the AAB are 16 KB-aligned (ELF)."
else
  echo "❌ One or more libs are not 16 KB-aligned."
  echo "Make sure .cargo/config.toml has explicit linker/ar paths to NDK 28+."
  exit 2
fi
