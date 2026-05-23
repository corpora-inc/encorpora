#!/usr/bin/env bash
# Build one raw capture into the four delivery variants.
#
#   build-capture.sh <path-to-raw.mov>
#
# Conventions:
#   raw lives at  <root>/raw/YYYY-MM-DD/<slug>.mov     (+ <slug>.meta.json sidecar)
#   built lands at <root>/built/YYYY-MM-DD/<slug>/{long,shorts,square}.mp4 + thumb.jpg + meta.json
#
# The sidecar drives YouTube metadata. If missing, a stub is written and the
# script exits non-zero — fill in title/description/tags, then re-run.
#
# Color note: iPad screen recordings come out as yuvj420p (JPEG full-range)
# tagged BT.709. Every encode here converts to yuv420p limited-range so the
# result doesn't look washed out on YouTube or Safari.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <raw.mov> [--variants long,shorts,square,thumb]" >&2
  exit 2
fi

RAW="$1"
shift || true

VARIANTS="long,shorts,square,thumb"
while [ $# -gt 0 ]; do
  case "$1" in
    --variants) VARIANTS="$2"; shift 2 ;;
    --variants=*) VARIANTS="${1#*=}"; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [ ! -f "$RAW" ]; then
  echo "error: not a file: $RAW" >&2
  exit 2
fi

# Resolve absolute path
RAW="$(cd "$(dirname "$RAW")" && pwd)/$(basename "$RAW")"

# Tool checks
for t in ffmpeg ffprobe jq sha256sum; do
  if ! command -v "$t" >/dev/null 2>&1; then
    if [ "$t" = "sha256sum" ] && command -v shasum >/dev/null 2>&1; then
      continue  # we'll fall back to `shasum -a 256`
    fi
    echo "error: required tool not found: $t" >&2
    exit 2
  fi
done

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

# Derive paths
SLUG="$(basename "$RAW" .mov)"
SLUG="$(basename "$SLUG" .MOV)"
RAW_DIR="$(dirname "$RAW")"
DATE_DIR="$(basename "$RAW_DIR")"      # e.g. 2026-05-17
CAPTURES_ROOT="$(dirname "$(dirname "$RAW_DIR")")"  # strip raw/<date>
BUILT_DIR="$CAPTURES_ROOT/built/$DATE_DIR/$SLUG"
SIDECAR="$RAW_DIR/$SLUG.meta.json"

# Sanity: the dir name must be a YYYY-MM-DD date
if ! [[ "$DATE_DIR" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "error: raw must live under raw/YYYY-MM-DD/, got '$DATE_DIR'" >&2
  exit 2
fi

# Stub sidecar if missing
if [ ! -f "$SIDECAR" ]; then
  cat > "$SIDECAR" <<JSON
{
  "slug": "$SLUG",
  "scene": "(scene — e.g. main-experience, pack-discovery)",
  "country": "(country)",
  "languages": [],
  "captured_at": "$DATE_DIR",
  "device": "ipad-13",
  "app": "corpan",
  "app_version": "(0.x.y)",

  "youtube": {
    "title": "(YOUTUBE TITLE — REQUIRED)",
    "description": "(YOUTUBE DESCRIPTION)",
    "tags": ["corpan"],
    "category_id": 27,
    "default_audio_language": null,
    "default_language": null,
    "privacy": "public",
    "made_for_kids": false,
    "playlist": null,
    "variant_to_upload": "long"
  }
}
JSON
  echo "stubbed sidecar at: $SIDECAR" >&2
  echo "fill in title / description / tags / languages, then re-run." >&2
  exit 1
fi

# Validate sidecar
if ! jq -e '.youtube.title and (.youtube.title != "(YOUTUBE TITLE — REQUIRED)")' "$SIDECAR" >/dev/null; then
  echo "error: $SIDECAR has no youtube.title (or still the stub placeholder)" >&2
  exit 2
fi

mkdir -p "$BUILT_DIR"

# Probe source
PROBE_JSON="$(ffprobe -v error -print_format json -show_format -show_streams "$RAW")"
SRC_DUR="$(jq -r '.format.duration' <<<"$PROBE_JSON")"
SRC_W="$(jq -r '.streams[] | select(.codec_type=="video") | .width' <<<"$PROBE_JSON")"
SRC_H="$(jq -r '.streams[] | select(.codec_type=="video") | .height' <<<"$PROBE_JSON")"
SRC_FPS_RAW="$(jq -r '.streams[] | select(.codec_type=="video") | .avg_frame_rate' <<<"$PROBE_JSON")"
SRC_FPS="$(awk -F/ 'NF==2 && $2>0 {printf "%.2f", $1/$2}' <<<"$SRC_FPS_RAW")"
SRC_HASH="$(sha256 "$RAW")"
FFMPEG_VER="$(ffmpeg -version | head -1 | sed 's/ffmpeg version //; s/ Copyright.*//')"

echo "==> source: ${SRC_W}x${SRC_H} @ ${SRC_FPS} fps, ${SRC_DUR}s"
echo "    built dir: $BUILT_DIR"

# Common audio + color tags
A_OPTS="-c:a aac -b:a 192k -ar 48000 -af loudnorm=I=-14:LRA=11:TP=-1.5"
V_TAGS="-colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart -pix_fmt yuv420p"

want_variant() {
  [[ ",$VARIANTS," == *",$1,"* ]]
}

# 1) long — preserve aspect, just clean range/color
if want_variant long; then
  OUT="$BUILT_DIR/long.mp4"
  echo "==> encoding long.mp4 (${SRC_W}x${SRC_H})"
  ffmpeg -y -hide_banner -loglevel warning -stats \
    -i "$RAW" \
    -vf "scale=${SRC_W}:${SRC_H}:in_range=full:out_range=tv,format=yuv420p" \
    -c:v libx264 -crf 18 -preset slow -profile:v high \
    $V_TAGS $A_OPTS \
    "$OUT"
fi

# 2) shorts — 9:16, blur-pad to 1080x1920, ≤180s (current Shorts ceiling)
#    Bias content upward (y = 25% of total padding from top, 75% from bottom)
#    so Reels/Shorts UI overlays sit on the larger bottom blur band instead
#    of clipping the content.
SHORTS_MAX_SEC=180
SHORTS_TOP_BIAS="${SHORTS_TOP_BIAS:-0.25}"
if want_variant shorts; then
  OUT="$BUILT_DIR/shorts.mp4"
  echo "==> encoding shorts.mp4 (1080x1920, blur-pad, top-bias=$SHORTS_TOP_BIAS)"
  ffmpeg -y -hide_banner -loglevel warning -stats \
    -i "$RAW" \
    -filter_complex "
      [0:v]scale=in_range=full:out_range=tv,format=yuv420p,split=2[bg][fg];
      [bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:1[bgb];
      [fg]scale=1080:-2[fgs];
      [bgb][fgs]overlay=x=(W-w)/2:y=(H-h)*${SHORTS_TOP_BIAS},setsar=1,format=yuv420p
    " \
    -c:v libx264 -crf 19 -preset slow -profile:v high \
    -t $SHORTS_MAX_SEC \
    $V_TAGS $A_OPTS \
    "$OUT"
fi

# 3) square — 1:1, blur-pad to 1080x1080
if want_variant square; then
  OUT="$BUILT_DIR/square.mp4"
  echo "==> encoding square.mp4 (1080x1080, blur-pad)"
  ffmpeg -y -hide_banner -loglevel warning -stats \
    -i "$RAW" \
    -filter_complex "
      [0:v]scale=in_range=full:out_range=tv,format=yuv420p,split=2[bg][fg];
      [bg]scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,boxblur=30:1[bgb];
      [fg]scale=-2:1080[fgs];
      [bgb][fgs]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p
    " \
    -c:v libx264 -crf 19 -preset slow -profile:v high \
    $V_TAGS $A_OPTS \
    "$OUT"
fi

# 4) thumbnail — pick a non-black frame (~10% in, capped at 3s)
if want_variant thumb; then
  TH_SEC="$(awk -v d="$SRC_DUR" 'BEGIN{ x=d*0.1; if(x>3) x=3; if(x<0.5) x=0.5; printf "%.2f", x }')"
  OUT="$BUILT_DIR/thumb.jpg"
  echo "==> grabbing thumb.jpg from t=${TH_SEC}s (1280x720, blur-pad)"
  ffmpeg -y -hide_banner -loglevel warning \
    -ss "$TH_SEC" -i "$RAW" -frames:v 1 -update 1 \
    -filter_complex "
      [0:v]scale=in_range=full:out_range=tv,format=yuv420p,split=2[bg][fg];
      [bg]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,boxblur=30:1[bgb];
      [fg]scale=-2:720[fgs];
      [bgb][fgs]overlay=(W-w)/2:(H-h)/2
    " \
    -q:v 2 \
    "$OUT"
fi

# Manifest: write built/.../meta.json combining sidecar + build details
SIDECAR_JSON="$(cat "$SIDECAR")"
NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

variant_info() {
  local f="$1"
  if [ -f "$f" ]; then
    local size hash dur
    size="$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f")"
    hash="$(sha256 "$f")"
    if [[ "$f" == *.mp4 ]]; then
      dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"
      jq -n --arg path "$(basename "$f")" --arg hash "$hash" --argjson size "$size" --arg dur "$dur" \
        '{path:$path, sha256:$hash, size:$size, duration:($dur|tonumber)}'
    else
      jq -n --arg path "$(basename "$f")" --arg hash "$hash" --argjson size "$size" \
        '{path:$path, sha256:$hash, size:$size}'
    fi
  else
    echo "null"
  fi
}

LONG_INFO="$(variant_info "$BUILT_DIR/long.mp4")"
SHORTS_INFO="$(variant_info "$BUILT_DIR/shorts.mp4")"
SQUARE_INFO="$(variant_info "$BUILT_DIR/square.mp4")"
THUMB_INFO="$(variant_info "$BUILT_DIR/thumb.jpg")"

jq -n \
  --argjson sidecar "$SIDECAR_JSON" \
  --arg built_at "$NOW" \
  --arg ffmpeg "$FFMPEG_VER" \
  --arg source_path "$(basename "$RAW")" \
  --arg source_hash "$SRC_HASH" \
  --arg source_w "$SRC_W" \
  --arg source_h "$SRC_H" \
  --arg source_fps "$SRC_FPS" \
  --arg source_dur "$SRC_DUR" \
  --argjson long "$LONG_INFO" \
  --argjson shorts "$SHORTS_INFO" \
  --argjson square "$SQUARE_INFO" \
  --argjson thumb "$THUMB_INFO" \
  '$sidecar + {
     built_at: $built_at,
     ffmpeg_version: $ffmpeg,
     source: {
       path: $source_path,
       sha256: $source_hash,
       width: ($source_w|tonumber),
       height: ($source_h|tonumber),
       fps: ($source_fps|tonumber),
       duration: ($source_dur|tonumber)
     },
     variants: {
       long: $long,
       shorts: $shorts,
       square: $square,
       thumb: $thumb
     }
   }' > "$BUILT_DIR/meta.json"

echo "==> wrote manifest: $BUILT_DIR/meta.json"
echo "OK"
