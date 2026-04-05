# Corpan Narration System — Complete Architecture

## What We Do

We generate high-quality audiobook narrations from text manuscripts in multiple languages, package them as downloadable content packs, and serve them via CDN to mobile/desktop reader apps (Earthgate and Stargate). Users hear a cloned voice reading books with word-level synchronized highlighting.

## Why Pre-generated Audio, Not On-Device TTS

1. **Quality**: We run extensive validation (12 checks), retry loops (40+ attempts), whisper alignment, mastering, and human review. On-device TTS can't do any of this.
2. **Consistency**: Every user hears the exact same narration. No device-dependent quality variation.
3. **Word-level sync**: We generate word-level timestamps via Whisper forced alignment. The reader highlights each word as it's spoken. This requires offline alignment, not real-time TTS.
4. **Offline playback**: Packs are downloaded once, then play without network. On-device TTS models are 300MB-4GB per language.
5. **Voice cloning**: We clone a specific narrator voice from a 15-second WAV reference. On-device voice cloning isn't mature enough for production quality.
6. **Multi-language from one voice**: The same cloned voice speaks 23 languages. Each language narration is a separate downloadable pack.
7. **Economics**: A 15-20MB pack (AAC audio + manifest) is smaller than shipping a TTS model per language. For audiobooks that will be listened to repeatedly by millions of users, pre-generated audio amortizes the generation cost.

## The Pipeline: Manuscript → Published Narration Pack

```
Manuscript (.md files)
    ↓ generate_segments.py
Segments (segments.json) — sentence-level text with metadata
    ↓ translate (Claude subagents)
Translated Segments (segments_{lang}.json) — same structure, target language
    ↓ ttsctl generate (Chatterbox Multilingual TTS, 23 languages)
Raw Audio (WAV, 24kHz mono)
    ↓ stable-ts (Whisper forced alignment, medium model)
Word Timestamps (alignment_{lang}.json) — word-level start_ms/end_ms
    ↓ validation (12 checks)
Quality Gate — retries with jittered params until all checks pass
    ↓ mastering (ffmpeg: normalize + highpass + declicker + denoiser + compressor + limiter)
Mastered Audio (M4A, AAC 64kbps)
    ↓ manifest builder
Audio Manifest (audio_manifest_{lang}.json) — durations + word timestamps + display text
    ↓ ttsctl publish
ZIP Package → S3 → CloudFront CDN → catalog.json
    ↓
Reader Apps (Earthgate/Stargate) download pack, play with word-level highlighting
```

## Segment Schema (v2.0.0)

Each segment is one sentence. Fields:
- `id`: `ch{chapter:02d}-{seq:03d}` (e.g., `ch01-042`)
- `block_type`: `text`, `heading`, `image`, `list_item`, `blockquote`, `code_block`, `hr`
- `text`: display text (what the user reads)
- `text_markdown`: markdown-formatted display text
- `tts.text`: what the TTS model speaks (may differ from `text` for pronunciation)
- `tts.pause_after_ms`: silence after this segment (500ms mid-paragraph, 800ms end, 2000ms first)
- `tts.repetition_penalty`: per-segment penalty computed from word uniqueness (1.2-2.0)

Headings have NO `tts` field — they are NOT narrated.

## Primary Language Support

Books can have any primary language. `segments.json` contains the source language text. Translations (including English if the source isn't English) go in `segments_{lang}.json`.

Example: Genesis has `primary_language: "he"` (Hebrew). Its `segments.json` is Hebrew. The English narration uses `segments_en.json`.

The `segments_file(pack_dir, lang)` function in `ttsctl/config.py` handles this by reading `primary_language` from `manifest.json`.

## TTS Engine

- **Model**: Chatterbox Multilingual TTS (`ChatterboxMultilingualTTS`) — 23 languages, voice cloning
- **Package**: `chatterbox-tts` 0.1.7 (MIT license, Resemble AI)
- **Voice cloning**: 15-second WAV reference per voice (zero-shot)
- **Voice mapping**: per-language in `narration.yaml` (e.g., `en: ian-new-narration-try-more-chill-clear.wav`)
- **TTS params**: `cfg_weight`, `exaggeration`, `temperature`, `top_p`, `min_p`, `repetition_penalty`
- **Per-segment overrides**: via `narration.yaml` overrides section or `tts.repetition_penalty` in segments

Note: Chatterbox also has a "Turbo" model (English-only, ultra-fast). We use the Multilingual model for all languages.

## Whisper Alignment

- **Model**: stable-ts with Whisper `medium` (upgraded from `base` for better first-word detection)
- **Purpose**: forced alignment — maps each word in the TTS text to start_ms/end_ms in the audio
- **Output**: `alignment_{lang}.json` — used for word-level highlighting in the reader
- **Display text mapping**: manifest words use the `text` (display) field, not `tts.text` (phonetic), so the reader shows correct spelling even when TTS uses pronunciation substitutions

## Validation (12 Checks)

Alignment-based:
1. **Zero-duration words** — any word with start_ms == end_ms (model didn't speak it)
2. **Word count ratio (low)** — fewer aligned words than expected (model skipped words)
3. **Word count ratio (high)** — more aligned words than expected (model hallucinated)
4. **Trailing silence** — too much or too little after last word
5. **Duration sanity** — audio length vs text-length expectations (language-aware)
6. **Mid-phrase gaps** — large silence between words (noise/babble)
7. **Word overlap** — negative gaps (broken alignment)
8. **Short words** — too many words below 30ms
9. **Word cluster** — too many words in narrow time window
10. **Raw digits** — arabic numerals in TTS text (causes garbled output)

Waveform-based:
11. **Tail spike** — loud pop/click after speech
12. **Tail energy** — model babble/repetition in tail
13. **Hard ending** — audio ends while speech still active (TTS stopped mid-word)
14. **Front clip** — first phoneme truncated

Also: `no_words` (empty alignment), `wav_read_error` (corrupt audio), `alignment_overshoot` (words extend past audio end)

## Convergence Loop

The pipeline loops until ALL segments reach DONE:
1. Generate TTS → Align → Validate → Trim → Master
2. Failed segments get RETRY with jittered TTS params (25% jitter, 10 retry schedules)
3. After max_retries (40), segments that won't converge need `tts.text` rewriting
4. Text rewrites are done by Claude subagents — different phrasing, same meaning
5. NEVER hard-trim `hard_ending` failures — only `tail_energy`/`tail_spike` can be trimmed

## Audio Mastering Chain (ffmpeg)

```
gain normalization → highpass (80Hz) → declicker → FFT denoiser →
noise gate → compressor (2:1) → limiter → AAC encode (64kbps M4A)
```

Target: -22 LUFS, -3 dBTP

## Pack Structure (ZIP)

```
{pack-id}/
├── manifest.json          # Narration metadata
├── segments.json          # Source language segments
├── segments_{lang}.json   # This language's segments
├── audio_manifest_{lang}.json  # Durations + word timestamps
├── audio/{lang}/*.m4a     # Mastered audio files
└── dist/                  # Reader app (app.js + app.css)
```

## Publishing

- **Storage**: S3 bucket `corpan-prod` (us-east-2)
- **CDN**: CloudFront `d38iwc9748jekz.cloudfront.net`
- **Catalog**: `catalog.json` — lists all available narration packs
- **Cache**: `Cache-Control: max-age=60, stale-while-revalidate=300` on catalog.json
- **Reader refresh**: No localStorage TTL cache — fetches fresh catalog with `?_t=` cache buster on every browse
- **Version bumps**: Each narration has independent version. Bump patch on audio quality improvements.

## Reader Integration

The Stargate/Earthgate readers:
1. Load segments + audio manifest from the downloaded pack
2. Play audio segments sequentially
3. Highlight the current word using word-level timestamps from the manifest
4. Show chapter titles from segment `title` field
5. Support language switching (download additional narration packs for the same book)
6. Work fully offline after pack download

## Hardware

- **GPU**: NVIDIA DGX Spark GB10 (Blackwell, sm_121, 128GB unified memory)
- **CUDA**: 13.0, PyTorch cu130
- **TTS generation**: ~2s/segment on GPU
- **Alignment**: ~314ms/segment with Whisper medium on GPU
- **Mastering**: CPU-only (ffmpeg), ~100ms/segment

## Current Scale

- **7 books**: 4 U10 soccer + Genesis + Monte Albán + Unconquered People
- **41 narration packs** published across 10 languages
- **~35,000 audio segments** total
- **Languages**: EN, ES, PT, IT, FR, DE, AR, ZH, HE, KO

## Quality Standards

- Zero validation failures before publishing
- No arabic numerals in TTS text
- No heading audio in manifests
- Display text (not phonetic) in manifest word entries
- Proper primary_language handling for non-English source books
- Human QA listening with iterative resync for any flagged segments
