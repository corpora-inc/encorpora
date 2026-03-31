# Monte Albán Book Pack

Stargate-compatible content pack for *The Mystery of Monte Albán — Sacred Mountain, Lost Script, Vanished City* (Volume 1, Fascinating Curiosities of Human History).

## File Inventory

| File | Description |
|------|-------------|
| `manifest.json` | Stargate pack manifest (entry point, metadata) |
| `segments.json` | 1,021 sentence-level segments, English (v2.0.0) |
| `segments_es.json` | 1,021 sentence-level segments, Spanish (v2.0.0) |
| `audio_manifest_en.json` | English audio manifest (996 TTS entries with word-level timestamps) |
| `audio_manifest_es.json` | Spanish audio manifest (996 TTS entries with word-level timestamps) |
| `audio/en/*.opus` | 996 English Opus audio files (Chatterbox TTS, Ian voice) |
| `audio/es/*.opus` | 996 Spanish Opus audio files (Chatterbox Multilingual TTS, Ian voice) |

## Segment Schema (v2.0.0)

Each segment in `segments.json` / `segments_es.json`:

```json
{
  "id": "ch01-021",           // Unique ID: ch{chapter}-{global_sequence}
  "part": 1,                  // Book part (0 = front matter)
  "chapter": 1,               // Chapter number
  "title": "Chapter 1 — ...", // Current chapter/section title
  "paragraph_id": "p8",       // Paragraph identifier
  "sentence_index": 0,        // Sentence position within paragraph
  "block_type": "text",       // One of: heading, text, image, list_item
  "text": "Plain text...",    // Plain text content
  "text_markdown": "...",     // Markdown-formatted content
  "tts": {                    // Only present on narrated segments (996 of 1021)
    "text": "Plain text...",  // TTS input text (= text field)
    "pause_after_ms": 500     // Pause duration after this segment
  }
}
```

Additional fields by block_type:
- `heading`: `heading_level` (1 = part, 2 = chapter)
- `image`: `image`, `image_alt`
- `list_item`: `list_type`, `list_index`

### Segment Counts

- **Total segments**: 1,021
- **TTS segments** (with audio): 996
- **Non-TTS segments**: 25 (headings without narration)
- **Chapters**: 0–15 (ch0 = front matter, ch1–ch14 = body, ch15 = back matter)
- **Block types**: heading (26), text (972), image (15), list_item (8)

## Audio Generation

### English (Chatterbox TTS)

```bash
cd books/fascinating-curiosities/scripts
python generate_audio.py \
    --segments ../01-mystery-of-monte-alban/pack/segments.json \
    --voice ../../../../voices/data/ian-narration.wav \
    --language en \
    --output-dir ../01-mystery-of-monte-alban/pack/audio/en \
    --manifest ../01-mystery-of-monte-alban/pack/audio_manifest_en.json \
    --format opus --resume --device cuda
```

- **Model**: `ChatterboxTTS` from `chatterbox.tts`
- **Voice**: `ian-narration.wav` (English narration sample)
- **Parameters**: `cfg_weight=0.5`, `exaggeration=0.5`, `repetition_penalty=1.2`
- **Alignment**: stable-ts (Whisper-based forced alignment, word-level timestamps)
- **Encoding**: Opus 48kbps VBR via ffmpeg

### Spanish (Chatterbox Multilingual TTS)

```bash
cd books/fascinating-curiosities/scripts
python generate_audio_multilingual.py \
    --segments ../01-mystery-of-monte-alban/pack/segments_es.json \
    --voice ../../../../voices/data/ian-narration.wav \
    --language es --language-id es \
    --output-dir ../01-mystery-of-monte-alban/pack/audio/es \
    --manifest ../01-mystery-of-monte-alban/pack/audio_manifest_es.json \
    --cfg-weight 0.8 --format opus --resume --device cuda
```

- **Model**: `ChatterboxMultilingualTTS` from `chatterbox.mtl_tts` (v0.1.6)
- **Voice**: Same `ian-narration.wav` (works for multilingual voice cloning)
- **Parameters**: `cfg_weight=0.8`, `exaggeration=0.5`, `repetition_penalty=2.0` (higher for multilingual)
- **language_id**: `"es"` passed to `model.generate()`
- **Sample rate**: `model.sr` (24kHz)

## Translation Pipeline

Spanish segments (`segments_es.json`) are produced by:

1. Claude translates all 1,021 segments from English to Spanish
2. `scripts/build_segments_es.py` merges translations with structural metadata from `segments.json`

### Translation Guidelines

- Castilian-neutral Spanish (not overly formal, not regional slang)
- Proper nouns preserved: Monte Albán, Oaxaca, San José Mogote, Teotihuacan, etc.
- Pronunciation guides kept as-is: (MON-teh al-BAHN), (wah-HAH-kah)
- Chapter titles translated: "Chapter 1 — The View from Above" → "Capítulo 1 — La vista desde arriba"
- Part titles translated: "Part One: The Sacred Mountain" → "Primera parte: La montaña sagrada"
- 1:1 sentence mapping (same segment count per paragraph)
- Book titles in Further Reading kept in original language

### What Gets Translated (per segment)

| Field | Rule |
|-------|------|
| `text` | Full translation |
| `text_markdown` | Translation preserving markdown formatting |
| `tts.text` | Same as `text` |
| `title` | Translated chapter/section title |
| `image_alt` | Translated alt text |

### What Stays Identical

`id`, `part`, `chapter`, `paragraph_id`, `sentence_index`, `block_type`, `heading_level`, `image`, `list_type`, `list_index`, `tts.pause_after_ms`

## Audio Manifest Schema

Each audio manifest (`audio_manifest_en.json`, `audio_manifest_es.json`):

```json
{
  "language": "en",
  "voice": "ian-narration",
  "sample_rate": 24000,
  "segments": {
    "ch00-002": {
      "file": "audio/en/ch00-002.opus",
      "duration_ms": 2340,
      "pause_after_ms": 2000,
      "words": [
        {"word": "This", "start_ms": 0, "end_ms": 120},
        {"word": "book", "start_ms": 120, "end_ms": 280}
      ]
    }
  }
}
```

Word-level timestamps enable synchronized text highlighting in the Stargate reader.

## LFS Tracking

Audio files (`.opus`) are tracked via Git LFS. The `.gitattributes` at the repo root handles this:

```
*.opus filter=lfs diff=lfs merge=lfs -text
```

## Stargate Reader Integration

The reader loads segments by language and pairs them with the corresponding audio manifest:
- English: `segments.json` + `audio_manifest_en.json` + `audio/en/`
- Spanish: `segments_es.json` + `audio_manifest_es.json` + `audio/es/`

Segment IDs are stable across languages — the reader can switch languages mid-playback while maintaining position.
