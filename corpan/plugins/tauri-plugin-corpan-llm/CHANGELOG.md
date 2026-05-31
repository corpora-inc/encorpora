# Changelog

All notable changes to `tauri-plugin-corpan-llm` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Live system-prompt override** for on-device A/B with no rebuild: env
  `CORPAN_LLM_SYSPROMPT` or `adb shell setprop debug.corpan.sysprompt "..."`.
  `"none"` drops all system messages (bare model); a non-empty string replaces
  every system message's content; empty/unset = unchanged. Measures how much the
  ~850-token grounded prompt costs in prefill (the whole ~43s on Android) and how
  the tutor behaves with little/no priming. NOTE: this only lifts the per-turn
  prefill *floor* — the real Android cost is that `run_chat` re-prefills system +
  full history every turn (no KV-cache reuse), so latency grows each round and
  hard-errors at `n_ctx` 4096; iOS Metal just hides it. See `ANDROID_PERF.md`.

### Fixed
- **Android inference speed** (Tutomaton was ~5 min to first token): pin
  llama.cpp to the device's big-core count instead of its hardcoded default of 4
  unpinned threads (which the scheduler parked on efficiency cores → minutes to
  first token). `run_chat` sets `with_n_threads`/`with_n_threads_batch` from
  `perf_core_count()`, which classifies cores by `cpu_capacity` (kernel big/LITTLE
  signal; falls back to `cpuinfo_max_freq`): uses (total − efficiency) big cores,
  excluding only true LITTLE cores (<50% of max capacity), and reserves ONE core
  for the UI thread on all-big chips. On the test device (Galaxy S24 Ultra,
  Snapdragon 8 Elite / SM8750 — 2×4.47GHz prime + 6×3.53GHz, capacity 1024×2 /
  765×6, no efficiency tier) → **7** threads (an earlier freq-tier heuristic gave
  a wrong **2**). Off-Android falls back to `max(2, logical/2)`; on Apple lands
  near the P-core count. Native lib was already Release, so threads are the
  dominant lever. See `ANDROID_PERF.md`.
- **Live thread A/B without rebuild**: override via env `CORPAN_LLM_THREADS` or
  Android `adb shell setprop debug.corpan.llm_threads N` (>0 wins; 0/unset →
  auto-detect).

### Added
- PERF instrumentation in `run_chat`: separate prefill vs decode tok/s logs
  (`[corpan-llm] PERF prefill/decode …`) + load ms + chosen `perf_cores`.
- Real on-device LLM inference via `llama-cpp-2` 0.1.146 (vendored llama.cpp),
  replacing the echo stub. Metal GPU on Apple targets (`metal` feature), CPU
  elsewhere. Commands: `llm_status` / `llm_load` / `llm_chat` / `llm_stop` /
  `llm_unload`. Streaming tokens via `llm-token/done/error:{sessionId}` events.
- Dedicated inference actor thread that owns the `LlamaBackend` + `LlamaModel`
  (handles llama.cpp's `!Send` context + process-global init); per-session
  `AtomicBool` cancellation.
- Qwen3 ChatML prompt formatting + configurable sampler (temp / top-p / top-k /
  repeat-penalty, greedy when temp≤0); incremental UTF-8 token decoding.

### Changed
- Pure-Rust plugin: dropped the native iOS (Swift) / Android (Kotlin) plugin
  paths from `build.rs` — inference runs in Rust on every platform.

### Fixed
- Prompt decode now chunks the prompt into `n_batch`-sized windows instead of
  one oversized `LlamaBatch` — a grounded system prompt exceeds 512 tokens and
  previously failed with `batch add: insufficient space of 512`. Sampling index
  tracks the last decoded position correctly across chunks + generation steps.
- Model load is resilient: try full GPU offload (Metal) first, fall back to
  CPU+mmap if that fails; integrity preflight (size + GGUF magic) rejects a
  corrupt/incomplete download with a clear `MODEL_CORRUPT` error; iOS
  `device_memory_mb()` reports allocatable headroom via `os_proc_available_memory`.
- Re-load now frees the previously-loaded model BEFORE allocating the new one.
  Without this, exiting and re-entering a tutor pack tried to hold two ~2.5 GB
  models at once; on unified-memory iOS that exceeded the per-app jetsam limit
  and `llama.cpp` returned null from both the GPU and CPU paths
  (`LLAMA_CPP_ERROR: load failed (gpu: null …; cpu: null …)`). Drop-then-load
  makes the second load self-healing regardless of pack lifecycle.

### Verified
- Real on-device inference confirmed on iPad (M-class, Metal): "How do you say
  'good morning'?" → "Buenos días. ¿Y tú cómo estás?", streamed token-by-token,
  fully offline.
