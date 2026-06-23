#!/usr/bin/env bash
# Run the remaining 7 langs (fa, ta, te, id, vi, th, uk) sequentially.
# Skips ur — deferred pending decision (Whisper auto-detect can't distinguish
# Hindustani ur/hi; 48/82 segments hit language_leak on Ron voice).
# bn already shipped, ur in unresolved state.
set -u

SCRIPT=/home/skyl/encorpora/books/literature/tolstoy-short-stories/three-questions/scripts/run_lang_pipeline.sh
LANGS=(fa ta te id vi th uk)
ROOT_LOG=/tmp/tq_seven_$(date +%s).log

echo "[$(date +%T)] Seven-lang run starting: ${LANGS[*]}" | tee "$ROOT_LOG"

for L in "${LANGS[@]}"; do
  PER_LOG=/tmp/tq_${L}_run.log
  echo "[$(date +%T)] ===== START $L =====" | tee -a "$ROOT_LOG"
  "$SCRIPT" "$L" > "$PER_LOG" 2>&1
  STATUS=$?
  if [ $STATUS -eq 0 ]; then
    echo "[$(date +%T)] ===== DONE $L =====" | tee -a "$ROOT_LOG"
  else
    echo "[$(date +%T)] ===== FAILED $L (exit=$STATUS) =====" | tee -a "$ROOT_LOG"
    tail -25 "$PER_LOG" | sed "s/^/    /" | tee -a "$ROOT_LOG"
  fi
done

echo "[$(date +%T)] Seven-lang run finished" | tee -a "$ROOT_LOG"
