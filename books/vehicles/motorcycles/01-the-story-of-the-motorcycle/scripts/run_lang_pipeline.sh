#!/usr/bin/env bash
# Run a single language end-to-end through the post-EN pipeline.
# Assumes: codex has already produced segments_<lang>.json + phonetics_<lang>.json
# Does:  validate → generate → fixup (realign + onset patch) → master --all → audit → publish → patch-catalog
#
# Usage:  run_lang_pipeline.sh <lang> <version>
#         run_lang_pipeline.sh fr 0.1.4
#         run_lang_pipeline.sh zh 0.1.4
set -euo pipefail

LANG=${1:?usage: run_lang_pipeline.sh <lang> <version>}
VERSION=${2:?usage: run_lang_pipeline.sh <lang> <version>}

PACK=/home/skyl/encorpora/books/vehicles/motorcycles/01-the-story-of-the-motorcycle/packs/august-chatterbox-v1
BIN=/home/skyl/tts_venv/bin
SCRIPTS=/home/skyl/encorpora/books/vehicles/motorcycles/01-the-story-of-the-motorcycle/scripts
LOG=/tmp/motorcycles_${LANG}_${VERSION}

mkdir -p "$LOG"
echo "[$(date +%T)] [$LANG $VERSION] segments + phonetics check"
test -f "$PACK/segments_${LANG}.json" || { echo "missing segments_${LANG}.json"; exit 1; }
test -f "$PACK/phonetics_${LANG}.json" || echo "  (no phonetics_${LANG}.json — non-fatal)"

# Pre-flight validation
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
digit_hits = []
dash_hits = []
passthrough = []
for sid, x in xm.items():
    tts = (x.get('tts') or {}).get('text', '')
    if re.search(r'\d', tts): digit_hits.append(sid)
    if '-' in tts or '—' in tts: dash_hits.append(sid)
    e_text = em[sid].get('text', '')
    if x.get('text','') == e_text and len(e_text.split()) > 2:
        passthrough.append(sid)
fail = []
if digit_hits:    fail.append(f"digits in tts.text: {digit_hits[:5]}")
if dash_hits:     fail.append(f"dashes in tts.text: {dash_hits[:5]}")
if passthrough:   fail.append(f"untranslated passthrough: {passthrough[:5]}")
if fail:
    print("VALIDATION FAILED:")
    for f in fail: print("  ", f)
    raise SystemExit(2)
print(f"  OK: 170 segs, 0 digits, 0 dashes, 0 untranslated")
PYEOF

# Generate
echo "[$(date +%T)] [$LANG] ttsctl generate"
$BIN/ttsctl generate "$PACK" --lang "$LANG" --device cuda > "$LOG/gen.log" 2>&1
$BIN/ttsctl status "$PACK" 2>&1 | tail -8 | tee "$LOG/status_after_gen.txt"

# Fixup: realign + onset patch
echo "[$(date +%T)] [$LANG] post_generate_fixup (realign + onset patch)"
$BIN/python "$SCRIPTS/post_generate_fixup.py" "$PACK" "$LANG" > "$LOG/fixup.log" 2>&1
grep -E "realigned|onset-patch" "$LOG/fixup.log" | tail -20

# Master --all (uses corrected alignment)
echo "[$(date +%T)] [$LANG] ttsctl master --all"
$BIN/ttsctl master "$PACK" --lang "$LANG" --all > "$LOG/master.log" 2>&1
tail -3 "$LOG/master.log"

# Audit
echo "[$(date +%T)] [$LANG] ttsctl audit"
$BIN/ttsctl audit "$PACK" --lang "$LANG" > "$LOG/audit.log" 2>&1
tail -3 "$LOG/audit.log"

# Bump version (only if needed — caller may have already bumped)
$BIN/python - <<PYEOF
import json
from pathlib import Path
m = Path("$PACK/manifest.json")
d = json.loads(m.read_text())
if d['version'] != "$VERSION":
    d['version'] = "$VERSION"
    m.write_text(json.dumps(d, indent=2) + '\n')
    print(f"  version bumped to $VERSION")
else:
    print(f"  version already $VERSION")
PYEOF

# Publish
echo "[$(date +%T)] [$LANG] ttsctl publish"
$BIN/ttsctl publish "$PACK" --lang "$LANG" --voice-id august --tier public --version "$VERSION" > "$LOG/publish.log" 2>&1
tail -5 "$LOG/publish.log"

# Patch catalog
echo "[$(date +%T)] [$LANG] patch-catalog.py"
( cd /home/skyl/encorpora/corpan/infra && $BIN/python patch-catalog.py ) > "$LOG/patch.log" 2>&1
tail -3 "$LOG/patch.log"

echo "[$(date +%T)] [$LANG $VERSION] DONE"
echo
echo "Listen samples:"
for sid in ch00-002 ch01-020 ch02-047 ch02-048 ch07-153; do
    echo "  $PACK/audio/$LANG/$sid.m4a"
done
