#!/usr/bin/env bash
# AI This Week Ep4 — per-language pipeline: translate → gate → generate →
# fixup → master → audit → gate → publish → patch-catalog → verify → record.
# Auto-ship: publishes (Corpán Plus two-ZIP via --with-preview) only if both
# gates pass; otherwise DROPS the language. Logs to /tmp/ep6_<lang>/.
#
# Usage: run_lang_pipeline.sh <lang> [version]
set -uo pipefail

LANG_CODE="${1:?usage: run_lang_pipeline.sh <lang> [version]}"
VERSION="${2:-0.1.0}"
EP=/home/skyl/encorpora/books/tech/ai-this-week/007-jun-28
PACK="$EP/packs/vindy-ron-gemini-v1"
SCRIPTS="$EP/scripts"
FIXUP=/home/skyl/encorpora/books/vehicles/motorcycles/01-the-story-of-the-motorcycle/scripts/post_generate_fixup.py
PY=/home/skyl/tts_venv/bin/python
LOG="/tmp/ep7_${LANG_CODE}"; mkdir -p "$LOG"
CDN="https://d38iwc9748jekz.cloudfront.net"
REC="/home/skyl/encorpora/books/tech/ai-this-week/lang_records/${LANG_CODE}.jsonl"

# Load API + cloud creds
set -a; export $(grep -v '^#' ~/.env 2>/dev/null | grep -E 'GOOGLE_CLOUD|ANTHROPIC|OPENAI|AWS_|GEMINI' | xargs) 2>/dev/null; set +a
export TTSCTL_BUDGET_OK=1
# ttsctl/translate/provider.py defaults to claude-sonnet-4-20250514 which was
# retired. Pin to current Sonnet 4.6 until ttsctl ships a default bump.
export TRANSLATE_CLAUDE_MODEL=claude-sonnet-4-6

# Provider routing (LANG_PITFALLS): Claude for passthrough/Indic langs.
# ep6: ko added — Vertex Gemini silently passthrough'd 30 segs ch00-061..097
# in 4 attempts (2026-06-13). Switched to claude per ja precedent.
case " ta te gu kn ur th ja ko bn mr ne " in
  *" $LANG_CODE "*) PROVIDER=(--provider claude) ;;
  *)               PROVIDER=(--provider gemini --vertexai) ;;
esac

stamp() { date -u +%Y-%m-%dT%H:%M:%SZ; }
record() { # status note
  echo "{\"issue\":5,\"lang\":\"$LANG_CODE\",\"date\":\"$(stamp)\",\"version\":\"$VERSION\",\"status\":\"$1\",\"provider\":\"${PROVIDER[1]}\",\"note\":\"$2\"}" >> "$REC"
}

echo "=== [$LANG_CODE] pipeline start $(stamp) (provider ${PROVIDER[*]}) ==="

# 1. Translate (skip if exists). Retry on failure — ttsctl's passthrough
#    guard refuses the whole file if Gemini leaves even one segment
#    byte-equal to English; that's stochastic and usually clears on a
#    fresh run.
# EN special case: segments.json IS the English source — no translate needed.
if [ "$LANG_CODE" = "en" ]; then
  echo "[$LANG_CODE] EN source — skipping translate"
elif [ ! -f "$PACK/segments_${LANG_CODE}.json" ]; then
  for tattempt in 1 2 3 4; do
    echo "[$LANG_CODE] translating (attempt $tattempt)…"
    ttsctl translate "$PACK" --langs "$LANG_CODE" "${PROVIDER[@]}" > "$LOG/translate.log" 2>&1
    [ -f "$PACK/segments_${LANG_CODE}.json" ] && break
    echo "[$LANG_CODE] translate attempt $tattempt failed: $(tail -1 "$LOG/translate.log")"
    sleep 3
  done
  if [ ! -f "$PACK/segments_${LANG_CODE}.json" ]; then
    echo "[$LANG_CODE] TRANSLATE ERROR after retries"; tail -5 "$LOG/translate.log"; record DROP "translate-error"; exit 2
  fi
fi

# 2. Translation gate (no spend if broken). Skip for EN — segments.json IS source.
if [ "$LANG_CODE" != "en" ]; then
  $PY "$SCRIPTS/audit_translation.py" "$PACK" "$LANG_CODE" | tee "$LOG/transgate.log"
  if [ "${PIPESTATUS[0]}" -ne 0 ]; then echo "[$LANG_CODE] DROPPED at translation gate"; record DROP "translation-gate"; exit 3; fi
fi

# 3. Generate audio (Gemini = API; no --device needed)
echo "[$LANG_CODE] generating audio…"
ttsctl generate "$PACK" --lang "$LANG_CODE" > "$LOG/gen.log" 2>&1
GEN=$?
echo "[$LANG_CODE] generate exit=$GEN"

# 3b. Recover transient FAILED segments (e.g. Gemini empty_response on short
#     reactions) with jittered retry passes before giving up.
for attempt in 1 2 3 4; do
  NF=$($PY -c "import json;d=json.load(open('$PACK/pipeline_state_${LANG_CODE}.json'));print(sum(1 for k,v in d.items() if k!='_provenance' and v.get('status')!='DONE'))" 2>/dev/null)
  [ "${NF:-0}" -eq 0 ] && break
  echo "[$LANG_CODE] retry pass $attempt — $NF non-DONE"
  ttsctl retry "$PACK" --lang "$LANG_CODE" >> "$LOG/gen.log" 2>&1
done

# 4. Post-generate fixup (re-align + onset)
$PY "$FIXUP" "$PACK" "$LANG_CODE" > "$LOG/fixup.log" 2>&1
echo "[$LANG_CODE] fixup exit=$?"

# 5. Master --all
ttsctl master "$PACK" --lang "$LANG_CODE" --all > "$LOG/master.log" 2>&1
echo "[$LANG_CODE] master exit=$?"

# 6. Audit
ttsctl audit "$PACK" --lang "$LANG_CODE" > "$LOG/audit.log" 2>&1
echo "[$LANG_CODE] audit:"; tail -3 "$LOG/audit.log"

# 7. Audio gate (drop if any segment not DONE)
$PY "$SCRIPTS/audio_gate.py" "$PACK" "$LANG_CODE" | tee "$LOG/audiogate.log"
if [ "${PIPESTATUS[0]}" -ne 0 ]; then echo "[$LANG_CODE] DROPPED at audio gate (not clean)"; record DROP "audio-gate"; exit 4; fi

# 8. Publish — Corpán Plus two-ZIP via --with-preview (NEW DEFAULT per
#    feedback_publish_with_preview_default.md; was --tier public in ep3).
echo "[$LANG_CODE] publishing v$VERSION (with-preview)…"
ttsctl publish "$PACK" --lang "$LANG_CODE" --voice-id gemini-vindy --version "$VERSION" --with-preview > "$LOG/publish.log" 2>&1
if [ $? -ne 0 ]; then echo "[$LANG_CODE] PUBLISH ERROR"; tail -8 "$LOG/publish.log"; record FAIL "publish-error"; exit 5; fi

# 9. Patch catalog (restore cast/cover/characters)
( cd /home/skyl/encorpora/corpan/infra && $PY patch-catalog.py > "$LOG/patch.log" 2>&1 )
echo "[$LANG_CODE] patch-catalog exit=$?"

# 10. Verify on CDN
sleep 5
LIVE=$(curl -s --max-time 25 "$CDN/catalog-v2.json?cb=$(date +%s)" 2>/dev/null | $PY -c "
import json,sys
d=json.load(sys.stdin)
ok=any(n.get('bookId')=='book_ai_this_week_2026_06_28' and n.get('language')=='$LANG_CODE' for n in d['narrations'])
print('LIVE' if ok else 'MISSING')" 2>/dev/null)
echo "[$LANG_CODE] CDN: $LIVE"
record SHIPPED "cdn=$LIVE"
echo "=== [$LANG_CODE] DONE $(stamp) — $LIVE ==="
