#!/usr/bin/env bash
# Recovery driver for Ep4 fan-out drops.
# Phase 1: rewrite-then-rerun for 10 single-segment-stuck langs
#          (de, th, fi, sk, ms, te, bn, mr, ro, gu) — fixup_short_reactions.py
#          must have run first.
# Phase 2: re-translate-then-run for 4 translate-gate drops
#          (hi, ko, uk, yue-Hant-HK).
# Skips: ne (5 simultaneous failures, voice fundamentally struggles
#        with Nepali — leave dropped).
#
# Logs to /tmp/ep4_recover_<lang>/. Uses the per-language pipeline
# script for the bulk work.
set -uo pipefail
EP=/home/skyl/encorpora/books/tech/ai-this-week/004-jun-03
PACK="$EP/packs/vindy-ron-gemini-v1"
PY=/home/skyl/tts_venv/bin/python
PROG=/tmp/ep4_recover.log
CDN="https://d38iwc9748jekz.cloudfront.net"

# Load API + cloud creds
set -a; export $(grep -v '^#' ~/.env 2>/dev/null | grep -E 'GOOGLE_CLOUD|ANTHROPIC|OPENAI|AWS_|GEMINI' | xargs) 2>/dev/null; set +a
export TTSCTL_BUDGET_OK=1

# Phase 1: rewrite-then-rerun (per-lang, only need to regen the rewritten
# segments + master + audio_gate + publish + patch-catalog).
PHASE1_LANGS=(de th fi sk ms te bn mr ro gu)
declare -A PHASE1=(
  [de]="ch00-093"
  [th]="ch00-068"
  [fi]="ch00-178"
  [sk]="ch00-068"
  [ms]="ch00-068"
  [te]="ch00-116"
  [bn]="ch00-116"
  [mr]="ch00-093"
  [ro]="ch00-101"
  [gu]="ch00-061"
)

echo "=== Ep4 recovery start $(date -u +%FT%TZ) ===" | tee -a "$PROG"

for L in "${PHASE1_LANGS[@]}"; do
  S="${PHASE1[$L]}"
  LOG="/tmp/ep4_recover_${L}"; mkdir -p "$LOG"
  echo ">>> phase1 [$L] reset+regen $S" | tee -a "$PROG"

  $PY "$EP/scripts/reset_segments.py" "$PACK" "$L" "$S" >> "$LOG/recover.log" 2>&1

  ttsctl generate "$PACK" --lang "$L" >> "$LOG/recover.log" 2>&1
  GEN=$?

  if [ $GEN -ne 0 ]; then
    echo "    [$L] gen still failing" | tee -a "$PROG"; continue
  fi

  ttsctl master "$PACK" --lang "$L" --all >> "$LOG/recover.log" 2>&1
  $PY "$EP/scripts/audio_gate.py" "$PACK" "$L" >> "$LOG/recover.log" 2>&1
  if [ $? -ne 0 ]; then echo "    [$L] audio gate fail" | tee -a "$PROG"; continue; fi

  ttsctl publish "$PACK" --lang "$L" --voice-id gemini-vindy --version 0.1.0 --with-preview >> "$LOG/recover.log" 2>&1
  if [ $? -ne 0 ]; then echo "    [$L] publish fail" | tee -a "$PROG"; continue; fi

  echo "    [$L] SHIPPED" | tee -a "$PROG"
done

# Patch catalog once after the phase-1 batch.
( cd /home/skyl/encorpora/corpan/infra && $PY patch-catalog.py >> "$PROG" 2>&1 )

# Phase 2: re-translate the translate-gate drops via the full driver.
# They each get a fresh translate attempt then full pipeline.
PHASE2=(hi ko uk yue-Hant-HK)
for L in "${PHASE2[@]}"; do
  echo ">>> phase2 [$L] full pipeline retry" | tee -a "$PROG"
  # clear any half-written segments_<lang>.json so translate retries cleanly
  rm -f "$PACK/segments_${L}.json"
  bash "$EP/scripts/run_lang_pipeline.sh" "$L" 0.1.0
  if [ $? -eq 0 ]; then echo "    [$L] SHIPPED" | tee -a "$PROG"; else echo "    [$L] DROPPED" | tee -a "$PROG"; fi
done

echo "=== Ep4 recovery DONE $(date -u +%FT%TZ) ===" | tee -a "$PROG"
