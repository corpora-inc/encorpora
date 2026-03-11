#!/bin/bash
# Download published narration audio from CloudFront and extract to local pack dirs.
# Use after a fresh clone to populate audio/ directories for Vite dev server.
#
# Downloads narration ZIPs, extracts only the audio/{lang}/*.m4a files,
# and places them in the corresponding books/*/pack/audio/{lang}/ directory.
#
# Prerequisites:
#   - curl, unzip, jq
#
# Usage:
#   ./corpan/infra/hydrate-audio.sh                  # all books, all languages
#   ./corpan/infra/hydrate-audio.sh --book book_monte_alban
#   ./corpan/infra/hydrate-audio.sh --lang en
#   ./corpan/infra/hydrate-audio.sh --book book_monte_alban --lang en

set -euo pipefail

CDN_BASE="https://d38iwc9748jekz.cloudfront.net"
BOOKS_ROOT="${HOME}/encorpora/books/fascinating-curiosities"
TMPDIR_BASE=$(mktemp -d)
trap 'rm -rf "$TMPDIR_BASE"' EXIT

FILTER_BOOK=""
FILTER_LANG=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --book) FILTER_BOOK="$2"; shift 2 ;;
    --lang) FILTER_LANG="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Build a map of bookId → local pack dir by scanning manifests
declare -A BOOK_DIRS
for manifest in "$BOOKS_ROOT"/*/pack/manifest.json; do
  book_id=$(jq -r '.id' "$manifest" 2>/dev/null) || continue
  pack_dir=$(dirname "$manifest")
  BOOK_DIRS["$book_id"]="$pack_dir"
done

echo "Fetching catalog from CDN..."
CATALOG=$(curl -sS "${CDN_BASE}/catalog.json")

# Parse narrations from catalog
NARRATIONS=$(echo "$CATALOG" | jq -c '.narrations[]')

DOWNLOADED=0
SKIPPED=0

while IFS= read -r narration; do
  book_id=$(echo "$narration" | jq -r '.bookId')
  lang=$(echo "$narration" | jq -r '.language')
  download_url=$(echo "$narration" | jq -r '.downloadUrl')
  narr_id=$(echo "$narration" | jq -r '.id')

  # Apply filters
  if [[ -n "$FILTER_BOOK" && "$book_id" != "$FILTER_BOOK" ]]; then
    continue
  fi
  if [[ -n "$FILTER_LANG" && "$lang" != "$FILTER_LANG" ]]; then
    continue
  fi

  # Find local pack dir
  pack_dir="${BOOK_DIRS[$book_id]:-}"
  if [[ -z "$pack_dir" ]]; then
    echo "  WARN: No local pack found for bookId=$book_id, skipping $narr_id"
    continue
  fi

  audio_dest="$pack_dir/audio/$lang"

  # Skip if audio dir already has files
  if [[ -d "$audio_dest" ]] && ls "$audio_dest"/*.m4a &>/dev/null; then
    echo "  skip $narr_id (already hydrated)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "  downloading $narr_id..."
  zip_path="$TMPDIR_BASE/${narr_id}.zip"
  curl -sS -o "$zip_path" "$download_url"

  # Extract only audio files
  mkdir -p "$audio_dest"
  extract_dir="$TMPDIR_BASE/${narr_id}"
  mkdir -p "$extract_dir"
  unzip -q -o "$zip_path" "audio/${lang}/*" -d "$extract_dir" 2>/dev/null || true

  # Move extracted audio files to pack dir
  if [[ -d "$extract_dir/audio/$lang" ]]; then
    cp "$extract_dir/audio/$lang"/*.m4a "$audio_dest/" 2>/dev/null || true
    file_count=$(ls "$audio_dest"/*.m4a 2>/dev/null | wc -l)
    echo "    → $file_count files → $audio_dest"
    DOWNLOADED=$((DOWNLOADED + 1))
  else
    echo "    WARN: no audio/$lang/ found in ZIP"
  fi

  # Clean up this ZIP
  rm -rf "$zip_path" "$extract_dir"
done <<< "$NARRATIONS"

echo ""
echo "Hydration complete: $DOWNLOADED downloaded, $SKIPPED skipped (already present)."
