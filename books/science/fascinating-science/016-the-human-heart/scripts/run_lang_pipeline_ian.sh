#!/usr/bin/env bash
# Heart pipeline for the IAN pack (ian-chatterbox-v1, voice-id ian-chill-clear).
# Mirrors run_lang_pipeline.sh (the august variant) but for the ian pack and
# voice. Accepts --skip-generate for langs that are already 100% DONE on disk
# (used to resume fi + hi after the 2026-05-24 crash).
#
# Usage:
#   run_lang_pipeline_ian.sh <lang>                  # full pipeline
#   run_lang_pipeline_ian.sh <lang> --skip-generate  # publish already-done lang
set -euo pipefail

LANG_CODE=${1:?usage: run_lang_pipeline_ian.sh <lang> [--skip-generate]}
SKIP_GENERATE=${2:-}

PACK=/home/skyl/encorpora/books/science/fascinating-science/016-the-human-heart/packs/ian-chatterbox-v1
BIN=/home/skyl/tts_venv/bin
SCRIPTS=/home/skyl/encorpora/books/science/fascinating-science/016-the-human-heart/scripts
VOICE_ID=ian-chill-clear
VERSION=$($BIN/python -c "import json; print(json.load(open('$PACK/manifest.json'))['version'])")
LOG=/tmp/heart_ian_${LANG_CODE}_${VERSION}

mkdir -p "$LOG"
echo "[$(date +%T)] [$LANG_CODE $VERSION] start  pack=$PACK"

# Source segments file
if [ "$LANG_CODE" = "en" ]; then
  SEG_FILE="$PACK/segments.json"
else
  SEG_FILE="$PACK/segments_${LANG_CODE}.json"
fi
test -f "$SEG_FILE" || { echo "missing $SEG_FILE"; exit 1; }

# Pre-flight (skip for EN)
if [ "$LANG_CODE" != "en" ]; then
  echo "[$(date +%T)] [$LANG_CODE] pre-flight"
  $BIN/python - <<PYEOF
import json, re
from pathlib import Path
PACK = Path("$PACK")
en = json.load((PACK / "segments.json").open())
xx = json.load((PACK / f"segments_${LANG_CODE}.json").open())
em = {s['id']: s for s in en['segments']}
xm = {s['id']: s for s in xx['segments']}
assert sorted(em) == sorted(xm), f"id mismatch: en={len(em)} ${LANG_CODE}={len(xm)}"
digit_hits, dash_hits, passthrough = [], [], []
for sid, x in xm.items():
    tts = (x.get('tts') or {}).get('text', '')
    if re.search(r'\d', tts): digit_hits.append(sid)
    if '-' in tts or '—' in tts or '–' in tts: dash_hits.append(sid)
    e_text = em[sid].get('text', '')
    if x.get('text','') == e_text and len(e_text.split()) > 2:
        passthrough.append(sid)
fail = []
if digit_hits:  fail.append(f"digits in tts.text: {digit_hits[:5]}")
if dash_hits:   fail.append(f"dashes in tts.text: {dash_hits[:5]}")
if passthrough: fail.append(f"untranslated passthrough: {passthrough[:5]}")
if fail:
    print("VALIDATION FAILED:")
    for f in fail: print("  ", f)
    raise SystemExit(2)
print(f"  OK: {len(xm)} segs, 0 digits, 0 dashes, 0 untranslated")
PYEOF
fi

if [ "$SKIP_GENERATE" != "--skip-generate" ]; then
  echo "[$(date +%T)] [$LANG_CODE] generate"
  $BIN/ttsctl generate "$PACK" --lang "$LANG_CODE" --device cuda > "$LOG/gen.log" 2>&1
  $BIN/ttsctl status "$PACK" 2>&1 | tail -8 | tee "$LOG/status_after_gen.txt"
else
  echo "[$(date +%T)] [$LANG_CODE] generate SKIPPED (already-DONE resume)"
fi

echo "[$(date +%T)] [$LANG_CODE] polish"
$BIN/ttsctl polish "$PACK" --lang "$LANG_CODE" > "$LOG/polish.log" 2>&1 || true
grep -E "Result|fixed|errors|clean" "$LOG/polish.log" | tail -3 || true

echo "[$(date +%T)] [$LANG_CODE] post_generate_fixup"
$BIN/python "$SCRIPTS/post_generate_fixup.py" "$PACK" "$LANG_CODE" > "$LOG/fixup.log" 2>&1
grep -E "realigned|onset-patch" "$LOG/fixup.log" | tail -5 || true

echo "[$(date +%T)] [$LANG_CODE] master --all"
$BIN/ttsctl master "$PACK" --lang "$LANG_CODE" --all > "$LOG/master.log" 2>&1
tail -3 "$LOG/master.log"

echo "[$(date +%T)] [$LANG_CODE] declick-regen"
$BIN/python /home/skyl/projects/ttsctl/scripts/declick_regen.py \
  "$PACK" "$LANG_CODE" --max-retries 3 --device cuda > "$LOG/declick.log" 2>&1 || true
grep -E "baseline|clean after|fallback|WARNING" "$LOG/declick.log" | tail -10 || true

echo "[$(date +%T)] [$LANG_CODE] audit"
$BIN/ttsctl audit "$PACK" --lang "$LANG_CODE" > "$LOG/audit.log" 2>&1 || true
tail -3 "$LOG/audit.log"

echo "[$(date +%T)] [$LANG_CODE] publish (voice-id=$VOICE_ID version=$VERSION)"
$BIN/ttsctl publish "$PACK" --lang "$LANG_CODE" --voice-id "$VOICE_ID" --tier public > "$LOG/publish.log" 2>&1
tail -5 "$LOG/publish.log"

echo "[$(date +%T)] [$LANG_CODE] patch-catalog"
( cd /home/skyl/encorpora/corpan/infra && $BIN/python patch-catalog.py ) > "$LOG/patch.log" 2>&1
tail -3 "$LOG/patch.log"

# Verify on CDN
echo "[$(date +%T)] [$LANG_CODE] catalog verify"
PRESENT=$($BIN/python <<PYEOF
import urllib.request, json
c = json.load(urllib.request.urlopen("https://d38iwc9748jekz.cloudfront.net/catalog-v2.json"))
key = "narrations" if "narrations" in c else "packs"
hits = [n for n in c[key]
        if "book_science_heart" in str(n.get("bookId",""))
        and n.get("language", n.get("lang")) == "${LANG_CODE}"
        and n.get("voiceId") == "$VOICE_ID"]
if hits:
    print(f"yes  v={hits[0].get('version')}")
else:
    print("no")
PYEOF
)
echo "  CDN: $PRESENT"

echo "[$(date +%T)] [$LANG_CODE $VERSION] DONE"
