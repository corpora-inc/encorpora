#!/usr/bin/env bash
# run_regenerate.sh — Full audio regeneration for all languages
#
# Single-encode pipeline: TTS → raw WAV → measure LUFS → apply gain +
# mastering + m4a (AAC) encode in ONE ffmpeg pass. No double-encode artifacts.
# M4A for universal iOS WebView/Safari compatibility.
#
# Usage:
#   ./run_regenerate.sh           # Full pipeline (all 3 phases, all languages)
#   ./run_regenerate.sh tts       # Phase 1 only
#   ./run_regenerate.sh align     # Phase 2 only
#   ./run_regenerate.sh master    # Phase 3 only
#
# Each phase is resumable — re-running skips already-completed work.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PHASE="${1:-all}"
DEVICE="${DEVICE:-cuda}"
WORKERS="${WORKERS:-10}"
WHISPER_MODEL="${WHISPER_MODEL:-base}"

echo "=========================================="
echo "Audio Regeneration Pipeline"
echo "=========================================="
echo "Phase:   $PHASE"
echo "Device:  $DEVICE"
echo "Workers: $WORKERS (Phase 3)"
echo "Whisper: $WHISPER_MODEL (Phase 2)"
echo "Time:    $(date)"
echo "=========================================="

# Use tts_venv which has chatterbox, stable-ts, torch cu130, soundfile
PYTHON="${PYTHON:-/home/skyl/tts_venv/bin/python}"

"$PYTHON" generate_audio_all.py "$PHASE" \
    --device "$DEVICE" \
    --workers "$WORKERS" \
    --whisper-model "$WHISPER_MODEL"

echo ""
echo "Finished at $(date)"
