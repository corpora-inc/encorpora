#!/usr/bin/env bash
# Run a single language end-to-end through the post-EN pipeline for The Human Heart.
# Assumes: codex (or other translator) has produced segments_<lang>.json (or EN already present)
# Does:  validate → generate → polish → fixup → master --all → declick-regen → audit → publish → patch-catalog
#
# Usage:  run_lang_pipeline.sh <lang>
#         run_lang_pipeline.sh en
set -euo pipefail

LANG_CODE=${1:?usage: run_lang_pipeline.sh <lang>}

PACK=/home/skyl/encorpora/books/science/fascinating-science/016-the-human-heart/packs/august-chatterbox-v1
BIN=/home/skyl/tts_venv/bin
SCRIPTS=/home/skyl/encorpora/books/science/fascinating-science/016-the-human-heart/scripts
VERSION=$($BIN/python -c "import json; print(json.load(open('$PACK/manifest.json'))['version'])")
LOG=/tmp/heart_${LANG_CODE}_${VERSION}

mkdir -p "$LOG"
echo "[$(date +%T)] [$LANG_CODE $VERSION] start"

# EN reads from segments.json; other langs read from segments_<lang>.json
if [ "$LANG_CODE" = "en" ]; then
  SEG_FILE="$PACK/segments.json"
else
  SEG_FILE="$PACK/segments_${LANG_CODE}.json"
fi
test -f "$SEG_FILE" || { echo "missing $SEG_FILE"; exit 1; }

# Pre-flight: id match, no digits, no dashes, no passthrough (skip for EN)
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
digit_hits = []
dash_hits = []
passthrough = []
for sid, x in xm.items():
    tts = (x.get('tts') or {}).get('text', '')
    if re.search(r'\d', tts): digit_hits.append(sid)
    if '-' in tts or '—' in tts or '–' in tts: dash_hits.append(sid)
    e_text = em[sid].get('text', '')
    if x.get('text','') == e_text and len(e_text.split()) > 2:
        passthrough.append(sid)
fail = []
if digit_hits:    fail.append(f"digits in tts.text: {digit_hits[:5]}")
if dash_hits:     fail.append(f"dashes in tts.text: {dash_hits[:5]}")
if passthrough:   fail.append(f"untranslated passthrough: {passthrough[:5]}")
if fail:
    print("VALIDATION FAILED:")
    for f in fail: print("  ", f)
    raise SystemExit(2)
print(f"  OK: {len(xm)} segs, 0 digits, 0 dashes, 0 untranslated")
PYEOF
fi

echo "[$(date +%T)] [$LANG_CODE] generate"
$BIN/ttsctl generate "$PACK" --lang "$LANG_CODE" --device cuda > "$LOG/gen.log" 2>&1
$BIN/ttsctl status "$PACK" 2>&1 | tail -8 | tee "$LOG/status_after_gen.txt"

echo "[$(date +%T)] [$LANG_CODE] polish"
$BIN/ttsctl polish "$PACK" --lang "$LANG_CODE" > "$LOG/polish.log" 2>&1
grep -E "Result|fixed|errors|clean" "$LOG/polish.log" | tail -3 || true

echo "[$(date +%T)] [$LANG_CODE] post_generate_fixup"
$BIN/python "$SCRIPTS/post_generate_fixup.py" "$PACK" "$LANG_CODE" > "$LOG/fixup.log" 2>&1
grep -E "realigned|onset-patch" "$LOG/fixup.log" | tail -5 || true

echo "[$(date +%T)] [$LANG_CODE] master --all"
$BIN/ttsctl master "$PACK" --lang "$LANG_CODE" --all > "$LOG/master.log" 2>&1
tail -3 "$LOG/master.log"

echo "[$(date +%T)] [$LANG_CODE] declick-regen"
$BIN/python /home/skyl/projects/ttsctl/scripts/declick_regen.py \
  "$PACK" "$LANG_CODE" --max-retries 3 --device cuda > "$LOG/declick.log" 2>&1
grep -E "baseline|clean after|fallback|WARNING" "$LOG/declick.log" | tail -10 || true

echo "[$(date +%T)] [$LANG_CODE] audit"
$BIN/ttsctl audit "$PACK" --lang "$LANG_CODE" > "$LOG/audit.log" 2>&1
tail -3 "$LOG/audit.log"

echo "[$(date +%T)] [$LANG_CODE] publish"
$BIN/ttsctl publish "$PACK" --lang "$LANG_CODE" --voice-id august --tier public > "$LOG/publish.log" 2>&1
tail -5 "$LOG/publish.log"

echo "[$(date +%T)] [$LANG_CODE] patch-catalog"
( cd /home/skyl/encorpora/corpan/infra && $BIN/python patch-catalog.py ) > "$LOG/patch.log" 2>&1
tail -3 "$LOG/patch.log"

# Verify the just-published narration is actually in the live catalog. The
# wrapper's publish+patch sometimes ends with the new entry missing (race or
# silent S3 write failure) — when that happens we manually upsert and re-patch.
NID="science-heart-august-${LANG_CODE}"
echo "[$(date +%T)] [$LANG_CODE] catalog-verify ($NID)"
PRESENT=$($BIN/python <<PYEOF
import os, boto3, json
from dotenv import load_dotenv; from pathlib import Path
load_dotenv(Path.home() / ".env")
ak = os.environ.get("AWS_ACCESS_KEY_ID") or os.environ.get("AWS_ACCESS_KEY")
sk = os.environ.get("AWS_SECRET_ACCESS_KEY")
s3 = boto3.client("s3", region_name="us-east-2", aws_access_key_id=ak, aws_secret_access_key=sk)
o = s3.get_object(Bucket="corpan-prod", Key="artifacts/catalog-v2.json")
cat = json.loads(o["Body"].read())
print("yes" if any(n.get("id")=="$NID" for n in cat.get("narrations",[])) else "no")
PYEOF
)
if [ "$PRESENT" != "yes" ]; then
  echo "  WARNING: $NID missing from catalog — running manual upsert + re-patch"
  $BIN/python /home/skyl/projects/ttsctl/scripts/upsert_narration.py \
    "$PACK" "$LANG_CODE" --voice-id august --version "$VERSION" >> "$LOG/patch.log" 2>&1 || true
  ( cd /home/skyl/encorpora/corpan/infra && $BIN/python patch-catalog.py ) >> "$LOG/patch.log" 2>&1
fi

echo "[$(date +%T)] [$LANG_CODE $VERSION] DONE"
