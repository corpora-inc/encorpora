# 20. Chatterbox

## What it is

Chatterbox is the text-to-speech model the audiobook narrations are
rendered with. It is a Python package, `chatterbox-tts`, currently
pinned at version `0.1.7`, MIT-licensed, by Resemble AI. The model
the pipeline uses is `ChatterboxMultilingualTTS`: a single neural
TTS that speaks 23 languages and that performs zero-shot voice
cloning from a 15-second WAV reference. Chatterbox is the engine
that turns a `tts.text` field in `segments.json` into a 24 kHz mono
WAV file of a specific voice reading that text, in any of the 23
supported languages, with no per-voice training step.

The cloning model is the whole point. Without zero-shot cloning,
producing 23-language narrations of one book in one voice would
require recording 23 voice actors or training 23 per-language
voice models. With it, one 15-second recording of Ian is enough to
synthesize hundreds of hours of Ian reading in Spanish, Hebrew,
Mandarin, Arabic, and beyond.

A separate Chatterbox "Turbo" model exists (English-only,
ultra-fast); the pipeline does not use it. All languages use the
multilingual model so the voice character stays consistent across
the catalog.

## How it fits

Chatterbox is the first stage of the offline pipeline. Upstream is
the manuscript and the segments file (sections 17, 19); downstream
is the whisper-based forced alignment (section 21), the
validator, the mastering chain, and the publisher (section 18).
The pipeline orchestrator (`ttsctl`, outside the repo, on the
Spark) drives all of them.

Chatterbox runs on the DGX Spark GPU (section 22) because the
model is large enough that CPU inference would be impractically
slow. The Spark is the only place in the project's hardware
inventory that runs Chatterbox at production scale; the rest of
the team's machines (Jeff's MacBook, Skylar's workstation) can
run it for one-off auditions and short samples, but a 23-language
render of a full book is a Spark job.

## Files and entry points

### In the repo

- `corpan/NARRATION_SYSTEM.md`: the canonical architecture
  doc. Sections "TTS Engine," "Convergence Loop," "Quality
  Standards," and "Hardware" cover the Chatterbox portion.
- `corpan/packs/shared/core/types.ts`: `BookSegment.tts`
  declares the per-segment TTS hint fields (`text`,
  `pause_after_ms`, `repetition_penalty`). Section 17 covers
  the format.
- `voices/data/`: voice clone WAV references (gitignored;
  hydrated from S3 via `infra/hydrate-voices.sh`).
- `voices/scripts/sample_clone_audition.py`: a thin wrapper
  that runs Chatterbox against a candidate voice clone with a
  fixed sample text set. Used to audition new clones.
- `voices/scripts/sample_clone_premaster_targets.py`: produces
  pre-mastered reference variants at several LUFS targets
  (section 18).
- Per-book `packs/<voice>-chatterbox-v<n>/narration.yaml`: the
  pipeline config for one (book, voice, version) tuple. Maps
  per-language voice references, sets TTS params, declares
  per-segment overrides.

### Outside the repo

- `~/projects/ttsctl/`: the narration pipeline. Owns the
  Chatterbox invocation, the convergence loop, the retry
  scheduler, and the per-segment validation feedback. Lives
  on the Spark and on Skylar's workstation.
- The Chatterbox model weights themselves, cached on the Spark
  under the Hugging Face cache directory.

## How it works

### One Chatterbox call, in shape

The pipeline calls Chatterbox once per segment, per language, in
the convergence loop:

```python
from chatterbox.tts import ChatterboxMultilingualTTS

tts = ChatterboxMultilingualTTS.from_pretrained(device="cuda")
wav = tts.generate(
    text=segment.tts.text,
    language_id=lang_code,
    audio_prompt_path=voice_clone_wav_for(voice, lang),
    cfg_weight=...,
    exaggeration=...,
    temperature=...,
    top_p=...,
    min_p=...,
    repetition_penalty=segment.tts.get("repetition_penalty", 2.0),
)
```

(That is the shape, not the literal call site; the literal lives
in `ttsctl`.) Inputs are the spoken text, the target language id,
the path to the voice clone WAV, and a small set of generation
parameters. Output is a 24 kHz mono PCM tensor that the pipeline
writes to disk as a WAV.

### `tts.text` vs `text`

The single most consequential authoring discipline in the
pipeline is the split between `tts.text` (what Chatterbox speaks)
and `text` (what the user reads). They are allowed to differ.
The pipeline encourages it.

The pattern from real books:

| `text` (display)           | `tts.text` (spoken)          |
|----------------------------|------------------------------|
| `1986`                     | `nineteen eighty-six`        |
| `the Olmec`                | `the OHL-mek`                |
| `Chapullines`              | `chahpoolinehs`              |
| `H2O`                      | `H two O`                    |
| `etc.`                     | `et cetera`                  |

Two rules to internalize, both from the auto-memory and section
17:

1. **No raw digits in `tts.text`.** Chatterbox renders arabic
   numerals inconsistently; the validator catches it (the
   `Raw digits` check in section 18) and fails the segment. The
   fix is to spell numerals in `tts.text` while keeping them as
   digits in `text` for the user.
2. **Phonetic nudges in `tts.text` should not use dashes.**
   `chahpoolinehs` works; `chah-poo-lee-nehs` does not. Dashes
   are interpreted by the model and bias generation away from
   the intended phoneme stream. This is the kind of discovery
   the auto-memory keeps so future contributors do not pay the
   cost again.

The pipeline does not try to be clever about this. It speaks
exactly what `tts.text` says, then forced-aligns the result
against `text` (section 21) to get word timestamps the reader
displays. The alignment maps the spoken `chahpoolinehs` to the
displayed `Chapullines` automatically.

### Per-language voice mapping

Voice cloning is one-shot from a 15-second WAV, but the same
voice in a different language often sounds best from a clone
recorded in that language. The pipeline accommodates this
through `narration.yaml`:

```yaml
voice: ian
per_lang:
  en: ian-new-narration-try-more-chill-clear.wav
  es: ian-es-warm-narration.wav
  ko: ian-ko-careful.wav
  # ...
```

A book is "Ian reading"; the actual WAV the model clones from
is picked per language. The Hebrew narration of Genesis uses a
different Ian WAV than the English narration of Three Questions.

### Generation parameters

Chatterbox exposes a handful of generation parameters. The
pipeline sets pipeline-wide defaults and supports per-segment
overrides:

- `cfg_weight`: classifier-free guidance weight. Higher values
  hew closer to the cloned voice timbre at the cost of
  expressive variability.
- `exaggeration`: how dramatic the read is. Audiobook narration
  prefers low values; dialog books (multi-speaker formats) bump
  it up.
- `temperature`, `top_p`, `min_p`: sampling parameters. The
  pipeline uses small temperature and conservative `top_p` to
  keep generations close to the prompt distribution.
- `repetition_penalty`: the per-segment override most often
  tuned. The pipeline computes a default of 1.2-2.0 from the
  word-uniqueness ratio of the segment; very repetitive segments
  ("yes yes yes yes") get a higher penalty to avoid degenerate
  loops.

The `tts.repetition_penalty` field in `segments.json` (section
17) is the per-segment escape hatch.

### The convergence loop

A single Chatterbox call produces a WAV. The pipeline does not
trust it. From `NARRATION_SYSTEM.md`:

```
1. Generate TTS -> Align -> Validate -> Trim -> Master
2. Failed segments get RETRY with jittered TTS params
   (25% jitter, 10 retry schedules)
3. After max_retries (40), segments that won't converge need
   tts.text rewriting
4. Text rewrites are done by Claude subagents - different
   phrasing, same meaning
5. NEVER hard-trim hard_ending failures - only tail_energy /
   tail_spike can be trimmed
```

The loop is the heart of the pipeline. Generate, align,
validate, master; if anything fails, jitter the parameters and
try again; if the segment will not converge after 40 attempts,
rewrite the `tts.text` with an LLM (different phrasing, same
meaning) and start over. The rewrite is a fall-back; most
segments converge in one or two attempts.

The "NEVER hard-trim `hard_ending`" rule is the kind of
discipline encoded into the loop. A `hard_ending` failure
(section 18's check 13) means the model stopped mid-word; the
audio is unusable regardless of trim. Other tail failures
(spike, energy) can sometimes be trimmed; this one cannot. The
pipeline's per-failure handling is recorded in `ttsctl`'s
changelog directory (outside the repo, alongside the tool).

### The validator's feedback

The 12-check validator (section 18 enumerates the checks) is
what tells the loop whether a generation passed. It runs after
alignment, so failures know the word-level structure. Some
failures route to a retry with different parameters; some route
to a trim; some route to the segment being held for human
review. The lessons documented in
`~/projects/ttsctl/changelog/decisions/` (per `PIPELINE_STATE.md`)
cover the per-check calibrations: the Japanese `final_word_weak`
calibration, the catastrophic zero-duration detection, the
Hebrew nikkud requirement, and so on.

The pipeline's quality bar (from `NARRATION_SYSTEM.md`'s "Quality
Standards"): zero validation failures before publishing, no
arabic numerals in TTS text, no heading audio in manifests,
display text in manifest word entries (not phonetic), proper
primary-language handling for non-English source books, human QA
listening with iterative resync for any flagged segments.

### Current shipped scale

Per the snapshot in `NARRATION_SYSTEM.md:159`:

- Seven books (four U10 soccer titles, Genesis, Monte Albán,
  The Unconquered People).
- 41 narration packs published across 10 languages.
- About 35,000 audio segments rendered.
- Languages: EN, ES, PT, IT, FR, DE, AR, ZH, HE, KO.

These are the numbers at the time of `NARRATION_SYSTEM.md`'s
last update; they grow as new books and languages ship. The
canonical accounting lives in
`~/projects/ttsctl/changelog/decisions/`.

## Common operations

1. **Audition a candidate voice clone.**
   `python voices/scripts/sample_clone_audition.py <voice-id>`
   runs Chatterbox against a fixed sample set with the voice's
   current pre-mastered reference. Audition the WAVs that fall
   out.
2. **Add a new language to a book.** Add the language to the
   pipeline's `narration.yaml`. Provide a per-language voice
   reference (or fall through to the default). Translate
   segments using Claude subagents (or the Django admin if
   preferred). Render on the Spark; the convergence loop runs
   until done.
3. **Override `repetition_penalty` for one segment.** Add
   `"repetition_penalty": 1.8` (or whatever) to the segment's
   `tts` block in `segments.json`. Re-render that segment only.
4. **Rewrite a non-converging `tts.text`.** Hand the segment to
   a Claude subagent with the failure mode (e.g. `hard_ending`
   on the last syllable); take the suggested rephrasing; rerun.
   Keep `text` (display) unchanged.
5. **Verify the model speaks what you intend.** For a tricky
   word, render a one-segment test with several `tts.text`
   spellings and audition the results. The right spelling is
   the one that sounds right; the spelling that "looks right"
   often loses to the spelling that sounds right.
6. **Bump a narration pack version.** Re-render with the new
   parameters or text; bump the `version` field in the pack's
   `manifest.json`; promote `[Unreleased]` to a dated entry in
   `CHANGELOG.md`; publish via `ttsctl publish`.

## Why we built it this way

Zero-shot voice cloning is the architectural choice that opens
the language strategy. Without it, a book in 23 languages is 23
voice actors or 23 trained models; with it, it is one 15-second
recording and one Spark job. The trade is that the voice is the
Chatterbox model's interpretation of the reference, not the
reference itself. For long-form audiobook listening, the
interpretation has been good enough; for short-form spoken-word
content where the listener knows the voice intimately, it would
not be.

The convergence loop with jitter is the smallest mechanism that
makes a stochastic generator useful as a pipeline stage. A
deterministic TTS would either always pass or always fail; a
stochastic TTS that retries with jittered parameters converges
on a passing output for almost every segment. The few that do
not converge are the ones where the `tts.text` itself is
fighting the model; the rewrite step is the last resort.

The `tts.text` versus `text` discipline is what makes the
phonetic-nudge work pay for itself. The reader sees correct
spellings (`Chapullines`); the listener hears correct
pronunciations (`chahpoolinehs`); the alignment maps the spoken
nudge back to the displayed spelling. Without the split, the
nudges would leak into the reader; without the nudges, the model
would mispronounce hundreds of named entities per book.

The "no raw digits, no dashes in nudges" rules are entries in
the costliest kind of book in a codebase: the one that lists
the failure modes the pipeline has shipped against. Codifying
them in the auto-memory and in the validator is what keeps
future contributors from rediscovering them.

The pipeline's Python orchestration plus GPU model is the same
pattern as the rest of the producer side (section 19): Python
where the ecosystem is, native where the performance is.

## To go deeper

- `corpan/NARRATION_SYSTEM.md` end to end. Section 20 is a
  faithful summary of the Chatterbox-relevant portions, not a
  replacement.
- The `chatterbox-tts` package README on GitHub for the API
  surface and the model card.
- Section 17 for the `segments.json` shape Chatterbox consumes
  on its left; section 21 for the Whisper alignment that
  consumes Chatterbox's output on its right.
- `~/projects/ttsctl/changelog/decisions/` (on the Spark or
  Skylar's workstation) for the validator calibrations and
  failure-mode discoveries. The encorpora repo references the
  decisions from `PIPELINE_STATE.md` at the root.
