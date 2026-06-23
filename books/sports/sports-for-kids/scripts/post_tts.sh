#!/usr/bin/env bash
# Run the post-TTS pipeline for each Sports for Kids book sequentially:
# polish → post_generate_fixup → master --all → audit
# Whisper align is not thread-safe (see feedback_whisper_align_not_thread_safe.md)
# so serial across books.
set -u

BIN=/home/skyl/tts_venv/bin
PYTHON="$BIN/python"
SERIES=/home/skyl/encorpora/books/sports/sports-for-kids

# Use the train book's post_generate_fixup.py as the canonical script.
FIXUP=/home/skyl/encorpora/books/vehicles/vehicles-of-the-world/01-the-story-of-the-train/scripts/post_generate_fixup.py

declare -a PACKS=(
  "$SERIES/01-baseball/packs/ryan-chatterbox-v1"
  "$SERIES/02-gymnastics/packs/isabelle-chatterbox-v1"
  "$SERIES/03-cheerleading/packs/avery-chatterbox-v1"
)

ROOT_LOG=/tmp/sfk_post_tts_$(date +%s).log
echo "[$(date +%T)] Starting post-TTS pipeline for ${#PACKS[@]} packs" | tee "$ROOT_LOG"

for PACK in "${PACKS[@]}"; do
  NAME=$(basename "$PACK")
  echo "[$(date +%T)] ===== $NAME =====" | tee -a "$ROOT_LOG"

  STEP_LOG=/tmp/sfk_${NAME}_post.log
  : > "$STEP_LOG"

  echo "[$(date +%T)] [$NAME] polish" | tee -a "$ROOT_LOG"
  $BIN/ttsctl polish "$PACK" --lang en >> "$STEP_LOG" 2>&1
  grep -E "Result|fixed|errors" "$STEP_LOG" | tail -3 | tee -a "$ROOT_LOG" || true

  echo "[$(date +%T)] [$NAME] post_generate_fixup" | tee -a "$ROOT_LOG"
  $PYTHON "$FIXUP" "$PACK" en >> "$STEP_LOG" 2>&1
  grep -E "realigned|onset-patch" "$STEP_LOG" | tail -5 | tee -a "$ROOT_LOG" || true

  echo "[$(date +%T)] [$NAME] master --all" | tee -a "$ROOT_LOG"
  $BIN/ttsctl master "$PACK" --lang en --all >> "$STEP_LOG" 2>&1
  tail -3 "$STEP_LOG" | tee -a "$ROOT_LOG"

  echo "[$(date +%T)] [$NAME] audit" | tee -a "$ROOT_LOG"
  $BIN/ttsctl audit "$PACK" --lang en >> "$STEP_LOG" 2>&1
  tail -3 "$STEP_LOG" | tee -a "$ROOT_LOG"
done

echo "[$(date +%T)] All post-TTS steps complete" | tee -a "$ROOT_LOG"
echo "Per-pack step logs: /tmp/sfk_<pack>_post.log"
echo "Root log: $ROOT_LOG"
