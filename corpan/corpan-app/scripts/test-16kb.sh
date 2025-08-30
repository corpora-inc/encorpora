AAB="/Users/skyl/Code/corpora/encorpora/corpan/corpan-app/src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab"

# Try to locate your SDK root automatically (falls back to common macOS paths)
SDK="${ANDROID_SDK_ROOT:-}"
for CAND in "$SDK" "$HOME/Library/Android/sdk" "$HOME/Android"; do
  [ -d "$CAND/ndk" ] && SDK="$CAND" && break
done
[ -z "$SDK" ] && { echo "Could not find Android SDK. Set ANDROID_SDK_ROOT."; exit 1; }
export ANDROID_SDK_ROOT="$SDK"

# Find llvm-readobj (or llvm-objdump) in any installed NDK
LLVM_READOBJ="$(/usr/bin/find "$ANDROID_SDK_ROOT/ndk" -path '*/toolchains/llvm/prebuilt/*/bin/llvm-readobj' -type f -print -quit 2>/dev/null)"
[ -x "$LLVM_READOBJ" ] || { echo "Could not find llvm-readobj in $ANDROID_SDK_ROOT/ndk/*"; exit 1; }

TMP="$(mktemp -d)"
unzip -qq "$AAB" '*/lib/*/*.so' -d "$TMP"

echo "SDK=$ANDROID_SDK_ROOT"
echo "llvm-readobj=$LLVM_READOBJ"
echo "Checking ELF p_align == 0x4000 (16 KB) in AAB's native libs..."
BAD=0
while IFS= read -r -d '' SO; do
  # Require every LOAD segment’s p_align to be 0x4000
  if "$LLVM_READOBJ" -l "$SO" | awk '
      /Program Headers/ {inPH=1}
      inPH && /LOAD/ {check=1}
      check && /p_align:/ {
        if ($2 != "0x4000") { bad=1 }
        check=0
      }
      END { exit bad }'; then
    echo "PASS  $(basename "$SO")"
  else
    echo "FAIL  $(basename "$SO")  (p_align != 0x4000)"
    BAD=1
  fi
done < <(find "$TMP" -name '*.so' -print0)

rm -rf "$TMP"
if [ "$BAD" -eq 0 ]; then
  echo "✅ All native libs in the AAB are 16 KB-aligned (ELF)."
else
  echo "❌ One or more libs are not 16 KB-aligned. Rebuild those with NDK r28+."
  exit 2
fi
