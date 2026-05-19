#!/usr/bin/env bash
# Fetches the Calliar dataset (ARBML, MIT) and unpacks the
# stroke-annotated JSON tree so `build/extract_calliar_strokes.py`
# can run. The zip itself is not committed (51 MB) — see this
# directory's .gitignore.

set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f dataset.zip ]]; then
  echo "[calliar] downloading dataset.zip ..."
  curl -sL -o dataset.zip \
    https://github.com/ARBML/Calliar/raw/main/calliar_dataset/dataset.zip
fi

if [[ ! -d extracted/dataset ]]; then
  echo "[calliar] unpacking dataset/*.json ..."
  unzip -q dataset.zip "dataset/*" -d extracted
fi

echo "[calliar] ready — $(find extracted/dataset -name '*.json' | wc -l | tr -d ' ') samples"
