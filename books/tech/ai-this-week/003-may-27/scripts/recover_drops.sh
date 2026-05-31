#!/usr/bin/env bash
# Recover the 12 ep3 fan-out drops, sequentially. Different actions per drop type.
# Logs -> /tmp/ep3_recover.log. Per-lang detail -> /tmp/ep3_<lang>/.
set -uo pipefail
EP=/home/skyl/encorpora/books/tech/ai-this-week/003-may-27
PACK="$EP/packs/vindy-ron-gemini-v1"
PROG=/tmp/ep3_recover.log
VER=0.1.1

echo "=== drop recovery start $(date -u +%FT%TZ) ===" | tee -a "$PROG"

run_wrapper() { bash "$EP/scripts/run_lang_pipeline.sh" "$1" "${2:-$VER}"; }

# A. Quick recoveries — stale segment files (translation gate failed on old files
#    before the digit-check removal). rm + re-translate via wrapper.
for L in id ja; do
  echo ">>> [$L] stale-file recovery (rm + re-translate)" | tee -a "$PROG"
  rm -f "$PACK/segments_$L.json"
  rm -f "$PACK/.pipeline_$L.lock"
  run_wrapper "$L" 0.1.1 && echo "    [$L] OK" | tee -a "$PROG" || echo "    [$L] FAILED rc=$?" | tee -a "$PROG"
done

# B. Publish-error recoveries — audio is good, publish step raced/failed. Re-run
#    the wrapper which will skip translate + skip already-DONE generate, then
#    re-publish.
for L in ta gu ne et; do
  echo ">>> [$L] publish-error recovery (re-run wrapper)" | tee -a "$PROG"
  rm -f "$PACK/.pipeline_$L.lock"
  run_wrapper "$L" 0.1.1 && echo "    [$L] OK" | tee -a "$PROG" || echo "    [$L] FAILED rc=$?" | tee -a "$PROG"
done

# C. Short-segment empty-response — Gemini chokes on the 2-word "Be skeptical."
#    translations in some langs. Per-lang rephrase of ch00-175 (longer form),
#    then re-run wrapper. hu was already manually rephrased earlier.
declare -A REPHRASE_175=(
  [sl]="Bodimo skeptični glede tega."
  [te]="ఇది అనుమానించాల్సిన విషయం."
  [hu]="Maradjunk szkeptikusak ezzel."
)
for L in hu sl te; do
  TEXT="${REPHRASE_175[$L]}"
  echo ">>> [$L] short-segment rephrase ch00-175 -> '$TEXT'" | tee -a "$PROG"
  /home/skyl/tts_venv/bin/python -c "
import json
p='$PACK/segments_$L.json'
d=json.load(open(p))
for s in d['segments']:
    if s['id']=='ch00-175':
        s['text']='$TEXT'; s['text_markdown']='$TEXT'
        s['tts']['text']='$TEXT'
        break
open(p,'w').write(json.dumps(d,indent=2,ensure_ascii=False))
print('    [$L] segments_$L.json ch00-175 updated')"
  rm -f "$PACK/.pipeline_$L.lock"
  run_wrapper "$L" 0.1.1 && echo "    [$L] OK" | tee -a "$PROG" || echo "    [$L] FAILED rc=$?" | tee -a "$PROG"
done

# D. Skip — these don't render well on Gemini for this content
echo ">>> SKIPPED (Gemini coverage gap or cascade failure): sr, fil, yue-Hant-HK" | tee -a "$PROG"

echo "=== drop recovery DONE $(date -u +%FT%TZ) ===" | tee -a "$PROG"
