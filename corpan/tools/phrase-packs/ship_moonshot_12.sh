#!/bin/bash
# Ship 12 moonshot phrase packs: translate (parallel) + retry + build + publish (serial).
# Translations are parallel-safe; catalog publishes are NOT (GET/upsert/PUT race).
# NO `set -e` — gemini_translate.py exits non-zero on partial failures, which is expected.

set -uo pipefail

cd /home/skyl/encorpora/corpan/tools/phrase-packs

PACKS=(
  phrase-sciences-astronomy-night-sky
  phrase-nature-birds-everyday
  phrase-nature-the-ocean
  phrase-sports-soccer-basics
  phrase-sports-martial-arts
  phrase-life-health-and-body
  phrase-life-family-and-friends
  phrase-vehicles-cars-and-driving
  phrase-arts-cinema-and-film
  phrase-life-festivals-world
  phrase-life-the-night
  phrase-humanities-mythology-world
)

PY=/home/skyl/tts_venv/bin/python
LOG_DIR=/tmp/moonshot-12-logs
mkdir -p "$LOG_DIR"

echo "===> PHASE 1: TRANSLATIONS (parallel, 3 packs at a time, 17 langs in flight per pack)"
echo

BATCH=3
for ((i=0; i<${#PACKS[@]}; i+=BATCH)); do
  batch_packs=("${PACKS[@]:i:BATCH}")
  echo "  Batch ($((i/BATCH+1))/$(( (${#PACKS[@]} + BATCH - 1) / BATCH ))): ${batch_packs[*]}"
  pids=()
  for p in "${batch_packs[@]}"; do
    (
      $PY gemini_translate.py "$p" --vertex --write-en --skip-existing --workers 17 \
        > "$LOG_DIR/$p.translate.log" 2>&1
      echo "    [translate exit=$?] $p"
    ) &
    pids+=($!)
  done
  for pid in "${pids[@]}"; do wait "$pid" || true; done
  echo "  Batch done."
  echo
done

echo
echo "===> PHASE 1b: RETRY any missing langs (sequential, 6 workers)"
for p in "${PACKS[@]}"; do
  n=$(ls "$p/translations/" 2>/dev/null | wc -l)
  if [ "$n" -lt 51 ]; then
    echo "  Retrying $p ($n/51 done)..."
    # Two retry passes with --skip-existing to mop up transient 429s
    $PY gemini_translate.py "$p" --vertex --write-en --skip-existing --workers 6 \
      >> "$LOG_DIR/$p.translate.log" 2>&1 || true
    sleep 5
    $PY gemini_translate.py "$p" --vertex --write-en --skip-existing --workers 3 \
      >> "$LOG_DIR/$p.translate.log" 2>&1 || true
    n2=$(ls "$p/translations/" 2>/dev/null | wc -l)
    echo "    $p now $n2/51"
  fi
done

echo
echo "===> PHASE 2: BUILD (sequential)"
for p in "${PACKS[@]}"; do
  echo "  Building $p..."
  $PY build_phrase_pack.py "$p" > "$LOG_DIR/$p.build.log" 2>&1
  rc=$?
  if [ $rc -ne 0 ]; then
    echo "    [BUILD FAILED rc=$rc] $p — see $LOG_DIR/$p.build.log"
  fi
done
echo "All builds attempted."
echo

echo "===> PHASE 3: PUBLISH (sequential; catalog upsert is NOT parallel-safe)"
for p in "${PACKS[@]}"; do
  if [ ! -d "$p/build" ]; then
    echo "  [SKIP] $p — no build dir"
    continue
  fi
  echo "  Publishing $p..."
  $PY publish.py "$p/build" \
    --upload \
    --update-catalog \
    --profile corpan-publisher \
    > "$LOG_DIR/$p.publish.log" 2>&1
  rc=$?
  if [ $rc -ne 0 ]; then
    echo "    [PUBLISH FAILED rc=$rc] $p — see $LOG_DIR/$p.publish.log"
  fi
done

echo
echo "===> PHASE 4: UPDATE CURATION + INVALIDATE CDN"
$PY publish.py \
  --update-curation curation.json \
  --invalidate \
  --distribution-id E1RDNUCVE70SCI \
  --profile corpan-publisher \
  > "$LOG_DIR/curation.log" 2>&1
echo "  curation.log:"
tail -10 "$LOG_DIR/curation.log"

echo
echo "===> DONE"
echo "Logs: $LOG_DIR/"
