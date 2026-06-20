#!/usr/bin/env bash
# Run a single language end-to-end through the post-EN pipeline.
# Assumes: segments_<lang>.json already exists in the pack.
# Does: nvidia-smi guard → validate → generate → fixup → master --all → audit → publish → CDN check (ttsctl publish now writes publishedAt).
#
# Usage:  run_lang_pipeline.sh <lang> <version>
set -euo pipefail

LANG=${1:?usage: run_lang_pipeline.sh <lang> <version>}
VERSION=${2:?usage: run_lang_pipeline.sh <lang> <version>}

BOOK=/home/skyl/encorpora/books/nature/biomes-of-the-world/03-hot-desert
EXPECTED_BOOK_ID=book_biomes_hot_desert
PACK=$BOOK/packs/ian-chatterbox-v1
BIN=/home/skyl/tts_venv/bin
SCRIPTS=$BOOK/scripts
LOG=/tmp/desert_${LANG}_${VERSION}
mkdir -p "$LOG"

# Manifest-id assertion: refuse to run if pack manifest's id doesn't match
# the expected book id (prevents wrapper-clobber across books).
ACTUAL_ID=$($BIN/python -c "import json; print(json.load(open('$PACK/manifest.json'))['id'])")
if [ "$ACTUAL_ID" != "$EXPECTED_BOOK_ID" ]; then
  echo "ABORT: pack manifest id '$ACTUAL_ID' != expected '$EXPECTED_BOOK_ID'"
  echo "Wrapper is pointed at the wrong book. Check BOOK= line."
  exit 98
fi

echo "[$(date +%T)] [$LANG $VERSION] nvidia-smi guard"
OTHER=$(nvidia-smi --query-compute-apps=pid,process_name --format=csv,noheader \
        | grep -v "^$$," | grep -v "^[[:space:]]*$" || true)
if [ -n "$OTHER" ]; then
  echo "GPU NOT CLEAR:"
  echo "$OTHER"
  echo "aborting — refuse to stack on top of other CUDA jobs"
  exit 99
fi

echo "[$(date +%T)] [$LANG] segments_${LANG}.json check"
test -f "$PACK/segments_${LANG}.json" || { echo "missing segments_${LANG}.json"; exit 1; }

echo "[$(date +%T)] [$LANG] pre-flight validation"
$BIN/python - <<PYEOF
import json, re
from pathlib import Path
PACK = Path("$PACK")
en = json.load((PACK / "segments.json").open())
xx = json.load((PACK / f"segments_${LANG}.json").open())
em = {s['id']: s for s in en['segments']}
xm = {s['id']: s for s in xx['segments']}
assert sorted(em) == sorted(xm), f"id mismatch: en={len(em)} ${LANG}={len(xm)}"
digit_hits, dash_hits, passthrough, mismatch = [], [], [], []
_NIKKUD_RE = re.compile(r'[ְ-ׇֽֿׁׂׅׄ]')
def _norm(s):
    # Documented hyphen→space divergence (feedback_tts_text_divergence.md):
    # display keeps language-mandatory hyphens + em/en-dashes (' — '), tts.text strips them.
    # Hebrew nikkud (feedback_hebrew_use_gemini_tts.md): display has no nikkud,
    # tts.text adds full nikkud — strip for comparison.
    s = s.replace('—','-').replace('–','-').replace('־','-')
    s = _NIKKUD_RE.sub('', s)
    return ' '.join(s.replace('-',' ').split())
for sid, x in xm.items():
    tts = (x.get('tts') or {}).get('text', '')
    if re.search(r'\d', tts): digit_hits.append(sid)
    if '-' in tts or '—' in tts: dash_hits.append(sid)
    e_text = em[sid].get('text', '')
    if x.get('text','') == e_text and len(e_text.split()) > 2 and x.get('block_type') == 'text':
        passthrough.append(sid)
    # Allow ONLY hyphen-strip divergence between text and tts.text. Any other
    # divergence is a creative rephrase and breaks reader alignment.
    if x.get('block_type') == 'text' and _norm(x.get('text','')) != _norm(tts):
        mismatch.append(sid)
fail = []
if digit_hits:  fail.append(f"digits in tts.text: {digit_hits[:5]}")
if dash_hits:   fail.append(f"dashes in tts.text: {dash_hits[:5]}")
if passthrough: fail.append(f"untranslated passthrough: {passthrough[:5]}")
if mismatch:    fail.append(f"text/tts.text divergence beyond hyphen-strip: {mismatch[:5]}")
if fail:
    print("VALIDATION FAILED:")
    for f in fail: print("  ", f)
    raise SystemExit(2)
print(f"  OK: {len(xm)} segs, 0 digits, 0 dashes, 0 untranslated, 0 text!=tts mismatches")
PYEOF

echo "[$(date +%T)] [$LANG] ttsctl generate"
$BIN/ttsctl generate "$PACK" --lang "$LANG" --device cuda > "$LOG/gen.log" 2>&1
$BIN/ttsctl status "$PACK" 2>&1 | tail -8 | tee "$LOG/status_after_gen.txt"

echo "[$(date +%T)] [$LANG] post_generate_fixup"
$BIN/python "$SCRIPTS/post_generate_fixup.py" "$PACK" "$LANG" > "$LOG/fixup.log" 2>&1
grep -E "realigned|onset-patch|Traceback|ERROR" "$LOG/fixup.log" | tail -20

echo "[$(date +%T)] [$LANG] ttsctl master --all"
$BIN/ttsctl master "$PACK" --lang "$LANG" --all > "$LOG/master.log" 2>&1
tail -3 "$LOG/master.log"

echo "[$(date +%T)] [$LANG] ttsctl audit"
$BIN/ttsctl audit "$PACK" --lang "$LANG" > "$LOG/audit.log" 2>&1
tail -3 "$LOG/audit.log"

echo "[$(date +%T)] [$LANG] post-trim tail-truncation scan (catches what validator missed)"
$BIN/python - <<PYEOF
import json, sys
from pathlib import Path
a = json.loads(Path("$PACK/alignment_${LANG}.json").read_text())
hits = []
for sid, ws in a.items():
    if not isinstance(ws, list) or len(ws) < 2: continue
    tail = 0
    for w in reversed(ws):
        if w.get("start_ms")==w.get("end_ms"): tail += 1
        else: break
    if tail >= 2:
        hits.append((sid, tail))
if hits:
    print("POST-TRIM TAIL TRUNCATION (publish BLOCKED):")
    for sid, t in hits: print(f"  {sid}: {t} tail zeros")
    print("Resync those segments + rerun wrapper.")
    sys.exit(3)
print(f"  ok: 0 post-trim tail-truncations across {len(a)} aligned segs")
PYEOF

# Keep manifest.json at $VERSION (no per-lang bumps for first ship)
$BIN/python - <<PYEOF
import json
from pathlib import Path
m = Path("$PACK/manifest.json")
d = json.loads(m.read_text())
if d['version'] != "$VERSION":
    d['version'] = "$VERSION"
    m.write_text(json.dumps(d, indent=2) + '\n')
PYEOF

echo "[$(date +%T)] [$LANG] ttsctl publish (preview/premium)"
$BIN/ttsctl publish "$PACK" --lang "$LANG" --voice-id ian-chill-clear --tier public --with-preview --version "$VERSION" > "$LOG/publish.log" 2>&1
tail -5 "$LOG/publish.log"


echo "[$(date +%T)] [$LANG] CDN verify"
curl -s 'https://d38iwc9748jekz.cloudfront.net/catalog-v2.json' | $BIN/python -c "
import json, sys
c = json.load(sys.stdin)
n = [n for n in c['narrations'] if n.get('bookId')=='book_biomes_tropical_rainforest' and n.get('language')=='$LANG']
print('  CDN narrations for [$LANG]:', n)
"

# Append lang_record
$BIN/python - <<PYEOF
import json
from datetime import datetime, timezone
rec = {
    "lang": "$LANG",
    "book": "biomes-tropical-rainforest",
    "voice_id": "ian-chill-clear",
    "version": "$VERSION",
    "engine": "chatterbox",
    "final_status": "PUBLISHED",
    "timestamp": datetime.now(timezone.utc).isoformat(),
}
with open('$BOOK/../lang_records/$LANG.jsonl', 'a') as f:
    f.write(json.dumps(rec) + '\n')
PYEOF

echo "[$(date +%T)] [$LANG $VERSION] DONE"
