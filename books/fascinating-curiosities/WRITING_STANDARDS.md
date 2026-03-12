# Writing Standards for Narration Packs

## Numbers and Dates

**NEVER use Arabic numerals (0-9) in segment text.** All numbers, dates, years,
counts, and measurements must be spelled out idiomatically in the target language.

- English: "in the year fifteen forty-two" (not "in 1542")
- Spanish: "en el ano mil quinientos cuarenta y dos" (not "en 1542")
- French: "en l'an mille cinq cent quarante-deux" (not "en 1542")
- Chinese: "一五四二年" (not "1542年")
- Arabic: "عام الف وخمسمائة واثنين واربعين" (not "عام 1542")

Use the phrasing a native speaker would naturally use when reading aloud.
A date like 1542 may be read differently depending on context:
- "the year fifteen forty-two" (casual/narrative)
- "fifteen hundred and forty-two" (formal)
- "mil quinientos cuarenta y dos" (Spanish standard)

The TTS engine reads Arabic numerals unpredictably -- sometimes digit-by-digit,
sometimes garbled. Spelled-out numbers always produce correct audio.

Counts and measurements: "about two thousand five hundred" not "about 2,500".
Decades: "the fifteen twenties" or "la decada de mil quinientos veinte" not "the 1520s".
Ranges: "from five hundred to one hundred BCE" not "from 500-100 BCE".

## Parenthetical Content

**NEVER include parenthetical pronunciation guides.** Examples of what NOT to do:
- "Maguey (Mah-GAY)" -- NO
- "San Jose Mogote (san ho-ZAY mo-GO-teh)" -- NO
- "Oaxaca (wah-HAH-kah)" -- NO

If a word needs pronunciation help for the TTS, use `pronunciation_overrides.yaml`
in the pack directory. This maps display text to phonetic text without polluting
the visible content: `Maguey: Mahgay`

**NEVER include foreign-script glosses in parentheses for non-Latin languages.**
- Chinese: "马普切" not "马普切（Mapuche）" -- the TTS reads the Latin text aloud
- Arabic: "الماپوتشي" not "الماپوتشي (Mapuche)" -- same problem

If the original term is needed for educational context, integrate it into the
sentence naturally: "the Mapuche people -- known as 马普切 in Chinese -- ..."
Or use a footnote/glossary segment, not inline parentheticals.

**Other parentheticals** (clarifications, date ranges) are acceptable if they
read naturally aloud. Test by reading the sentence aloud -- if the parenthetical
sounds natural when spoken, it's fine.

## TTS Text Field (`tts.text`)

The `tts.text` field controls what the TTS model speaks. The `text` field controls
what the reader displays. Both must stay semantically aligned because the reader
highlights words during playback based on the TTS audio.

- `tts.text` should be a speakable version of `text`
- Numbers must be spelled out in BOTH fields (they must match)
- Pronunciation substitutions (e.g., "Wahaka" for "Oaxaca") go in `tts.text` only
  AND in `pronunciation_overrides.yaml`

## Quality Checks

Before publishing any narration pack, run:
```bash
ttsctl normalize $PACK --lang $LANG  # detects digits, pronunciation parens, glosses
ttsctl validate $PACK --lang $LANG   # checks audio alignment quality
```

Zero violations from `ttsctl normalize` is a publishing gate.
