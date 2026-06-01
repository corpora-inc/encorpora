#!/usr/bin/env bash
# Drive the Ep3 language fan-out sequentially (race-free: publish + patch-catalog
# are serialized because only one pipeline runs at a time). Continues past any
# language that drops/fails. Economic-power order; en + zh already shipped.
# Progress -> /tmp/ep3_drive.log ; per-lang detail -> /tmp/ep3_<lang>/.
set -uo pipefail
EP=/home/skyl/encorpora/books/tech/ai-this-week/003-may-27
VERSION="${1:-0.1.0}"
PROG=/tmp/ep3_drive.log

LANGS=(es ar fr de pt hi ja ru it ko nl tr pl id sv vi th he da no fi el cs ro hu uk sk hr bg sl lt sr fa ms ca sw ta te ur bn gu kn mr ne fil lv et yue-Hant-HK)

echo "=== Ep3 fan-out driver start $(date -u +%FT%TZ) — ${#LANGS[@]} languages ===" | tee -a "$PROG"
SHIPPED=(); DROPPED=()
CDN="https://d38iwc9748jekz.cloudfront.net"
for L in "${LANGS[@]}"; do
  # Resumable: skip languages already live on the CDN.
  LIVE=$(curl -s --max-time 25 "$CDN/catalog-v2.json?cb=$(date +%s)" 2>/dev/null | /home/skyl/tts_venv/bin/python -c "
import json,sys
try: d=json.load(sys.stdin)
except: print('ERR'); sys.exit()
print('YES' if any(n.get('bookId')=='book_ai_this_week_2026_05_27' and n.get('language')=='$L' for n in d['narrations']) else 'NO')" 2>/dev/null)
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
echo "=== Ep3 fan-out driver DONE $(date -u +%FT%TZ) ===" | tee -a "$PROG"
echo "SHIPPED (${#SHIPPED[@]}): ${SHIPPED[*]}" | tee -a "$PROG"
echo "DROPPED (${#DROPPED[@]}): ${DROPPED[*]}" | tee -a "$PROG"
