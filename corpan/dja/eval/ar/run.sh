#!/usr/bin/env bash
# Grade every Arabic surface with a strong model (codex / GPT-5.x) and drop
# JSON reports next to this script. Re-runnable; reports overwrite.
#
#   bash run.sh            # grade core app locale + corpus sample
#   bash run.sh packs      # also grade pack catalog metadata + in-game strings
#
# Requires: codex CLI on PATH, python3, ../../release.sqlite3.
set -euo pipefail
cd "$(dirname "$0")"

LOCALES=../../../corpan-app/public/locales
EN="$LOCALES/en/common.json"

echo "▶ Core app UI (ar/common.json) …"
python3 grade_locale.py --source "$EN" --target "$LOCALES/ar/common.json" \
  --lang ar --out report.ar.common.json --batch 25 --workers 4 --reasoning medium

echo "▶ Corpus sample (stratified across CEFR levels) …"
python3 sample_corpus.py --db ../../release.sqlite3 --per-level 28 \
  --en-out /tmp/corpus_en.json --ar-out /tmp/corpus_ar.json
python3 grade_locale.py --source /tmp/corpus_en.json --target /tmp/corpus_ar.json \
  --lang ar --out report.ar.corpus.json --batch 25 --workers 4 --reasoning medium

if [ "${1:-}" = "packs" ]; then
  echo "▶ Pack in-game strings (hover-runner) …"
  python3 grade_locale.py --no-source \
    --target ../../../packs/hover-runner/src/locales/ar.json \
    --lang ar --out report.ar.hover-runner.json --batch 25 --workers 3 --reasoning medium
  echo "(pack catalog metadata-out/ar.json files are name/blurb only — grade ad hoc)"
fi

echo "✓ Reports written. Inspect with: python3 -m json.tool report.ar.common.json | less"
