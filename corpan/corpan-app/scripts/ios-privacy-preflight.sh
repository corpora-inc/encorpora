#!/usr/bin/env bash
# Keep the ignored Tauri/Xcode generated plist aligned with ios/project.yml.
# iOS terminates the process immediately if Speech authorization is requested
# without NSSpeechRecognitionUsageDescription, so stale gen/apple state cannot
# be allowed to reach a device or App Store archive.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$APP_DIR/src-tauri/gen/apple/corpan_iOS/Info.plist"

if [[ ! -f "$PLIST" ]]; then
  exit 0
fi

set_or_add() {
  local key="$1"
  local value="$2"
  /usr/libexec/PlistBuddy -c "Set :$key $value" "$PLIST" 2>/dev/null ||
    /usr/libexec/PlistBuddy -c "Add :$key string $value" "$PLIST"
}

set_or_add \
  NSMicrophoneUsageDescription \
  "Corpán uses your microphone for on-device pronunciation practice and optional speech-to-text dictation. Audio is processed locally on your device."
set_or_add \
  NSSpeechRecognitionUsageDescription \
  "Corpán uses on-device speech recognition for optional speech-to-text dictation, so you can speak instead of type. Speech is processed locally on your device."

echo "[ios-privacy] Verified microphone and speech-recognition usage descriptions."
