# Device leg — the REAL Phase-0 gate (owner-run)

The desktop bake-off (`../run_bakeoff.py`) ranks **accuracy** (WER/CER), which
is weight-bound and transfers to device. But three numbers ONLY mean anything
on real hardware, and they decide the architecture:

1. **Android CPU latency** — Whisper's autoregressive decode is 15–25 s for a
   short clip on Android CPU (`memory/feedback_android_whisper_gpu`). The
   non-autoregressive engines (Parakeet/SenseVoice) and Qwen3 must be measured
   *here*, not on a desktop with a GPU. This is THE reason NAR matters.
2. **Peak resident RAM** during a transcribe (iOS `os_proc_available_memory`
   headroom; Android `availMem`).
3. **Co-resident RAM with the 4B LLM loaded** — the §3.3 question. Whether
   Qwen3-ASR can run WITHOUT unloading the corpan-llm Qwen3-4B (unlike
   Whisper, which forces the one-large-model-at-a-time broker).

> Coordinate before running: Android + iOS device builds have ONE owner at a
> time (`memory/feedback_no_ios_builds`, `feedback_git_workflow`). The agent
> does NOT run the device leg.

## What's needed from the owner (precise)

### A. Audio
Re-use the desktop corpus: after a desktop run, `../corpus/<lang>/*.wav` holds
the exact 16 kHz mono clips + `refs.jsonl`. Push a per-language subset to the
device (`adb push` / Xcode container) so device WER is comparable to desktop.

### B. Android (CPU-only) — the decisive leg
Two ways, in order of fidelity:

1. **In-app, via the real runtime** (highest fidelity, needs the asr-* plugins
   from Phase-2 — so this is the *post-bake-off* validation, not the gate):
   load each engine through its plugin, transcribe the pushed clips, read
   latency from the session + RAM from `getStatus().availableMemoryMB`.

2. **Standalone CLI on-device** (the GATE — no app changes needed):
   - **Qwen3-ASR**: build `qwen3-asr.cpp` for arm64-android (it's GGML; the
     same toolchain corpan-llm uses). Run
     `qwen3-asr-cli -m qwen3-asr-0.6b-q8_0.gguf -f clip.wav`, time it, and
     sample RSS via `dumpsys meminfo <pid>` / `/proc/<pid>/status VmHWM`.
     Reference desktop bench: ~247 MB RSS + ~294 MB Metal for a 92 s clip on
     M2 Pro → expect a similar-order CPU RSS on Android (no Metal).
   - **Whisper-q5**: `whisper.cpp` `main -m ggml-large-v3-q5_0.bin -f clip.wav
     -l <lang>` — this reproduces the app's real device cost.
   - **Parakeet/SenseVoice**: `sherpa-onnx` has prebuilt Android binaries; run
     the offline-transducer / sense-voice CLI on the clips.

   Capture for each (engine, lang): wall-clock seconds + VmHWM MB. Feed them
   back into a `rows.jsonl`-shaped file (same schema as desktop, see
   `../build_report.py::ResultRow`) tagged `"device":"android-<model>"` so
   `build_report.py` can render a device table alongside desktop.

### C. iOS (Metal) — native + Qwen3 co-residency
- **Native baseline**: there's NO model to benchmark — Apple
  SpeechAnalyzer/SFSpeechRecognizer runs out-of-process (~0 app RAM). What to
  confirm: which of our ~24 native locales actually transcribe on the test
  device, and that they add <50 MB resident (Phase-1 acceptance).
- **Qwen3 co-residency (the §3.3 measurement)**: with the corpan-llm Qwen3-4B
  LOADED (start a Tutomaton/Corpan City session), launch `qwen3-asr.cpp`
  (Metal) on a clip and record the ADDED `os_proc_available_memory()` delta.
  Masterplan estimate: +0.4–0.7 GB (q5–q8). Confirm it fits next to the ~2.5
  GB LLM on the test device and on a mid-tier device (where it may NOT fit →
  arbiter routes to native/swap).

#### Spike findings (#97) — what's already confirmed (cited), what remains

- **Architecture (confirmed):** Qwen3-ASR in llama.cpp is a multimodal
  (`libmtmd`) model: a **main GGUF** = the Qwen3 LLM **decoder**
  (`ggml-org/Qwen3-ASR-0.6B-GGUF`, Q8_0 ≈ 805 MB, arch `qwen3vl`) PLUS an
  **audio `mmproj` GGUF** = the AuT **encoder** (~180M), loaded via `--mmproj`
  (`-hf` auto-fetches both; default GPU-offloads the mmproj, `--no-mmproj-offload`
  keeps it on CPU = the Android path). This is EXACTLY the §3.3 split: decoder
  = runtime-shareable with the resident 4B (same llama.cpp build + Qwen3
  tokenizer + GGUF loader corpan-llm already vendors); encoder = a separate
  small mmproj asset the registry installs once. **Weight-sharing = NO**
  (0.6B ≠ 4B checkpoints); the win is **one runtime, no second LLM stack**.
- **Memory (desktop proxy):** `predict-woo/qwen3-asr.cpp` (GGML+Metal) benched
  **~247 MB RSS + ~294 MB Metal** for a 92 s clip on M2 Pro → ~0.5 GB added,
  INSIDE the §3.3 0.4–0.7 GB estimate. With the ~2.5 GB 4B loaded → ~3.0 GB.
- **The ONE integration unknown to settle on-device:** does **llama-cpp-2
  0.1.146** (the Rust binding corpan-llm uses) expose the `libmtmd` AUDIO path?
  If yes → `tauri-plugin-asr-qwen3` reuses the plugin's runtime directly. If
  no → it vendors a thin mtmd-audio shim but still shares the GGML build.
  Verify this when wiring the device leg.
- **Honest risk:** llama.cpp flags audio as "highly experimental" and there's
  an open report (ggml-org issue #21847) of empty output on LONGER audio. Our
  use is SHORT clips (phrase dictation + known-target challenges), matching the
  model's dynamic 1–8 s window — but Worker A's bake-off MUST validate accuracy
  on our real clips before `asr-qwen3` is built. Build nothing for a loser.

## What to report back

A small table per device, same columns as desktop
(`engine | lang | metric | error | latency_s | peak_rss_mb`) PLUS:
- Android: the Whisper-vs-NAR latency gap (the headline).
- iOS: the Qwen3 co-resident-with-4B delta MB (the §3.3 number) + native
  locale coverage on the device.

That fills the two columns desktop can't honestly produce (real CPU latency,
co-resident RAM) and closes the Phase-0 gate.
