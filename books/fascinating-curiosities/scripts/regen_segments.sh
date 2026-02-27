#!/bin/bash
# Regenerate specific audio segments for EN and ES
# Uses filtered segment files (segments_regen_en.json, segments_regen_es.json)
# and merges results back into the main manifests.
#
# Usage:
#   ./regen_segments.sh en    # Regen only EN
#   ./regen_segments.sh es    # Regen only ES
#   ./regen_segments.sh both  # Regen both

set -euo pipefail

VENV="/home/skyl/corpan-voice-pipeline"
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
PACK_DIR="$SCRIPTS_DIR/../01-mystery-of-monte-alban/pack"
VOICE="/home/skyl/encorpora/voices/data/ian-narration.wav"

MODE="${1:-both}"

regen_en() {
    echo "=== Regenerating EN audio ==="
    "$VENV/bin/python" "$SCRIPTS_DIR/generate_audio.py" \
        --segments "$PACK_DIR/segments_regen_en.json" \
        --voice "$VOICE" \
        --language en \
        --output-dir "$PACK_DIR/audio/en" \
        --manifest "$PACK_DIR/audio_manifest_regen_en.json" \
        --format opus \
        --device cuda

    echo "=== Merging EN manifest ==="
    python3 -c "
import json
main = json.load(open('$PACK_DIR/audio_manifest_en.json'))
regen = json.load(open('$PACK_DIR/audio_manifest_regen_en.json'))
updated = 0
for seg_id, entry in regen['segments'].items():
    main['segments'][seg_id] = entry
    updated += 1
with open('$PACK_DIR/audio_manifest_en.json', 'w') as f:
    json.dump(main, f, indent=2)
    f.write('\n')
print(f'Merged {updated} EN segments into manifest')
"
}

regen_es() {
    echo "=== Regenerating ES audio ==="
    "$VENV/bin/python" "$SCRIPTS_DIR/generate_audio_multilingual.py" \
        --segments "$PACK_DIR/segments_regen_es.json" \
        --voice "$VOICE" \
        --language es \
        --language-id es \
        --output-dir "$PACK_DIR/audio/es" \
        --manifest "$PACK_DIR/audio_manifest_regen_es.json" \
        --cfg-weight 0.8 \
        --format opus \
        --device cuda

    echo "=== Merging ES manifest ==="
    python3 -c "
import json
main = json.load(open('$PACK_DIR/audio_manifest_es.json'))
regen = json.load(open('$PACK_DIR/audio_manifest_regen_es.json'))
updated = 0
for seg_id, entry in regen['segments'].items():
    main['segments'][seg_id] = entry
    updated += 1
with open('$PACK_DIR/audio_manifest_es.json', 'w') as f:
    json.dump(main, f, indent=2)
    f.write('\n')
print(f'Merged {updated} ES segments into manifest')
"
}

case "$MODE" in
    en)   regen_en ;;
    es)   regen_es ;;
    both) regen_en && regen_es ;;
    *)    echo "Usage: $0 {en|es|both}"; exit 1 ;;
esac

echo "=== Done ==="
