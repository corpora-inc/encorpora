#!/usr/bin/env bash
# Run 3 new voice presets across the full book, sequentially.
# Skips A-current (already running as the default). Waits for PID 65769 to finish first.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GENERATE="$SCRIPT_DIR/generate_audio.py"
PYTHON="/home/skyl/corpan-voice-pipeline/bin/python"

SEGMENTS="/home/skyl/encorpora/books/fascinating-curiosities/01-mystery-of-monte-alban/pack/segments.json"
VOICE="/home/skyl/encorpora/voices/data/ian-narration.wav"
BOOK_DIR="/home/skyl/encorpora/books/fascinating-curiosities/01-mystery-of-monte-alban"

echo "=========================================="
echo "Voice preset batch run"
echo "A-current already finished. Starting 3 remaining presets..."
echo "Started: $(date)"
echo "=========================================="
echo ""

# Define presets: name cfg_weight exaggeration temperature top_p min_p
declare -A PRESET_CFG PRESET_EXAG PRESET_TEMP PRESET_TOPP PRESET_MINP

PRESET_CFG[B-high-cfg]=0.8;   PRESET_EXAG[B-high-cfg]=0.5; PRESET_TEMP[B-high-cfg]=0.8; PRESET_TOPP[B-high-cfg]=1.0;  PRESET_MINP[B-high-cfg]=0.05
PRESET_CFG[C-conservative]=0.8; PRESET_EXAG[C-conservative]=0.3; PRESET_TEMP[C-conservative]=0.6; PRESET_TOPP[C-conservative]=0.85; PRESET_MINP[C-conservative]=0.10
PRESET_CFG[D-max-fidelity]=1.0; PRESET_EXAG[D-max-fidelity]=0.3; PRESET_TEMP[D-max-fidelity]=0.5; PRESET_TOPP[D-max-fidelity]=0.80; PRESET_MINP[D-max-fidelity]=0.15

# A-current is already the running default — skip it
PRESETS=(B-high-cfg C-conservative D-max-fidelity)

for preset in "${PRESETS[@]}"; do
    echo "=========================================="
    echo "Preset: $preset"
    echo "  cfg_weight=${PRESET_CFG[$preset]}"
    echo "  exaggeration=${PRESET_EXAG[$preset]}"
    echo "  temperature=${PRESET_TEMP[$preset]}"
    echo "  top_p=${PRESET_TOPP[$preset]}"
    echo "  min_p=${PRESET_MINP[$preset]}"
    echo "  Started: $(date)"
    echo "=========================================="

    OUTPUT_DIR="$BOOK_DIR/pack/audio/en-$preset"
    MANIFEST="$BOOK_DIR/pack/audio_manifest_en_${preset}.json"

    "$PYTHON" "$GENERATE" \
        --segments "$SEGMENTS" \
        --voice "$VOICE" \
        --language en \
        --output-dir "$OUTPUT_DIR" \
        --manifest "$MANIFEST" \
        --format opus \
        --device cuda \
        --cfg-weight "${PRESET_CFG[$preset]}" \
        --exaggeration "${PRESET_EXAG[$preset]}" \
        --temperature "${PRESET_TEMP[$preset]}" \
        --top-p "${PRESET_TOPP[$preset]}" \
        --min-p "${PRESET_MINP[$preset]}"

    echo ""
    echo "Preset $preset finished at $(date)"
    echo ""
done

echo "=========================================="
echo "All 4 presets complete at $(date)"
echo "=========================================="
echo ""
echo "Output directories:"
for preset in "${PRESETS[@]}"; do
    echo "  $BOOK_DIR/pack/audio/en-$preset/"
done
