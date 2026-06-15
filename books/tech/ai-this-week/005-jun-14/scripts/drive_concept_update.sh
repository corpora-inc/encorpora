#!/usr/bin/env bash
# Sequentially apply the concept-of-the-week swap (MoE -> neural audio codecs)
# to the remaining already-shipped languages. Serial = no catalog-write races.
# es is handled separately as the pilot. Progress -> /tmp/ep3_concept_drive.log
set -uo pipefail
EP=/home/skyl/encorpora/books/tech/ai-this-week/003-may-27
VER="${1:-0.1.1}"
PROG=/tmp/ep3_concept_drive.log
LANGS=(es de pt it nl pl tr ru zh ko hi ar)
echo "=== concept-update driver start $(date -u +%FT%TZ) — ${#LANGS[@]} langs ===" | tee -a "$PROG"
DONE=(); FAIL=()
for L in "${LANGS[@]}"; do
  echo ">>> $L $(date -u +%FT%TZ)" | tee -a "$PROG"
  bash "$EP/scripts/update_concept_lang.sh" "$L" "$VER"
  if [ $? -eq 0 ]; then DONE+=("$L"); echo "    [$L] OK" | tee -a "$PROG"
  else FAIL+=("$L"); echo "    [$L] FAILED" | tee -a "$PROG"; fi
done
echo "=== concept-update driver DONE $(date -u +%FT%TZ) ===" | tee -a "$PROG"
echo "UPDATED (${#DONE[@]}): ${DONE[*]}" | tee -a "$PROG"
echo "FAILED  (${#FAIL[@]}): ${FAIL[*]}" | tee -a "$PROG"
