#!/usr/bin/env bash
# Run the remaining 8 langs sequentially after Bengali smoke test passes.
# Sequential because Whisper align() is not thread-safe (per
# feedback_whisper_align_not_thread_safe.md) and patch-catalog.py
# concurrent writes would race.
set -u  # do not -e: keep going on a single failed lang so we publish whatever works

SCRIPT=/home/skyl/encorpora/books/literature/tolstoy-short-stories/three-questions/scripts/run_lang_pipeline.sh
LANGS=(ur fa ta te id vi th uk)
ROOT_LOG=/tmp/tq_fanout_$(date +%s).log

echo "[$(date +%T)] Fanout starting: ${LANGS[*]}" | tee "$ROOT_LOG"

for L in "${LANGS[@]}"; do
  PER_LOG=/tmp/tq_${L}_fanout.log
  echo "[$(date +%T)] ===== START $L =====" | tee -a "$ROOT_LOG"
  "$SCRIPT" "$L" > "$PER_LOG" 2>&1
  STATUS=$?
  if [ $STATUS -eq 0 ]; then
    echo "[$(date +%T)] ===== DONE $L =====" | tee -a "$ROOT_LOG"
    tail -5 "$PER_LOG" | sed "s/^/    /" | tee -a "$ROOT_LOG"
  else
    echo "[$(date +%T)] ===== FAILED $L (exit=$STATUS) =====" | tee -a "$ROOT_LOG"
    tail -20 "$PER_LOG" | sed "s/^/    /" | tee -a "$ROOT_LOG"
  fi
done

echo "[$(date +%T)] Fanout finished" | tee -a "$ROOT_LOG"
echo "Per-lang logs: /tmp/tq_<lang>_fanout.log"
echo "Root log: $ROOT_LOG"
