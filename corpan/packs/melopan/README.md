# Melopan

Make music in any language.

A lightweight, offline-first DAW pack for corpan. Voice clones and the
multilingual phrase corpus are first-class instruments: kick-snare-hat
on a 16-step grid, plus a "voice pad" that plays back curated samples
(`mountain`, `fire`, `water`, `breath` …) rendered offline via the corpan
Chatterbox pipeline.

This pack lives at `corpan/packs/melopan/` and does not touch corpan
core or corpan-app. Shipping is independent.

## Quick start (dev)

```bash
cd corpan/packs/melopan
npm install
npm run dev            # vite dev server (standalone, mock host API)
# OR
npm run dev:corpan     # build:watch + http.server :8989, for loading into corpan-app
```

Open the printed URL. The default project plays a 4-on-the-floor beat
with a voice on beat 1 as soon as you hit play.

## Generating the voice kit

The voice pad ships with a synth-vox fallback so the pack is playable
immediately. For real voice samples, run:

```bash
# requires corpan/voices/ environment + reference WAVs hydrated from S3
python3 scripts/generate-voice-kit.py
# or for a single voice / word
python3 scripts/generate-voice-kit.py --voice ian --word mountain
```

Output lands in `public/voice-kit/{voice}/{word}.ogg` and is bundled
into the build automatically.

See [CHANGELOG.md](./CHANGELOG.md) and [THIRD_PARTY.md](./THIRD_PARTY.md).
