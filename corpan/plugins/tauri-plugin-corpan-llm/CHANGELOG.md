# Changelog

All notable changes to `tauri-plugin-corpan-llm` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
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
