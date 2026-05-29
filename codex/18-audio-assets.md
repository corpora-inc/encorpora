# 18. Audio Assets

## What it is

The audio assets are the rendered narrations that ship with Corpán's
audiobook packs. Each segment of each book in each language has its
own AAC-encoded M4A file at 64 kbps, mastered to a target of -22
LUFS integrated loudness and -3 dBTP true-peak. The files are
served from CloudFront and downloaded by the reader pack at
runtime; the per-segment timing data lives alongside in the audio
manifest (section 17), and the rendering pipeline that produces
them lives on the DGX Spark (section 22).

There is also a second class of audio asset: the **voice clone
reference** files. These are 15-second WAV recordings of each
narrator (Ian, Skylar, Ron, Vindy, August, Flo, and others) that
the TTS model uses as the cloning prompt. They live outside the
repo on Jeff's machine at `~/Desktop/corpan-voice-clones/` for the
working copies, and on S3 under `sources/voices/data/` for the
durable copies.

A third class lives inside pack zips for the few packs that need
small in-bundle vocal samples (Melopán is the canonical case):
16-bit PCM WAV at 24 kHz mono, silence-trimmed, one file per
sample. Why WAV and not Opus is the iOS WebKit codec story below.

## How it fits

The audio assets are the largest single class of artifact the
project ships. A single book in 23 languages is roughly 23 × ~50
segments × ~64 kbps = on the order of 100-200 MB of mastered M4A
total. The phrase corpus database fits in 80 MB; the audio fits
nowhere on a single GitHub release. S3 plus CloudFront is the
answer (section 24).

The audio also sits at the seam between the offline pipeline
(Spark, Chatterbox, Whisper, ffmpeg) and the runtime pack format
(section 17 walks the manifest). The pipeline produces the files
and the manifest as paired artifacts; the runtime trusts them as
paired artifacts. Diverging the two (regenerating audio without
regenerating the manifest) breaks word highlighting in the
reader.

## Files and entry points

### In the repo

- `corpan/NARRATION_SYSTEM.md`: the canonical doc for the
  authoring pipeline. Read first if any of this is unclear.
- `corpan/infra/hydrate-audio.sh`: pulls audio assets from S3
  onto a local machine for offline iteration. The
  `.gitignore`d `**/pack/audio/` directories get populated by
  this script.
- `corpan/infra/sync-voices-to-s3.sh`: pushes voice references
  from `voices/data/` up to S3.
- `corpan/infra/hydrate-voices.sh`: pulls voice references
  back down to `voices/data/` (for a fresh machine).
- `voices/scripts/sample_clone_audition.py`: produces audition
  clips of a candidate voice clone across short sample texts.
- `voices/scripts/sample_clone_premaster_experiment.py` and
  `_targets.py`: the LUFS-targeting experiments for the
  pre-mastering chain.
- `voices/scripts/sample_lra_test*.py`: loudness range tests.
- `voices/data/README.md`: documents the voices/data
  conventions.

### Outside the repo (state-locations note)

- `~/Desktop/corpan-voice-clones/`: Jeff's working copies of
  voice clones and rendered audition samples (per auto-memory).
- S3 bucket `corpan-prod`, region `us-east-2`: the durable
  store for both rendered audio and voice references.
- CloudFront distribution `d38iwc9748jekz.cloudfront.net`: the
  CDN that fronts the bucket for runtime download.
- `~/projects/ttsctl/`: the narration pipeline tool itself
  (lives on the Spark and on Skylar's workstation; not in the
  encorpora repo).

## How it works

### The shipping format: AAC in M4A at 64 kbps

The mastered output of the pipeline is an M4A file per segment
(`audio/<lang>/<segment-id>.m4a`). Encoding choices, from
`NARRATION_SYSTEM.md`:

- **Container**: M4A (MPEG-4 audio).
- **Codec**: AAC.
- **Bitrate**: 64 kbps mono.
- **Sample rate**: 24 kHz.
- **Channels**: mono.
- **Target loudness**: -22 LUFS integrated, -3 dBTP true-peak.

Why these specific numbers:

- **64 kbps AAC** is the lowest bitrate at which a narration
  voice is indistinguishable from the source under casual
  listening. Doubling to 128 kbps would double the bundle size
  for a difference the listener does not hear; halving to 32 kbps
  introduces audible artifacts. The number is the result of
  audition tests across the original voice set.
- **24 kHz** matches Chatterbox's native output sample rate
  (section 20). Resampling to 44.1 or 48 kHz would add CPU and
  bytes for no improvement; the voice's spectral content does
  not exceed 12 kHz.
- **Mono** because narration is mono. Two channels would double
  the file size and add nothing.
- **-22 LUFS** is a few dB below most music streaming targets
  (-14 LUFS) and a few dB above broadcast TV (-23 LUFS). The
  audiobook listening context (often quiet, often in bed) favors
  a softer target than music; -22 was settled on after side-by-
  side listening with Audible-released audiobooks.
- **-3 dBTP** leaves enough true-peak headroom that the codec's
  reconstruction does not clip on any device.

### The mastering chain

ffmpeg processes the raw Chatterbox output through a fixed chain
before encoding. From `NARRATION_SYSTEM.md:111`:

```
gain normalization
    → highpass (80 Hz)
    → declicker
    → FFT denoiser
    → noise gate
    → compressor (2:1)
    → limiter
    → AAC encode (64 kbps M4A)
```

Why each link:

- **Gain normalization** lifts or lowers the segment so its
  measured loudness lands near the target before the rest of
  the chain runs.
- **Highpass at 80 Hz** removes the sub-bass rumble Chatterbox
  occasionally emits on long breath phonemes. Below 80 Hz is
  felt, not heard, on phone speakers and earbuds.
- **Declicker** kills the sharp transients that show up at
  segment boundaries when the generator's residual energy is
  non-zero.
- **FFT denoiser** removes the broadband hiss that Chatterbox
  inherits from the voice clone's recording chain.
- **Noise gate** silences gaps below the speech threshold so
  inter-word breaths are not amplified by later stages.
- **Compressor (2:1)** evens out the dynamic range so quiet
  consonants are intelligible without loud vowels exceeding the
  true-peak limit.
- **Limiter** is the safety net for the true-peak target.
- **AAC encode** produces the M4A.

The chain is the same for every language and every voice. The
discipline is that the input variation (different voices,
different languages, different segment lengths) is absorbed by
the chain, not by the chain's parameters. A voice that needs
custom mastering is a voice that needs a different clone
reference first.

### Voice clones, briefly

Chatterbox is a zero-shot cloning TTS: given a 15-second WAV of
a voice and a text, it produces speech that resembles the voice.
The 15 seconds is the cloning prompt. Section 20 covers the
generation; the asset side is the WAV.

Per-voice files live at (working copies)
`~/Desktop/corpan-voice-clones/<voice-id>/<voice-id>.wav` and
(durable copies) `s3://corpan-prod/sources/voices/data/`. The
`voices/data/` directory in the repo holds only the metadata and
the exercise scripts; the WAVs themselves are gitignored under
`voices/data/*.wav`. Hydration runs `infra/hydrate-voices.sh`.

The pre-mastering scripts under `voices/scripts/` are the
experimentation surface. `sample_clone_premaster_targets.py`
applies a fixed pre-master chain (HPF, denoise, compressor,
loudnorm) at several LUFS targets (-22, -18, -14, etc.) to the
raw reference WAV, producing a per-target variant. The pre-mastered
references are then auditioned in Chatterbox to find the LUFS
target that gives the most consistent generation. The result is
that **voice references are themselves loudnessed** before
cloning, because the model's clone quality is sensitive to the
reference's level.

### The in-zip vocal samples and the iOS WebKit story

A small set of packs (Melopán, currently) bundle short vocal
samples inside the pack zip rather than streaming them. These are
not narrations; they are vocal hits, syllables, atmospherics. The
format choice for these is **not** AAC.

The reason is the iOS WebKit codec gotcha:

> iOS WebKit before iOS 17 silently fails to decode Opus-in-OGG
> via `AudioContext.decodeAudioData`. The load promise rejects;
> the catch clause sets `sampleLoaded = false`; the pack appears
> to load fine but the sample-based instruments produce silence.

Opus-in-OGG was an attractive format (small files, royalty-free,
ffmpeg supports it well). It fell out of contention after a real
shipped incident where a Melopán build worked on every test
device that had iOS 17 and silently failed on every device that
did not.

The shipping choice for in-zip samples is **16-bit PCM WAV at 24
kHz mono with silence trimmed**. A one-second vocal hit ends up
at 30-60 KB; a pack ships its full sample set in under a megabyte
and the iOS < 17 WKWebView decodes it without complaint. AAC in
M4A is a viable alternative for in-zip samples too, if the
target iOS version is verified to support it for the specific
file (the Web Audio decoder for M4A has its own minor quirks).

The smoke test the codebase encodes (per the auto-memory): run a
sample-only smoke test on the oldest target iOS in scope before
declaring a sample-bearing pack shippable. "Pack loads" plus
"sequencer plays" together are not enough; you have to hear the
sample.

### The Fascinating Curiosities pipeline as the worked example

The 12-volume Fascinating Curiosities series is the largest
single audiobook project the pipeline has shipped. At full scale:

- 12 books × ~50 segments × 23 languages = 13,800 segments
- ~30 seconds per segment on average = ~115 hours of audio
- ~7.5 GB of mastered M4A total
- One forced-alignment word table per segment, one audio
  manifest per (book, language) = 276 audio manifests.

The pipeline is the same as for a single book, run repeatedly:

```
manuscript.md
    → generate_segments.py     → segments.json
    → Claude subagent translate → segments_<lang>.json
    → ttsctl generate (Chatterbox)
                              → raw 24 kHz WAV per segment
    → stable-ts (Whisper medium)
                              → alignment_<lang>.json
    → 12-check validator      → retry-or-pass
    → ffmpeg mastering chain  → 64 kbps M4A
    → manifest builder        → audio_manifest_<lang>.json
    → ttsctl publish          → ZIP, S3 upload, catalog.json update
```

Each book runs the loop independently. A typical book at full
scale takes a few GPU-hours per language on the Spark; the 23-
language run is on the order of a day per book if everything
converges, longer if `tts.text` rewrites are needed (section 20
covers the convergence loop).

### Where the assets live during runtime

The reader pack does not ship the audio files in its zip. The
pack zip is `manifest.json` + `dist/` plus the `segments.json`
and `audio_manifest_<lang>.json` files; the audio sits on S3
behind CloudFront and is fetched per segment as playback
approaches. The pack's `manifest.json` (or the audio manifest
itself) carries the CloudFront base URL, and the audio engine
prefetches the next few segments while the current one plays.

This is what makes the on-device install footprint reasonable.
A book pack on disk is single-digit megabytes (manifest + reader
code + audio manifests for the languages the user picked);
playback streams from CloudFront. Cache headers on the audio
files are aggressive (the files never change for a given
version), so a re-listen is offline once the bytes have arrived.

## Common operations

1. **Hydrate audio for local development.**
   `./corpan/infra/hydrate-audio.sh <book-id>` pulls the rendered
   audio for one book from S3 into the local pack directory.
   The `.gitignore`d `audio/` folder gets populated; the
   audio_manifest references resolve.
2. **Upload a freshly mastered book.**
   The pipeline's `ttsctl publish` step does this; the manual
   equivalent is
   `aws s3 sync books/.../pack/audio/<lang>/
   s3://corpan-prod/.../audio/<lang>/`.
3. **Inspect a single segment's loudness.**
   `ffmpeg -i <segment>.m4a -af ebur128 -f null -` reports
   integrated LUFS, true-peak, and loudness range. Confirm the
   shipped target (-22 LUFS, -3 dBTP).
4. **Audition a voice clone variant.**
   `python voices/scripts/sample_clone_audition.py <voice-id>`
   runs the clone against a fixed set of sample texts and writes
   the resulting WAVs into the auditioning directory.
5. **Adjust the pre-master target for a voice.**
   `voices/scripts/sample_clone_premaster_targets.py` produces
   pre-mastered reference variants at several LUFS targets;
   audition them with Chatterbox and pick the target that gives
   the most consistent generation. Write the new reference back
   to S3 with `infra/sync-voices-to-s3.sh`.
6. **Verify an iOS < 17 sample plays.**
   Open the pack in a Safari running on the lowest iOS version
   you intend to support; play a sample-only smoke test. Do not
   rely on "the pack loaded" as evidence.

## Why we built it this way

Pre-generated audio over on-device TTS is the most consequential
decision in Corpán's sound. On-device TTS exists, ships with the
OS, and is free; the trade is that the user's experience varies
by device and OS version, that word-level highlighting is
unavailable, and that voice cloning is not yet shippable on
mobile. The seven reasons enumerated in `NARRATION_SYSTEM.md`
(quality, consistency, sync, offline, cloning, multilingual,
economics) are each individually defensible; together they make
the choice unambiguous for audiobook content.

The mastering chain is the part of the audio side most often
under-appreciated. Without the chain, raw Chatterbox output is
within range of "could ship" but ranges in loudness by 6+ dB
across segments, has audible breath rumble on long phonemes,
and produces occasional clicks at segment boundaries. With the
chain, every segment lands at the same loudness, with the same
spectral character, with no clicks. The user hears one book
read by one voice; the chain is what makes that true.

The 64 kbps AAC choice is the smallest file size that the team
cannot reliably distinguish from the master under blind listen.
The number is empirical, not theoretical. The same choice in
2010 would have landed at 96 or 128 kbps; the AAC encoder has
improved enough since that 64 holds.

The iOS WebKit Opus story is the kind of friction that a
plain-text comment in the auto-memory file is the right place
to capture. The cost of the bug was real; the cost of the
mitigation (WAV instead of Opus for in-zip samples) is a few
hundred kilobytes per pack; the cost of the comment is two
paragraphs. Future selves and future agents read the comment
and do not pay the cost again.

The split between voice references (S3) and rendered audio (S3
plus CloudFront) is one of the places section 26's "state
locations" map is non-trivial. Voice references are inputs to
the pipeline; rendered audio is its output; both live in the
same bucket but in different prefixes. Section 24 walks the
bucket layout.

## To go deeper

- `corpan/NARRATION_SYSTEM.md` end to end. This is the file the
  team treats as authoritative; section 18 is a faithful
  summary, not a replacement.
- `voices/scripts/sample_clone_premaster_targets.py` and
  `sample_clone_audition.py` for the empirical work that
  decided the LUFS targets.
- Section 17 for the audio manifest's word-timing role;
  section 20 for Chatterbox; section 21 for the whisper.cpp
  alignment; section 22 for the Spark; section 24 for the S3
  and CloudFront layout.
