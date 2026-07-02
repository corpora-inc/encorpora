#!/usr/bin/env bash
# Translate one language for the biomes book using codex CLI as the first
# choice. Codex is local, cheap, deterministic, and (per operator policy
# 2026-07-02) the default translation backend. Fallback chain:
#   1. codex exec (default, local, cheapest)
#   2. Claude subagent invoked via `claude -p` (only if codex output is
#      structurally malformed AND retry fails)
#
# Translations are SOURCE CODE. They live on disk at
# `packs/ian-chatterbox-v1/segments_<lang>.json`, get committed to git,
# and are treated like any other source file. Never rely on regenerating
# them on the fly.
#
# Usage: translate_lang.sh <lang> [<lang_name>]
#
# Refuses to overwrite an existing segments_<lang>.json (like ttsctl
# translate does). Delete manually if you want to re-translate.
set -euo pipefail

LANG=${1:?usage: translate_lang.sh <lang> [<lang_name>]}
LANG_NAME=${2:-}

BOOK=/home/skyl/encorpora/books/nature/biomes-of-the-world/08-tundra
PACK=$BOOK/packs/ian-chatterbox-v1
SRC=$PACK/segments.json
OUT=$PACK/segments_${LANG}.json

if [ ! -f "$SRC" ]; then echo "missing $SRC"; exit 1; fi
if [ -f "$OUT" ]; then
  echo "$OUT already exists — refusing to overwrite. Delete to re-translate."
  exit 0
fi

# Resolve lang name if the caller didn't pass one
if [ -z "$LANG_NAME" ]; then
  case "$LANG" in
    ar) LANG_NAME="Arabic (Modern Standard)";;
    da) LANG_NAME="Danish";;
    de) LANG_NAME="German";;
    el) LANG_NAME="Modern Greek";;
    es) LANG_NAME="Spanish (Latin American neutral)";;
    fi) LANG_NAME="Finnish";;
    fr) LANG_NAME="French (Metropolitan)";;
    he) LANG_NAME="Modern Hebrew (with full nikkud on tts.text)";;
    hi) LANG_NAME="Hindi (Devanagari)";;
    it) LANG_NAME="Italian";;
    ja) LANG_NAME="Japanese (polite-neutral です/ます)";;
    ko) LANG_NAME="Korean (polite -요/-습니다)";;
    ms) LANG_NAME="Malay (Bahasa Melayu)";;
    nl) LANG_NAME="Dutch";;
    no) LANG_NAME="Norwegian (Bokmål)";;
    pl) LANG_NAME="Polish";;
    pt) LANG_NAME="Portuguese (Brazilian neutral)";;
    ru) LANG_NAME="Russian";;
    sv) LANG_NAME="Swedish";;
    sw) LANG_NAME="Swahili";;
    tr) LANG_NAME="Turkish";;
    zh) LANG_NAME="Mandarin Chinese (Simplified)";;
    *) echo "unknown lang $LANG — pass name as arg 2"; exit 2;;
  esac
fi

# Derive segment count from the source (never hardcode — differs per book).
NSEG=$(/home/skyl/tts_venv/bin/python -c "import json; print(len(json.load(open('$SRC'))['segments']))")

PROMPT_FILE=/tmp/tundra_translate_${LANG}.prompt
cat > "$PROMPT_FILE" <<PROMPT_EOF
Translate every segment of a short narration book to $LANG_NAME. This is production content — the file you write goes straight to a TTS engine and gets shipped.

**Read source**: $SRC
**Write output**: $OUT (do not touch anything else).

**Book context**: "The Tundra" — book 8 of the "Biomes of the World" series. A warm, plain-spoken, third-person tour-guide narration about the tundra: the cold, treeless land north of the boreal forest and high on the world's mountains; frozen ground (permafrost), a short cool summer when the top of the soil thaws, low plants, mosses and lichens, caribou/reindeer, musk oxen, arctic foxes, hares, lemmings, snowy owls, vast summer bird flocks and mosquitoes, and the Inuit, Sami, Nenets, and Chukchi peoples who live there. ~8 minutes of audio.

**Hard rules** (the file will fail downstream pipeline gates otherwise):

1. **Structural parity with source.** Every field on every segment preserved verbatim except \`text\`, \`tts.text\`, and \`text_markdown\`. Preserve \`id\`, \`chapter\`, \`title\`, \`paragraph_id\`, \`sentence_index\`, \`block_type\`, \`heading_level\`, \`tts.pause_after_ms\`, \`tts.repetition_penalty\`. Top-level \`version\`, \`book_id\`, and \`metadata\` unchanged.
2. **Translate every segment.** No English left on \`text\` or \`tts.text\`. If a proper noun has no natural target-language form, transliterate it into the target script (see rule 4).
3. **\`text\` and \`tts.text\` must be identical** (byte-for-byte after normalization). The reader highlights \`text\`; Chatterbox speaks \`tts.text\`; any divergence breaks word-level sync. Rule of thumb: \`s['text'] = s['tts']['text']\`.
4. **No Latin script inside non-Latin \`tts.text\`.** Chatterbox cannot code-switch. For ja/ko/zh/ar/he/el/ru/hi, transliterate every proper noun (place, people, animal type) into the target script. Examples:
   - "Canada" → \`カナダ\` / \`加拿大\` / \`캐나다\` / \`كندا\` / \`קנדה\` / \`Καναδάς\` / \`Канада\` / \`कनाडा\`
   - "Sami" → \`サーミ\` / \`萨米\` / \`사미\` / \`سامي\` / \`סאמי\` / \`Σάμι\` / \`саамы\` / \`सामी\`
   - "Alaska", "Norway", "Sweden", "Finland", "Russia", "Pacific Ocean", "Evenki", "Khanty", "Nenets", "Dene", "First Nations" — all transliterated.
5. **No digits in \`tts.text\`.** Spell out any numbers (including months like "June" — spell in words, not "6月" / "6"). For Korean specifically, use Sino-Korean month names (유월, 칠월, 팔월, 시월).
6. **No hyphens or em-dashes in \`tts.text\`.** Replace with a space or natural punctuation. Malay reduplication (\`berjuta-juta\`) must be \`berjuta juta\` (space) in \`tts.text\`; display \`text\` matches (also space).
7. **Hebrew only**: \`tts.text\` MUST include full nikkud on every consonant; \`text\` MUST be nikkud-stripped identical to \`tts.text\`. If you cannot produce reliable nikkud, leave \`tts.text\` unpointed and downstream will run \`add-nikkud-to-tts.py\`.
8. **Heading-level-1 segments** (\`block_type: "heading"\`, \`heading_level: 1\`) are display-only. Translate their \`text\` and \`text_markdown\`; do not add or modify a \`tts\` field.
9. Set \`text_markdown\` = \`text\` for every segment (both fields identical after translation).

**Tone**: warm, plain-spoken, third-person tour-guide. Present tense preferred. Sentences 8-14 words. Match the calm of a public-broadcasting nature documentary. No academic register, no marketing register, no emotional hype.

**After writing**: run
\`\`\`
python3 -c "import json; d=json.load(open('$OUT')); assert len(d['segments'])==$NSEG; assert all((s.get('text') or '').strip() for s in d['segments']); print('OK', len(d['segments']))"
\`\`\`
and paste its output as the last line of your response. If the assertion fails, fix and retry.

Do not open any other file. Do not modify the source. Report only "DONE: $NSEG segments" or the specific failure.
PROMPT_EOF

echo "[$(date +%T)] [$LANG] codex translate → $OUT"

# codex exec with --dangerously-bypass-approvals-and-sandbox is the
# required flag for headless writes (per feedback_codex_sandbox_flag.md).
codex exec --dangerously-bypass-approvals-and-sandbox --cd "$PACK" "$(cat $PROMPT_FILE)" \
  > /tmp/tundra_translate_${LANG}.log 2>&1
CODEX_RC=$?
echo "[$(date +%T)] [$LANG] codex rc=$CODEX_RC"

# Verify output
if [ ! -f "$OUT" ]; then
  echo "codex did not write $OUT — falling back to Claude subagent"
  # This fallback is exercised only when codex fails outright.
  claude -p "Translate the tundra book to $LANG_NAME. Read the prompt at $PROMPT_FILE and follow it exactly. The output file $OUT does not yet exist — write it." \
    --dangerously-skip-permissions \
    --allowedTools "Read,Write,Bash" \
    > /tmp/tundra_translate_${LANG}_claude.log 2>&1
fi

# Final verification
/home/skyl/tts_venv/bin/python -c "
import json
d = json.load(open('$OUT'))
assert len(d['segments'])==$NSEG, f'expected $NSEG got {len(d[\"segments\"])}'
assert all((s.get('text') or '').strip() for s in d['segments']), 'empty text'
print('  OK: $NSEG segments, all text non-empty')
"
