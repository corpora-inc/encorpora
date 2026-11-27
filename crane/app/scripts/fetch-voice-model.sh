#!/usr/bin/env bash
# Download the bundled speech model named in src-tauri/voice-model.json into
# src-tauri/voice/ (git-ignored; bundled as a Tauri resource) and verify its
# size and SHA-256. Idempotent: a verified file is left alone. Release builds
# run this; a dev build without it simply has no voice input.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
manifest="$here/../src-tauri/voice-model.json"
read -r file url bytes sha < <(python3 -c 'import json,sys; m=json.load(open(sys.argv[1])); print(m["file"], m["url"], m["bytes"], m["sha256"])' "$manifest")
case "$file" in *[!A-Za-z0-9._-]*|.*) echo "fetch-voice-model: bad file name $file" >&2; exit 1 ;; esac
dir="$here/../src-tauri/voice"
mkdir -p "$dir"
dest="$dir/$file"
sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }
if [ -f "$dest" ] && [ "$(wc -c < "$dest" | tr -d ' ')" = "$bytes" ] && [ "$(sha256 "$dest")" = "$sha" ]; then
  echo "fetch-voice-model: $file already present and verified"
  exit 0
fi
curl -fsSL --retry 3 -o "$dest.part" "$url"
got_bytes="$(wc -c < "$dest.part" | tr -d ' ')"
got_sha="$(sha256 "$dest.part")"
if [ "$got_bytes" != "$bytes" ] || [ "$got_sha" != "$sha" ]; then
  echo "fetch-voice-model: $file does not match voice-model.json (bytes $got_bytes, sha256 $got_sha)" >&2
  exit 1
fi
mv "$dest.part" "$dest"
echo "fetch-voice-model: $file verified ($bytes bytes)"
