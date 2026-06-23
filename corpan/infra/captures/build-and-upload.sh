#!/usr/bin/env bash
# Convenience wrapper:  build-capture.sh <raw.mov>  →  corpan-yt upload <built-dir>
#
# Usage:
#   ./corpan/infra/captures/build-and-upload.sh <raw.mov> [--no-upload] [--variant long|shorts|square] [--dry-run]
#
# Always builds locally. Skips the YouTube upload step if --no-upload is set
# (useful when you've already burned your videos.insert quota for the day —
# the captures still get the full variant build + can be synced to S3).

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <raw.mov> [--no-upload] [--variant long|shorts|square] [--dry-run]" >&2
  exit 2
fi

RAW="$1"; shift || true

NO_UPLOAD=0
EXTRA_ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --no-upload) NO_UPLOAD=1; shift ;;
    --variant) EXTRA_ARGS+=(--variant "$2"); shift 2 ;;
    --variant=*) EXTRA_ARGS+=(--variant "${1#*=}"); shift ;;
    --dry-run) EXTRA_ARGS+=(--dry-run); shift ;;
    --privacy) EXTRA_ARGS+=(--privacy "$2"); shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

HERE="$(cd "$(dirname "$0")" && pwd)"

# 1) Build
"$HERE/build-capture.sh" "$RAW"

# 2) Derive built dir
RAW_ABS="$(cd "$(dirname "$RAW")" && pwd)/$(basename "$RAW")"
SLUG="$(basename "$RAW_ABS" .mov)"
SLUG="$(basename "$SLUG" .MOV)"
DATE_DIR="$(basename "$(dirname "$RAW_ABS")")"
CAPTURES_ROOT="$(dirname "$(dirname "$(dirname "$RAW_ABS")")")"
BUILT_DIR="$CAPTURES_ROOT/built/$DATE_DIR/$SLUG"

if [ ! -d "$BUILT_DIR" ]; then
  echo "error: expected built dir not found: $BUILT_DIR" >&2
  exit 2
fi

if [ "$NO_UPLOAD" -eq 1 ]; then
  echo "==> --no-upload set; skipping YouTube step."
  echo "    built: $BUILT_DIR"
  exit 0
fi

# 3) Upload via corpan-yt (venv-installed in youtube/.venv)
YT_BIN="$HERE/youtube/.venv/bin/corpan-yt"
if [ ! -x "$YT_BIN" ]; then
  echo "error: corpan-yt not found at $YT_BIN — run:" >&2
  echo "  cd $HERE/youtube && python3 -m venv .venv && .venv/bin/pip install -e ." >&2
  exit 2
fi

echo "==> uploading via corpan-yt"
"$YT_BIN" upload "$BUILT_DIR" "${EXTRA_ARGS[@]}"
