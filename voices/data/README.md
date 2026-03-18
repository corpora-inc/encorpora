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

## Retired / DO NOT USE

- **`ian-narration.wav`** (V1-ian-original): RETIRED. Produces unstable output,
  inconsistent durations, frequent garbage tails. Do NOT restore from git history
  or S3. It has been permanently deleted from both.
