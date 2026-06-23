# Stargate Reader

An immersive 3D audiobook experience built as a Corpan pack. Words stream through space in precise sync with narrated audio, creating a cinematic reading experience inspired by the Star Wars opening crawl — but driven by real speech timing.

## The Vision

Traditional audiobooks are passive. You listen, your eyes wander, and your mind drifts. Traditional reading is silent. Stargate Reader fuses both into a single experience: **you watch the words arrive as you hear them spoken**, floating toward you through a starfield like transmissions from deep space.

The core insight is that modern TTS pipelines produce **word-level timestamps** via forced alignment (Whisper + stable-ts). These timestamps let us place every word in 3D space at the exact z-position corresponding to when it will be spoken. As the audio plays, words flow toward the viewer, pass through a glowing oscilloscope at z=0 (the "now" plane), and recede into the past. The currently-spoken word glows brighter and scales up. The result feels like the text is alive — breathing, moving, arriving.

This is not a gimmick. For language learners, dyslexic readers, or anyone who struggles to stay engaged with long-form text, synchronized audio-visual presentation creates a scaffold that holds attention. For everyone else, it's just a beautiful way to experience a book.

## Architecture

### Data Pipeline

Stargate Reader consumes two JSON files produced by the `generate_audio.py` pipeline:

```
segments.json              Book structure: segments with text, chapter info, pause timing
audio_manifest_en.json     Per-segment audio paths + word-level timestamps from forced alignment
```

The `generate_audio.py` pipeline (in `books/fascinating-curiosities/scripts/`) does:

1. **Chatterbox TTS** generates narration from a voice sample (speaker cloning)
2. **stable-ts** (Whisper-based forced alignment) produces exact `{word, start_ms, end_ms}` for every word
3. **ffmpeg** encodes to Opus for compact delivery
4. The manifest records all timing data

At runtime, `timeline.ts` flattens every word across all segments into one continuous timeline with absolute millisecond timestamps. This is the single source of truth that drives both audio playback and visual positioning.

### Rendering (Babylon.js)

Three visual layers compose the scene:

**Word Stream** (`rendering/wordStream.ts`)
- Pool of 120 reusable plane meshes with DynamicTexture text rendering
- Z-position derived from: `z = (wordTimestamp - currentPlaybackMs) / MS_PER_Z_UNIT`
- Star Wars crawl curve: `y = baseY - 0.003 * z²` (words tilt away with distance)
- 8 words per line, centered horizontally
- Color states: bright cyan (current), white (upcoming), dim blue (past)
- Fade zones: appear at z=50, full at z=40, fade out at z=-8

**Oscilloscope** (`rendering/oscilloscope.ts`)
- Babylon.js Ribbon mesh fixed at z=0 (the "now" plane)
- Driven by Web Audio AnalyserNode time-domain data
- Neon cyan with intensity-based red shift — pulses with the voice
- Additive blending for glow

**Starfield** (`rendering/starfield.ts`)
- 2000 particles drifting slowly forward
- White-to-blue fade, additive blending
- Provides depth perception and atmosphere

### Audio Engine (`audio/audioEngine.ts`)

Web Audio API wrapper handling:
- **Sequential segment playback** with inter-segment pauses
- **Preloading** 3 segments ahead to prevent stutter
- **Precise time tracking** using AudioContext.currentTime (not Date.now)
- **AnalyserNode** feeding real-time waveform data to the oscilloscope
- **Play/pause/seek** with sub-segment resume support

### Render Loop (`game.ts`)

Every frame at 60fps:
1. Query `audioEngine.getCurrentTimeMs()` for absolute book position
2. Binary search the timeline to find the current word index
3. Update word stream positions, scales, colors, visibility
4. Read AnalyserNode waveform data, compute RMS intensity
5. Update oscilloscope ribbon shape and color
6. Babylon.js renders the scene

## Feeding a New Corpus

To create a Stargate Reader experience for any book:

### 1. Prepare segments.json

Structure your text into segments — each one a paragraph or natural pause point:

```json
{
  "version": "1.0.0",
  "book_id": "your_book_id",
  "total_segments": 42,
  "segments": [
    {
      "id": "ch01-001",
      "part": 1,
      "chapter": 1,
      "title": "Chapter 1 — The Beginning",
      "text": "The actual paragraph text.",
      "tts": {
        "text": "The actual paragraph text.",
        "pause_after_ms": 800
      }
    }
  ]
}
```

### 2. Generate audio + alignment

```bash
python generate_audio.py \
    --segments path/to/segments.json \
    --voice path/to/voice-sample.wav \
    --language en \
    --output-dir path/to/pack/audio/en \
    --manifest path/to/pack/audio_manifest_en.json \
    --format opus \
    --device cuda
```

This produces Opus files and a manifest with word-level timestamps. The voice sample should be 10-60 seconds of the target voice reading naturally.

### 3. Tuning voice fidelity

`generate_audio.py` exposes all Chatterbox parameters:

| Parameter | Default | Effect |
|-----------|---------|--------|
| `--cfg-weight` | 0.5 | Classifier-Free Guidance — higher = stronger voice match |
| `--exaggeration` | 0.5 | Speaker characteristic emphasis |
| `--temperature` | 0.8 | Sampling randomness — lower = more conservative |
| `--top-p` | 1.0 | Nucleus sampling — lower = cuts tail artifacts |
| `--min-p` | 0.05 | Minimum token probability threshold |

Use `compare_voices.py` to generate A/B samples at different presets before committing to a full run.

### 4. Place data for the pack

The pack loads data relative to its root:
- `segments.json` — book structure
- `audio_manifest_en.json` — timing data
- `audio/en/*.opus` — audio files

In dev mode (localhost), it looks under `/mock-data/`. In production, it loads from the pack's installed directory.

## Corpan Pack Integration

Stargate Reader implements the Corpan Pack Module protocol:

```typescript
// Registered globally for host discovery
window.CorpanGames["stargate_reader"] = { mount }

// mount(container, hostApi, initialState?)
// container: DOM element to render into
// hostApi: Corpan host API (currently unused — self-contained data)
// initialState: optional pre-loaded segments/manifest data
```

The pack is self-contained — it loads its own book data rather than pulling entries from the Corpan host API. This is by design: Stargate Reader is a **long-form narrative experience**, not a flashcard game. The host provides the container and lifecycle; the pack provides everything else.

## Key Constants (`core/constants.ts`)

All visual parameters are tunable:

| Constant | Value | What it controls |
|----------|-------|-----------------|
| `MS_PER_Z_UNIT` | 200 | Time-to-space mapping (higher = more spread out) |
| `LOOK_AHEAD_Z` | 60 | How far ahead words render |
| `CRAWL_CURVE_STRENGTH` | 0.003 | How aggressively words tilt away |
| `CURRENT_WORD_SCALE` | 1.3 | Highlight scale for active word |
| `WORD_POOL_SIZE` | 120 | Max simultaneous word meshes |
| `OSCILLOSCOPE_WIDTH` | 16 | Width of the waveform ribbon |
| `GLOW_INTENSITY` | 0.6 | Neon glow strength |
| `WORDS_PER_LINE` | 8 | Line wrap threshold |
| `CAMERA_FOV` | 0.8 | Field of view (radians) |
| `PRELOAD_AHEAD` | 3 | Audio segments to prefetch |

## Development

```bash
cd corpan/packs/stargate-reader
npm install
npm run dev          # Vite dev server at localhost:5173
npm run build        # Produces dist/app.js + dist/app.css
```

Dev mode auto-mounts with a mock host API and loads data from `public/mock-data/`. Place your `segments.json`, `audio_manifest_en.json`, and `audio/en/*.opus` there.

## Future Directions

- **Multi-language**: Load different audio manifests for different languages — same visual timeline, different narration
- **Interactive vocabulary**: Tap a word mid-flight to see translation, definition, or pronunciation
- **Spatial audio**: Position narration in 3D space to match word positions (Web Audio panning)
- **Reading modes**: Karaoke mode (highlight in-place), crawl mode (current), tunnel mode (words form a cylinder)
- **Gesture controls**: Pinch to adjust playback speed, swipe to scrub timeline
- **Chapter navigation**: Jump between chapters with visual transition
- **Accessibility**: High-contrast mode, adjustable text size, screen reader compatibility
- **Performance**: WebGPU rendering path, instanced word meshes for lower draw calls

## File Map

```
src/
├── main.ts                    Module registration + dev mount
├── game.ts                    Scene setup, render loop, UI, orchestration
├── core/
│   ├── types.ts               TypeScript interfaces
│   ├── constants.ts           All tunable parameters
│   └── timeline.ts            Segment → flat timeline builder, binary search
├── data/
│   └── segmentLoader.ts       JSON fetching + caching
├── audio/
│   └── audioEngine.ts         Web Audio playback, sync, preload, FFT
├── rendering/
│   ├── wordStream.ts          3D word mesh pool + layout
│   ├── oscilloscope.ts        Waveform ribbon visualization
│   └── starfield.ts           Background particle system
├── sdk/
│   ├── types.ts               Corpan pack protocol interfaces
│   └── mockHostApi.ts         Dev-mode mock host
└── styles.css                 UI overlay styles
```
