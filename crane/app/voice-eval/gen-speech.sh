#!/usr/bin/env bash
# Speak every item in items.json with six macOS voices (accents and genders vary),
# as 16 kHz mono 16-bit WAV, the format whisper.cpp takes. macOS only (`say`, `afconvert`).
#
#   gen-speech.sh OUT_DIR
set -euo pipefail
out="${1:?usage: gen-speech.sh OUT_DIR}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$out/clean"
voices=("Ava (Premium)" "Evan (Enhanced)" "Daniel" "Karen (Premium)" "Aman" "Fiona (Enhanced)")
tags=(ava evan daniel karen aman fiona)
python3 -c 'import json,sys; [print(i["id"]+"\t"+i["say"]) for i in json.load(open(sys.argv[1]))["items"]]' "$here/items.json" |
while IFS=$'\t' read -r id text; do
  for n in "${!voices[@]}"; do
    aiff="$out/clean/$id-${tags[$n]}.aiff"
    say -v "${voices[$n]}" -o "$aiff" "$text"
    afconvert -f WAVE -d LEI16@16000 -c 1 "$aiff" "$out/clean/$id-${tags[$n]}.wav"
    trash "$aiff" 2>/dev/null || mv "$aiff" "$aiff.old"
  done
done
ls "$out/clean"/*.wav | wc -l
