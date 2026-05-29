# 21. Whisper

## What it is

Whisper is OpenAI's open-source automatic speech recognition model.
It is a transformer-based encoder-decoder trained on hundreds of
thousands of hours of multilingual audio with text transcripts, and
it does two things this project asks of it: **transcribe** speech
to text, and **align** known text to speech with per-word
timestamps. Both modes use the same model weights; they differ in
what is held constant.

In this project Whisper appears in two distinct contexts:

- **Offline forced alignment**. On the Spark, during the
  audiobook pipeline, the `stable-ts` package wraps Whisper
  `medium` to produce per-word start and end times over the
  Chatterbox-rendered audio. The output is the `words` array
  in `audio_manifest_<lang>.json` (section 17). This is the
  Whisper that gives reader packs their word-level highlighting.
- **On-device speech-to-text**. On the user's phone, the
  pronunciation coach pack uses `whisper.cpp` (a C/C++ port of
  Whisper) through the Tauri STT plugin (section 04) to
  transcribe the user's spoken practice attempts. The plugin
  runs Whisper on the device's CPU (or NNAPI on Android), with
  a model the pack installs at runtime. This is the Whisper that
  makes pronunciation drilling possible offline.

Two contexts, one model family, two completely different
deployment shapes.

## How it fits

The offline Whisper closes the loop between Chatterbox (section
20) and the reader (sections 15, 17). Chatterbox produces audio
from `tts.text`; Whisper aligns the audio against `text`; the
reader paints word highlights against the alignment. Without
Whisper, audiobook playback would be uniform-speed-estimate
highlighting; with it, the highlight tracks the actual word
boundaries, including all the model's natural pace variation.

The on-device Whisper closes a different loop: the user speaks
into the microphone, the pronunciation coach transcribes the
attempt, and the pack scores how close the transcript is to the
expected text. The Tauri STT plugin (section 04, walked in detail
in section 05) is the boundary; the whisper.cpp implementation
behind it on iOS and Android is the engine. The desktop side of
the plugin returns "not supported in this build" because no
desktop user is doing pronunciation practice on a laptop today;
when they are, the desktop side will grow real behavior.

## Files and entry points

### Offline pipeline

- `corpan/NARRATION_SYSTEM.md`: section "Whisper Alignment" has
  the canonical configuration (`stable-ts`, Whisper `medium`,
  the display-vs-tts word mapping rule).
- `corpan/packs/shared/core/types.ts`: `WordTimestamp`,
  `ManifestSegment.words` (section 17 walks the format).
- `~/projects/ttsctl/` (outside repo): the pipeline tool that
  runs `stable-ts` per segment.

### On-device

- `corpan/plugins/tauri-plugin-stt/`: the Tauri plugin (section
  05 walks the Rust side). The `prepare`, `start_session`,
  `stop_session`, `cancel_session`, `is_available`, `get_status`
  commands are the API surface; `models.rs` declares
  `WhisperParams` (the per-call overrides) and
  `TranscriptionResult` (the rich return including per-word
  timings, scores, and decoder diagnostics).
- `corpan/plugins/tauri-plugin-stt/.tauri/tauri-api/`: the
  vendored Tauri API directory.
- iOS plugin source (under
  `corpan/plugins/tauri-plugin-stt/ios/`, scoped through
  `register_ios_plugin(init_plugin_stt)`): wraps whisper.cpp's
  iOS XCFramework.
- Android plugin source (under
  `corpan/plugins/tauri-plugin-stt/android/`, scoped through
  `register_android_plugin("com.corpora.stt", "SttPlugin")`):
  wraps whisper.cpp via JNI.
- `corpan/packs/pronunciation-coach/`: the pack that consumes
  the STT API. Has its own `scoringTuning.ts` for the per-call
  `ScoringParams` overlay (section 05).
- `RUNBOOK_QUANTIZE_LARGE_Q8.md` (under `corpan/`): the runbook
  for quantizing Whisper `large` to Q8 for the on-device path.

## How it works

### Forced alignment, in the pipeline

The offline alignment runs after Chatterbox produces a segment's
WAV. The `stable-ts` package wraps Whisper in a "forced alignment"
mode where the known transcript is provided and the model is
constrained to output its own decoding while reporting per-word
timestamps. The pipeline uses Whisper `medium` for this; the
trade is accuracy versus speed. `medium` is fast enough on the
Spark (~314 ms per segment per `NARRATION_SYSTEM.md`) and
accurate enough that the resulting word timestamps land within a
few hundred milliseconds of the true word boundaries.

The alignment is per-segment, not per-book. Each `audio/<lang>/
<segment-id>.m4a` gets its own array of `WordTimestamp` entries
mapped against the segment's tokens. The alignment is recombined
into the audio manifest at publish time.

There is a subtlety the auto-memory and `NARRATION_SYSTEM.md`
both flag:

> Display text mapping: manifest words use the `text` (display)
> field, not `tts.text` (phonetic), so the reader shows correct
> spelling even when TTS uses pronunciation substitutions.

The model decodes the phonetic spelling Chatterbox spoke
(`chahpoolinehs`); the manifest writes the display spelling
(`Chapullines`). The mapping is by position. The pipeline knows
where each phonetic token came from in the original `text` and
writes the original token back into the manifest. The reader
displays correct spellings; the alignment is correct; the
listener hears correct pronunciation.

### Why `medium` and not `large-v3`

`PIPELINE_STATE.md` records the alignment-model history. The
pipeline used Whisper `base` for early shipped narrations; it
moved to `medium` because `base` missed too many first-word
detections in some languages; the pipeline experimented with
`large-v3` for catalog-wide realignment (the
`2026-04-24_whisper-large-v3-alignment.md` decision) when
`medium` was producing 46% zero-duration words on a problem
segment, which is the signature of the model failing to align at
all.

The choice that ships is `medium` for the routine pipeline pass,
with `large-v3` available for full-catalog realignment when
problem segments cluster. The cost trade-off is GPU time per
segment; on the Spark, `large-v3` is several times slower than
`medium`. Section 22 walks the Spark's performance envelope.

### whisper.cpp on the device

The on-device path is a different deployment of Whisper entirely.
`whisper.cpp` is Georgi Gerganov's C/C++ port of the model;
it runs on CPU with intrinsic optimizations (AVX, NEON, BLAS),
on Apple's Metal Performance Shaders on iOS, and on Android's
NNAPI where available. The model weights are quantized to Q8 or
Q5 to fit in mobile memory (`RUNBOOK_QUANTIZE_LARGE_Q8.md` is
the runbook for the Q8 step).

The Tauri STT plugin's mobile module (section 05's
`mobile.rs:30`) is the bridge: each Rust method calls
`self.handle.run_mobile_plugin::<T>("name", args)`, which routes
to the platform-native plugin (`SttPlugin` on Android,
`init_plugin_stt` on iOS), which calls whisper.cpp through the
appropriate FFI.

The pronunciation coach's loop:

```
[User taps "Record" in the pack]
            |
[pack: invoke stt.startSession({sessionId, language, expectedText, whisperParams})]
            |
[host: bridges to native plugin]
            |
[Android: SttPlugin starts AudioRecord, streams to whisper.cpp]
[iOS:     SFSpeechRecognizer fallback or whisper.cpp XCFramework]
            |
[User finishes speaking; pack calls stopSession({sessionId})]
            |
[Native plugin returns TranscriptionResult: text, words[], scores]
            |
[Pack scores the user's attempt against expectedText, displays result]
```

`TranscriptionResult` (in `tauri-plugin-stt/src/models.rs:137`)
carries the full diagnostic set: the transcribed text, the
per-word timings, the overall and component scores, the average
log-probability, `no_speech_prob`, `compression_ratio`,
`temperature`, the min and stdev of per-token logprob, and the
free-decode-vs-constrained-decode similarity. Section 05 covers
how the scoring rolls up from these.

### `WhisperParams`: passing through whisper.cpp's flags

`WhisperParams` in `tauri-plugin-stt/src/models.rs:38` mirrors
the C-side `whisper_full_params` struct field by field. Per-call
overrides from the pack reach all the way through:

```ts
sttApi.startSession({
  sessionId,
  language: "pa-Arab",
  expectedText: "...",
  whisperParams: {
    temperature: 0.0,
    no_speech_thold: 0.5,
    initial_prompt: "ਪੰਜਾਬੀ ਦੀ ਲਿਖਾਈ",  // bias the decoder to Gurmukhi script
  },
})
```

The pack uses `initial_prompt` heavily for low-resource non-Latin-
script languages (Punjabi in two scripts, Hebrew with nikkud,
Yoruba with diacritics) where the model's greedy decode otherwise
collapses to a wrong-script attractor. The docstring on
`WhisperParams.initial_prompt` (section 05 quoted it) is the
contract.

The wire-format gatekeeper rule from section 05 still applies:
any field not declared on the Rust struct is silently dropped at
the boundary. The set of fields on `WhisperParams` is exactly
the set of fields the iOS Swift `WhisperParamsArg` and the
Android Kotlin `WhisperParamsArg` accept; adding a new pass-
through is a four-file edit.

### CPU vs GPU on the device

On Android: the plugin runs whisper.cpp on CPU with NEON
optimizations. NNAPI is available in principle but has not been
the path that ships, because the gain is small on the model
sizes the coach uses and the configuration complexity is
high. Per the v0.12.6 release (`PIPELINE_STATE`), "Pronunciation
coach on Android CPU, whisper.cpp" is the shipped configuration.

On iOS: the plugin runs whisper.cpp's iOS XCFramework, which
can use Apple's GPU through Metal. The choice between CPU and
GPU is made per device per model.

The desktop side (`desktop.rs`) returns "STT not supported on
desktop in this build" because the pronunciation coach has not
shipped on desktop. The infrastructure is in place to add it; no
user has asked for it yet.

### Memory and the `availableMemoryMB` gate

`StatusResult.available_memory_mb` and `physical_memory_mb`
(section 05's serde rename war story) are the memory-headroom
fields the pack reads before switching to a larger whisper
model. On iOS the available reading comes from
`os_proc_available_memory()`; on Android from
`ActivityManager.MemoryInfo.availMem`. The pack uses this gate
to refuse to upgrade to whisper `large` on a device that does not
have the room.

## Common operations

1. **Align a segment offline.** From the pipeline machine (the
   Spark or Skylar's workstation):
   `python -c "from stable_ts import load_model; m =
   load_model('medium'); print(m.transcribe('<audio.wav>',
   prepend_punctuations='', word_timestamps=True))"`. For real
   pipeline use, drive through `ttsctl`.
2. **Test the on-device STT in a pack.** Use the pronunciation
   coach's standalone dev path or install it in the running
   Corpán app. Call `hostApi.stt.startSession(...)`, speak,
   call `stopSession`. Inspect `TranscriptionResult` in the
   pack's UI.
3. **Bias the model toward a non-Latin script.** Set
   `whisperParams.initial_prompt` to a short phrase in the
   target script. Watch
   `TranscriptionResult.free_vs_constrained_similarity` to
   confirm the bias took.
4. **Quantize a Whisper model for the device.** Follow
   `corpan/RUNBOOK_QUANTIZE_LARGE_Q8.md`. The output is a `.bin`
   file the pack ships and the plugin loads through `prepare`.
5. **Inspect alignment quality on a problem segment.** Look at
   the `words` array in the audio manifest. Zero-duration words,
   massive `pause_after_ms` between words, or words whose
   `start_ms > end_ms` are all symptoms of a failed alignment.
   `PIPELINE_STATE.md` enumerates the validator's checks for
   the same.
6. **Reproduce a failed transcription locally.** Capture the
   audio (the plugin exposes the raw WAV in dev builds), feed
   to a local Whisper installation with the same parameters,
   and compare. The on-device model and the desktop model are
   the same architecture; deltas come from quantization and
   device-specific paths.

## Why we built it this way

Two Whisper deployments instead of one is the simplest answer to
two different problems. The offline alignment needs a stationary
high-accuracy run over rendered audio; the on-device STT needs a
streaming low-latency run over microphone audio. Unifying them
would mean either taking the device's CPU constraint into the
pipeline (slowing the renders pointlessly) or pushing the
pipeline's quality bar onto the device (slowing the user's
phone). Two Whispers, two configurations; the model architecture
is the same.

`stable-ts` plus Whisper `medium` is the choice that converged
after several rounds of "which model and which wrapper." The
wrappers tested all produce per-word timestamps from the same
Whisper checkpoints; `stable-ts` is the one whose word boundaries
are most consistent across languages and which exposes the
forced-alignment mode the pipeline needs. `medium` is the largest
model whose runtime fits in the convergence loop's per-segment
budget on the Spark.

The display-text-in-manifest rule, mirrored from the
`tts.text`-versus-`text` discipline in section 20, is what makes
the phonetic-nudge workflow safe end to end. The model speaks
the nudge; the alignment captures the boundaries; the manifest
records the display spelling. The reader never sees the nudge.

whisper.cpp instead of the official PyTorch Whisper on the device
is a forced move: shipping PyTorch on a phone is not practical.
whisper.cpp is the alternative that runs in C with no Python and
that fits in the binary the phone wants. The same choice gets
made every place this codebase puts a Whisper on a phone or in a
Tauri plugin; the only question is whether to ship CPU, GPU, or
both, per platform.

The wire-format gatekeeper for `WhisperParams` (and for
`ScoringParams`) is the small piece of strictness that keeps
the per-call overrides honest across four code surfaces (Rust
plugin, Swift iOS plugin, Kotlin Android plugin, TypeScript
pack). Adding a parameter that the pack thinks should work but
that one of the native sides ignores is exactly the bug class
this gatekeeper prevents.

## To go deeper

- The original Whisper paper, *Robust Speech Recognition via
  Large-Scale Weak Supervision* (Radford et al., 2022). Open-
  access on arXiv.
- `stable-ts` on GitHub (`jianfch/stable-ts`) for the
  forced-alignment wrapper the pipeline uses.
- `whisper.cpp` on GitHub (`ggerganov/whisper.cpp`) for the
  on-device implementation. The README's section on quantization
  is the right entrypoint for the `RUNBOOK_QUANTIZE_LARGE_Q8`
  context.
- Section 04 for the Tauri command surface; section 05 for the
  Rust plugin internals; section 22 for the Spark hardware that
  runs the offline path.
