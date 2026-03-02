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
# Environment variables:
#   FORCE=1       — delete existing audio before regenerating
#   VOICE=file    — override voice for all languages (filename in voices/data/)
#   VOICE_EN=file — override voice for English
#   VOICE_ES=file — override voice for Spanish
#   VOICE_ZH=file — override voice for Chinese
#
# Each phase is resumable — re-running skips already-completed work.
# Use FORCE=1 to redo from scratch.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PHASE="${1:-all}"
DEVICE="${DEVICE:-cuda}"
WORKERS="${WORKERS:-10}"
WHISPER_MODEL="${WHISPER_MODEL:-base}"
FORCE="${FORCE:-0}"

echo "=========================================="
echo "Audio Regeneration Pipeline"
echo "=========================================="
echo "Phase:   $PHASE"
echo "Device:  $DEVICE"
echo "Workers: $WORKERS (Phase 3)"
echo "Whisper: $WHISPER_MODEL (Phase 2)"
echo "Force:   $FORCE"
echo "Time:    $(date)"
echo "=========================================="

# Use tts_venv which has chatterbox, stable-ts, torch cu130, soundfile
PYTHON="${PYTHON:-/home/skyl/tts_venv/bin/python}"

# Build extra args
EXTRA_ARGS=""
if [ "$FORCE" = "1" ]; then
    EXTRA_ARGS="$EXTRA_ARGS --force"
fi
if [ -n "${VOICE:-}" ]; then
    EXTRA_ARGS="$EXTRA_ARGS --voice $VOICE"
fi
if [ -n "${VOICE_EN:-}" ]; then
    EXTRA_ARGS="$EXTRA_ARGS --voice-en $VOICE_EN"
fi
if [ -n "${VOICE_ES:-}" ]; then
    EXTRA_ARGS="$EXTRA_ARGS --voice-es $VOICE_ES"
fi
if [ -n "${VOICE_ZH:-}" ]; then
    EXTRA_ARGS="$EXTRA_ARGS --voice-zh $VOICE_ZH"
fi

"$PYTHON" generate_audio_all.py "$PHASE" \
    --device "$DEVICE" \
    --workers "$WORKERS" \
    --whisper-model "$WHISPER_MODEL" \
    $EXTRA_ARGS

echo ""
echo "Finished at $(date)"
