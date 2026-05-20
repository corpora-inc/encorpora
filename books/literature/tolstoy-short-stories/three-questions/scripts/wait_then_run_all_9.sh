#!/usr/bin/env bash
# Wait for the image-gen process to release GPU, then run all 9 langs.
# Bengali's GENERATE step already finished (81 m4as on disk), so re-running
# run_lang_pipeline.sh bn will idempotently skip generate and resume from polish.
set -u

IMAGE_GEN_PID=2847983
SCRIPT=/home/skyl/encorpora/books/literature/tolstoy-short-stories/three-questions/scripts/run_lang_pipeline.sh
LANGS=(bn ur fa ta te id vi th uk)
ROOT_LOG=/tmp/tq_all9_$(date +%s).log

echo "[$(date +%T)] Waiting for image-gen PID=$IMAGE_GEN_PID to exit..." | tee "$ROOT_LOG"
while kill -0 "$IMAGE_GEN_PID" 2>/dev/null; do
  sleep 10
done
echo "[$(date +%T)] GPU free. Pausing 15s for memory release." | tee -a "$ROOT_LOG"
sleep 15

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

echo "[$(date +%T)] All-9 run finished" | tee -a "$ROOT_LOG"
echo "Per-lang logs: /tmp/tq_<lang>_run.log"
echo "Root log: $ROOT_LOG"
