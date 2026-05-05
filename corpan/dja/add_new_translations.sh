#!/usr/bin/env bash
# Translate the 10k phrases for the 13 newly-added languages.
# Run from dja/. Override PROVIDER=xai or PROVIDER=claude as needed per quality.

PROVIDER="${PROVIDER:-openai}"
PROCS="${PROCS:-24}"
LANGS=(ne pt-PT hr sr uk bg ro ca yue-Hant-HK cs lt sk sl)

for lang in "${LANGS[@]}"; do
  echo "=== translate_missing → ${lang} (provider=${PROVIDER}, procs=${PROCS}) ==="
  if ! ./manage.py translate_missing --provider "${PROVIDER}" --lang "${lang}" --random --processes "${PROCS}"; then
    echo "!!! translate_missing failed for ${lang}" >&2
  fi
done
