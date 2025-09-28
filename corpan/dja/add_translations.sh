#!/usr/bin/env bash

PROVIDER="openai"
PROCS=24
LANGS=(ar de es fa fr hi hu it ja ko-polite pl pt-BR ru vi zh-Hans zh-Hant)

for lang in "${LANGS[@]}"; do
  echo "=== translate_missing → ${lang} ==="
  if ! ./manage.py translate_missing --provider "${PROVIDER}" --lang "${lang}" --random --processes "${PROCS}"; then
    echo "!!! translate_missing failed for ${lang}" >&2
  fi
done
