#!/usr/bin/env bash
# Minimal concept-of-the-week swap for one already-shipped language:
# re-translate ONLY the 21 changed segments, merge, regenerate just those,
# re-master, re-publish at the new version, patch-catalog. ~90% of the audio
# is untouched. Usage: update_concept_lang.sh <lang> [version]
set -uo pipefail
L="${1:?lang}"; VER="${2:-0.1.1}"
EP=/home/skyl/encorpora/books/tech/ai-this-week/003-may-27
PACK="$EP/packs/vindy-ron-gemini-v1"; TMP=/tmp/concept_pack; SC="$EP/scripts"
FIXUP=/home/skyl/encorpora/books/vehicles/motorcycles/01-the-story-of-the-motorcycle/scripts/post_generate_fixup.py
PY=/home/skyl/tts_venv/bin/python
LOG=/tmp/ep3_concept_$L; mkdir -p "$LOG"
IDS=$(cat /tmp/ep3_changed_ids.txt)
REC=/home/skyl/encorpora/books/tech/ai-this-week/lang_records/$L.jsonl
set -a; export $(grep -v '^#' ~/.env 2>/dev/null | grep -E 'GOOGLE_CLOUD|ANTHROPIC|AWS_|GEMINI' | xargs) 2>/dev/null; set +a
export TTSCTL_BUDGET_OK=1
case " ta te gu kn ur th ja bn mr ne " in *" $L "*) PROV=(--provider claude);; *) PROV=(--provider gemini --vertexai);; esac

echo "=== [$L] concept swap start $(date -u +%FT%TZ) ==="
# 1. translate the 21 concept segments via the temp pack
rm -f "$TMP/segments_$L.json"
for a in 1 2 3 4; do
  ttsctl translate "$TMP" --langs "$L" "${PROV[@]}" > "$LOG/translate.log" 2>&1
  [ -f "$TMP/segments_$L.json" ] && break; sleep 3
done
[ -f "$TMP/segments_$L.json" ] || { echo "[$L] TRANSLATE FAIL"; tail -3 "$LOG/translate.log"; exit 2; }
# 2. merge into the real per-language segments file
$PY "$SC/merge_concept.py" "$PACK" "$TMP" "$L" > "$LOG/merge.log" 2>&1 || { echo "[$L] MERGE FAIL"; cat "$LOG/merge.log"; exit 3; }
cat "$LOG/merge.log"
# 3. reset only the 21 changed ids to PENDING
$PY "$SC/reset_segments.py" "$PACK" "$L" $IDS > "$LOG/reset.log" 2>&1; cat "$LOG/reset.log"
# 4. regenerate just those, with transient-empty retry
ttsctl generate "$PACK" --lang "$L" --device cuda > "$LOG/gen.log" 2>&1
for a in 1 2 3 4; do
  NF=$($PY -c "import json;d=json.load(open('$PACK/pipeline_state_$L.json'));print(sum(1 for k,v in d.items() if k!='_provenance' and v.get('status')!='DONE'))" 2>/dev/null)
  [ "${NF:-0}" -eq 0 ] && break
  echo "[$L] retry pass $a — $NF non-DONE"; ttsctl retry "$PACK" --lang "$L" >> "$LOG/gen.log" 2>&1
done
# 5. fixup + master + audit + gate
$PY "$FIXUP" "$PACK" "$L" > "$LOG/fixup.log" 2>&1
ttsctl master "$PACK" --lang "$L" --all > "$LOG/master.log" 2>&1
ttsctl audit "$PACK" --lang "$L" > "$LOG/audit.log" 2>&1; tail -2 "$LOG/audit.log"
$PY "$SC/audio_gate.py" "$PACK" "$L" > "$LOG/gate.log" 2>&1 || { echo "[$L] GATE FAIL"; cat "$LOG/gate.log"; exit 4; }
cat "$LOG/gate.log"
# 6. publish + patch-catalog
ttsctl publish "$PACK" --lang "$L" --voice-id gemini-vindy --tier public --version "$VER" > "$LOG/publish.log" 2>&1 || { echo "[$L] PUBLISH FAIL"; tail -6 "$LOG/publish.log"; exit 5; }
( cd /home/skyl/encorpora/corpan/infra && $PY patch-catalog.py > "$LOG/patch.log" 2>&1 )
echo "{\"issue\":3,\"lang\":\"$L\",\"date\":\"$(date -u +%FT%TZ)\",\"version\":\"$VER\",\"status\":\"CONCEPT_UPDATED\",\"provider\":\"${PROV[1]}\",\"note\":\"MoE concept -> neural audio codecs; 21 segs re-translated+regen\"}" >> "$REC"
echo "=== [$L] DONE -> $VER $(date -u +%FT%TZ) ==="
