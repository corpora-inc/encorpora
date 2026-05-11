#!/usr/bin/env bash
# Run a single language end-to-end through the post-EN pipeline for the Oud (Ian) pack.
# Mirrors the sky pipeline but targets the ian-chatterbox-v1 pack with --voice-id ian.
#
# Usage:  run_lang_pipeline.sh <lang> <version>
#         run_lang_pipeline.sh fr 0.1.0
set -euo pipefail

LANG=${1:?usage: run_lang_pipeline.sh <lang> <version>}
VERSION=${2:?usage: run_lang_pipeline.sh <lang> <version>}

PACK=/home/skyl/encorpora/books/music/musical-instruments-of-the-world/01-oud/packs/ian-chatterbox-v1
BIN=/home/skyl/tts_venv/bin
SCRIPTS=/home/skyl/encorpora/books/music/musical-instruments-of-the-world/01-oud/scripts
LOG=/tmp/oud_ian_${LANG}_${VERSION}

mkdir -p "$LOG"
echo "[$(date +%T)] [ian $LANG $VERSION] segments check"
test -f "$PACK/segments_${LANG}.json" || { echo "missing segments_${LANG}.json"; exit 1; }

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
    if '-' in tts or '—' in tts or '–' in tts: dash_hits.append(sid)
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
print(f"  OK: {len(em)} segs, 0 digits, 0 dashes, 0 untranslated")
PYEOF

# Generate
echo "[$(date +%T)] [$LANG] ttsctl generate"
$BIN/ttsctl generate "$PACK" --lang "$LANG" --device cuda > "$LOG/gen.log" 2>&1
$BIN/ttsctl status "$PACK" 2>&1 | tail -8 | tee "$LOG/status_after_gen.txt"

# Polish
echo "[$(date +%T)] [$LANG] ttsctl polish"
$BIN/ttsctl polish "$PACK" --lang "$LANG" --device cuda > "$LOG/polish.log" 2>&1
grep -E "Result|fixed|errors" "$LOG/polish.log" | tail -3 || true

# Fixup: realign + onset patch
echo "[$(date +%T)] [$LANG] post_generate_fixup (realign + onset patch)"
$BIN/python "$SCRIPTS/post_generate_fixup.py" "$PACK" "$LANG" > "$LOG/fixup.log" 2>&1
grep -E "realigned|onset-patch" "$LOG/fixup.log" | tail -20

# Master --all
echo "[$(date +%T)] [$LANG] ttsctl master --all"
$BIN/ttsctl master "$PACK" --lang "$LANG" --all > "$LOG/master.log" 2>&1
tail -3 "$LOG/master.log"

# Audit
echo "[$(date +%T)] [$LANG] ttsctl audit"
$BIN/ttsctl audit "$PACK" --lang "$LANG" > "$LOG/audit.log" 2>&1
tail -3 "$LOG/audit.log"

# Bump version (only if needed)
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
$BIN/ttsctl publish "$PACK" --lang "$LANG" --voice-id ian --tier public --version "$VERSION" > "$LOG/publish.log" 2>&1
tail -5 "$LOG/publish.log"

# Patch catalog
echo "[$(date +%T)] [$LANG] patch-catalog.py"
( cd /home/skyl/encorpora/corpan/infra && $BIN/python patch-catalog.py ) > "$LOG/patch.log" 2>&1
tail -3 "$LOG/patch.log"

echo "[$(date +%T)] [ian $LANG $VERSION] DONE"
