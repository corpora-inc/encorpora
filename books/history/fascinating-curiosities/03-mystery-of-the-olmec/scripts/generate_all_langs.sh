#!/bin/bash
# Generate TTS audio for all 22 non-English languages
# Usage: ./generate_all_langs.sh [start_lang]
# If start_lang is provided, skips languages before it (for resuming)

PACK="/home/skyl/encorpora/books/history/fascinating-curiosities/03-mystery-of-the-olmec/pack"
TTSCTL="/home/skyl/tts_venv/bin/ttsctl"
LANGS="ar da de el es fi fr he hi it ja ko ms nl no pl pt ru sv sw tr zh"

start_lang="${1:-}"
started=false

if [ -z "$start_lang" ]; then
    started=true
fi

for lang in $LANGS; do
    if [ "$started" = false ]; then
        if [ "$lang" = "$start_lang" ]; then
            started=true
        else
            echo "SKIP $lang (before start_lang=$start_lang)"
            continue
        fi
    fi

    echo ""
    echo "============================================"
    echo "  GENERATING: $lang ($(date))"
    echo "============================================"

    # Check if segments file exists
    if [ ! -f "$PACK/segments_${lang}.json" ]; then
        echo "  ERROR: segments_${lang}.json not found, skipping"
        continue
    fi

    $TTSCTL generate "$PACK" --lang "$lang" --device cuda 2>&1

    echo ""
    echo "  STATUS after generate:"
    $TTSCTL status "$PACK" --lang "$lang" 2>&1 | tail -5

    echo ""
    echo "  DONE: $lang ($(date))"
done

echo ""
echo "============================================"
echo "  ALL LANGUAGES COMPLETE ($(date))"
echo "============================================"
