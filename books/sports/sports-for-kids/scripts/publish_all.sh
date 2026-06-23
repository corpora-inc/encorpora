#!/usr/bin/env bash
# Publish the 3 Sports for Kids books serially (avoiding the catalog-write
# race condition the catalog-remaster pass hit). Then patch-catalog once.
set -u

BIN=/home/skyl/tts_venv/bin
SERIES=/home/skyl/encorpora/books/sports/sports-for-kids
PATCH_CATALOG=/home/skyl/encorpora/corpan/infra/patch-catalog.py
ROOT_LOG=/tmp/sfk_publish_$(date +%s).log

declare -a PACKS=(
  "$SERIES/01-baseball/packs/ryan-chatterbox-v1:ryan"
  "$SERIES/02-gymnastics/packs/isabelle-chatterbox-v1:isabelle"
  "$SERIES/03-cheerleading/packs/avery-chatterbox-v1:avery"
)

echo "[$(date +%T)] Publishing 3 Sports for Kids books serially" | tee "$ROOT_LOG"

for entry in "${PACKS[@]}"; do
  PACK="${entry%%:*}"
  VID="${entry##*:}"
  NAME=$(basename "$PACK")
  LOG=/tmp/sfk_publish_${VID}.log
  echo "[$(date +%T)] ===== publish $NAME (voice-id=$VID) =====" | tee -a "$ROOT_LOG"
  $BIN/ttsctl publish "$PACK" --lang en --voice-id "$VID" --tier public --new-voice > "$LOG" 2>&1
  if grep -q "published successfully" "$LOG"; then
    echo "[$(date +%T)] [$NAME] OK" | tee -a "$ROOT_LOG"
    grep -E "ZIP:|SHA256:|URL:" "$LOG" | head -3 | tee -a "$ROOT_LOG"
  else
    echo "[$(date +%T)] [$NAME] FAIL — log:" | tee -a "$ROOT_LOG"
    tail -15 "$LOG" | tee -a "$ROOT_LOG"
  fi
done

echo "[$(date +%T)] ===== patch-catalog =====" | tee -a "$ROOT_LOG"
( cd /home/skyl/encorpora/corpan/infra && $BIN/python patch-catalog.py ) > /tmp/sfk_patch_catalog.log 2>&1
echo "patch-catalog exit=$?" | tee -a "$ROOT_LOG"
tail -10 /tmp/sfk_patch_catalog.log | tee -a "$ROOT_LOG"

echo "[$(date +%T)] DONE" | tee -a "$ROOT_LOG"
