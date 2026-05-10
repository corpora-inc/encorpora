# Voice Clone Reference Files

These WAV files are reference audio for Chatterbox TTS voice cloning.
Backed up to `s3://corpan-prod/artifacts/voices/`.

## Active Voices

| File | Preset Name | Notes |
|------|-------------|-------|
| `ian-new-narration-spanish-loud.wav` | V2-spanish-loud | Good projection, clear |
| `ian-new-narration-try-chinese.wav` | V3-chinese | Consistent lengths |
| `ian-new-narration-try-more-chill-clear.wav` | V4-chill-clear | Calm, clear narration |
| `flo-new-english.wav` | V5-flo-english | Female voice |
| `flo-new-spanish.wav` | V6-flo-spanish | Female voice |
| `august-20.wav` | V7-august | Male voice, 20.6s @ 48k/2ch/24-bit, trimmed clone reference. Source: `s3://corpan-assets/corpan-voice-clones/voice clone august 20.wav` |
| `august-raw.wav` | (source) | Raw 80s take, kept for re-trimming experiments. Source: `s3://corpan-assets/corpan-voice-clones/voice clone august raw.wav` |
| `kym-40.wav` | V8-kym | **Canonical narrator clone reference.** Female voice, 38s @ 48k/2ch/24-bit, untouched trim with clean silent intro. Warm middle-aged friend from the American South. Narrates the Food of the World series. |
| `kym-20.wav` | V8-kym (alt) | Female voice, 19.9s @ 48k/2ch/24-bit. Same recording as the click-archive but with 100ms head-trim + 50ms fade-in + 20Hz HPF to remove a leading saturation click. Kept as alt; canonical is kym-40.wav. |
| `kym-raw-cookin.wav` | (source) | Raw 88s take, kept for re-trimming. |
| `kym-raw-dating.wav` | (source) | Raw 96s take, kept for re-trimming. |
| `kym-20-clicked-archive.wav` | (do-not-use) | Original kym-20 with leading saturation click; archived for reference only. |
| `sky-21.wav` | V9-sky | **Canonical Skylar reference.** Male voice, 21.875s @ 48k/2ch/24-bit. Calm, even, late-night-radio cadence. Narrates the Musical Instruments of the World series, beginning with the Oud (Volume 1). |

## Retired / DO NOT USE

- **`ian-narration.wav`** (V1-ian-original): RETIRED. Produces unstable output,
  inconsistent durations, frequent garbage tails. Do NOT restore from git history
  or S3. It has been permanently deleted from both.
