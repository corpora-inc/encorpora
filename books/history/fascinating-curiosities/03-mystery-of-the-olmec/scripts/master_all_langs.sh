#!/bin/bash
# Master audio for all 22 non-English languages
# Usage: ./master_all_langs.sh [start_lang]

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
            echo "SKIP $lang"
            continue
        fi
    fi

    echo ""
    echo "============================================"
    echo "  MASTERING: $lang ($(date))"
    echo "============================================"

    $TTSCTL master "$PACK" --lang "$lang" --all 2>&1

    echo ""
    echo "  DONE mastering: $lang ($(date))"
done

echo ""
echo "============================================"
echo "  ALL MASTERING COMPLETE ($(date))"
echo "============================================"
