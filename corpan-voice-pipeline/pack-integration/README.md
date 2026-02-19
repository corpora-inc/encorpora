# Corpán Voice Pipeline
## Custom AI Voice Generation for Book Packs

### What This Is

A pipeline that generates high-quality audiobook narration using open-source
AI voice cloning. Record your voice once (15 seconds), and the system produces
natural-sounding narration in any of 23+ languages — all from that single
sample. The audio ships inside Corpán book packs for fully offline playback.

### Why It Matters

- **Custom branded voice** — not generic device TTS, but a consistent narrator
- **23 languages** from one voice sample (Chatterbox Multilingual)
- **Fully open source** — MIT licensed, no subscriptions, no per-word fees
- **Offline-first** — audio bundles into packs, works anywhere
- **One-time generation** — run once, ship forever

### What It Costs

Nothing. Zero ongoing cost. The models are free (MIT / Apache 2.0).
The DGX Spark we already have does the generation. Once audio is generated,
it's just WAV/Opus files in a pack.

For comparison: ElevenLabs would cost ~$99-330/month for this volume of
generation, per language, ongoing. This pipeline is $0 after setup.

---

## Architecture

```
┌──────────────┐      HTTP       ┌──────────────────────┐
│  Your Mac    │ ──────────────→ │  DGX Spark           │
│              │  submit jobs    │                      │
│  generate_   │  poll status    │  voice_server.py     │
│  book_audio  │  download WAVs  │  (FastAPI + queue)   │
│  .py         │                 │                      │
│              │ ←────────────── │  Chatterbox (23 lang)│
│              │  audio files    │  Qwen3-TTS (10 lang) │
└──────────────┘                 └──────────────────────┘
       │
       ↓
┌──────────────┐
│ Book Pack    │
│ audio/en/    │  ← Pre-generated narration
│ audio/es/    │
│ segments.json│
│ reader.ts    │  ← Plays audio, falls back to hostApi.speak()
└──────────────┘
```

---

## Setup on DGX Spark (One-Time, ~15 minutes)

### 1. Create environment

```bash
conda create -yn corpan-voice python=3.11
conda activate corpan-voice
```

### 2. Install dependencies

```bash
cd /path/to/corpan-voice-pipeline/server
pip install -r requirements.txt
```

This downloads the Chatterbox model (~2GB) from HuggingFace on first run.

### 3. Start the server

```bash
uvicorn voice_server:app --host 0.0.0.0 --port 8700
```

The server is now accessible from any machine on your network.

### 4. Verify it's running

From your Mac:
```bash
curl http://<spark-ip>:8700/status
```

Or open in browser: `http://<spark-ip>:8700/docs` (interactive API docs)

---

## Workflow (From Your Mac)

### Step 1: Record your voice

Record 10-15 seconds of clean audio reading anything in English.
Use GarageBand, Voice Memos, or any DAW. Export as WAV.

Tips:
- Quiet room, no background noise
- Consistent distance from mic
- Natural speaking pace (like reading a book aloud)
- 24kHz sample rate or higher

### Step 2: Upload your voice profile

```bash
python generate_book_audio.py \
    --server http://<spark-ip>:8700 \
    --upload-voice ian-narration ~/voice-samples/ian-narration.wav
```

### Step 3: Test with a single sentence

```bash
python generate_book_audio.py \
    --server http://<spark-ip>:8700 \
    --test ian-narration en \
    "Imagine standing on top of a mountain that humans have shaped for over a thousand years."
```

Listen to the output. Adjust exaggeration/cfg if needed.

### Step 4: Generate a full book

```bash
# English narration
python generate_book_audio.py \
    --server http://<spark-ip>:8700 \
    --segments /path/to/pack/segments.json \
    --voice ian-narration \
    --language en \
    --output /path/to/pack/audio/en/

# Spanish narration (same voice, different language)
python generate_book_audio.py \
    --server http://<spark-ip>:8700 \
    --segments /path/to/pack/segments.json \
    --voice ian-narration \
    --language es \
    --output /path/to/pack/audio/es/
```

### Step 5: Build the pack

```bash
cd books/fascinating-curiosities/01-mystery-of-monte-alban
make audio-release    # Generate → compress → clean
make pack             # Build the Corpán book pack
```

---

## Size Estimates

| Content               | WAV (raw)  | Opus (compressed) |
|----------------------|------------|-------------------|
| 1 chapter (~15 min)  | ~150 MB    | ~7 MB             |
| Full book (~3 hours) | ~1.8 GB    | ~140 MB           |
| Book × 2 languages   | ~3.6 GB    | ~280 MB           |

Opus at 64kbps is excellent quality for speech — indistinguishable from
WAV to most listeners, at 1/13th the file size.

## Generation Time Estimates (DGX Spark B200)

| Content               | Estimated Time |
|----------------------|----------------|
| 1 sentence           | ~1-2 seconds   |
| 1 chapter (~15 min)  | ~5-8 minutes   |
| Full book (~3 hours) | ~45-60 minutes |
| Book × 2 languages   | ~90-120 minutes|

Generation is faster than real-time on the B200. Submit a job, go get
coffee, come back to a complete audiobook.

---

## Licensing

| Component                | License    | Commercial Use |
|--------------------------|------------|----------------|
| Chatterbox (Resemble AI) | MIT        | ✅ Yes         |
| Chatterbox Multilingual  | MIT        | ✅ Yes         |
| Qwen3-TTS (Alibaba)      | Apache 2.0 | ✅ Yes         |
| Generated audio          | Yours      | ✅ Yes         |

The audio you generate is your content. You own it. You can sell it,
distribute it, bundle it in Corpán packs — no restrictions.

Note: Chatterbox embeds an imperceptible PerTh watermark in generated
audio (inaudible, detectable only with their library). It does not affect
quality or usability. Qwen3-TTS has no watermark.

---

## Files in This Pipeline

```
corpan-voice-pipeline/
├── server/
│   ├── voice_server.py          # FastAPI server (runs on Spark)
│   └── requirements.txt         # Python dependencies
│
├── scripts/
│   └── generate_book_audio.py   # CLI tool (run from your Mac)
│
└── pack-integration/
    ├── tts-config.yaml          # Per-book TTS settings
    ├── book-audio-player.ts     # Reader audio module
    └── Makefile.audio           # Build targets for audio pipeline
```

---

## Next Steps

1. ✅ Record voice sample (Ian, 15 sec)
2. ✅ Set up server on DGX Spark
3. ✅ Upload voice profile
4. ✅ Test single sentence (English + Spanish)
5. ✅ Generate Chapter 1 of Monte Albán (both languages)
6. ✅ Listen, review, tune parameters
7. ✅ Generate full book
8. ✅ Integrate into pack build pipeline
9. 🔜 Ship with Corpán
