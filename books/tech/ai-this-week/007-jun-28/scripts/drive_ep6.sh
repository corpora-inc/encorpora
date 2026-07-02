#!/usr/bin/env bash
# Drive the Ep6 (2026-06-21) language fan-out sequentially. Race-free: publish +
# patch-catalog are serialized because only one pipeline runs at a time. Continues
# past any language that drops/fails. Resumable: skips languages already live on CDN.
# Economic-power order; en + first 19 already shipped, ja/th may be finishing.
# Progress -> /tmp/ep6_drive.log ; per-lang detail -> /tmp/ep6_<lang>/.
set -uo pipefail
EP=/home/skyl/encorpora/books/tech/ai-this-week/006-jun-21
VERSION="${1:-0.1.0}"
PROG=/tmp/ep6_drive.log
BOOKID=book_ai_this_week_2026_06_21
CDN="https://d38iwc9748jekz.cloudfront.net"
PY=/home/skyl/tts_venv/bin/python

# Full 50-lang target (ep5 parity). Resumable skip handles the already-live ones.
LANGS=(es zh ar fr de pt hi ja ru it ko nl tr pl id sv vi th he da no \
       fi el cs ro hu uk sk hr bg sl lt sr fa ms ca sw ta te ur bn gu kn mr ne fil lv et yue-Hant-HK)

# Guard: wait until any individually-launched in-flight pipeline (ja/th) clears,
# so its publish + patch-catalog can't race with this driver's first publish.
wait_for_inflight() {
  while pgrep -f "006-jun-21/packs/vindy-ron-gemini-v1 --lang" >/dev/null 2>&1 \
     || pgrep -f "infra && .*patch-catalog.py" >/dev/null 2>&1; do
    echo "    [guard] in-flight pipeline running — waiting 30s…" | tee -a "$PROG"
    sleep 30
  done
}

echo "=== Ep6 fan-out driver start $(date -u +%FT%TZ) — ${#LANGS[@]} languages ===" | tee -a "$PROG"
wait_for_inflight
SHIPPED=(); DROPPED=()
for L in "${LANGS[@]}"; do
  LIVE=$(curl -s --max-time 25 "$CDN/catalog-v2.json?cb=$(date +%s)" 2>/dev/null | $PY -c "
import json,sys
try: d=json.load(sys.stdin)
except: print('ERR'); sys.exit()
print('YES' if any(n.get('bookId')=='$BOOKID' and n.get('language')=='$L' for n in d['narrations']) else 'NO')" 2>/dev/null)
  if [ "$LIVE" = "YES" ]; then echo "    [$L] already live — skip" | tee -a "$PROG"; SHIPPED+=("$L"); continue; fi
  echo ">>> $L  ($(date -u +%FT%TZ))" | tee -a "$PROG"
  bash "$EP/scripts/run_lang_pipeline.sh" "$L" "$VERSION"
  rc=$?
  if [ $rc -eq 0 ]; then
    SHIPPED+=("$L"); echo "    [$L] SHIPPED" | tee -a "$PROG"
  else
    DROPPED+=("$L (rc=$rc)"); echo "    [$L] DROPPED/FAILED rc=$rc" | tee -a "$PROG"
  fi
done
echo "=== Ep6 fan-out driver DONE $(date -u +%FT%TZ) ===" | tee -a "$PROG"
echo "SHIPPED (${#SHIPPED[@]}): ${SHIPPED[*]}" | tee -a "$PROG"
echo "DROPPED (${#DROPPED[@]}): ${DROPPED[*]}" | tee -a "$PROG"
