# Changelog

All notable changes to `tauri-plugin-corpan-llm` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed
- **Low-RAM OOM crash hardening (native `ggml_graph_compute_thread` SIGSEGV).**
  Allocating the ~2.5 GB model plus a 4096-token KV/compute buffer could OOM
  *inside* ggml's CPU matmul on memory-constrained devices — an uncatchable
  native segfault that kills the app. Three guards now prevent it: (1) `load`
  refuses any model whose estimated footprint (GGUF size + ~15% buffers +
  ~400 MB KV/runtime) exceeds ~70% of total physical RAM → `InsufficientMemory`
  — this is *per-model*, so a small model still loads on a small device while
  the 4B is refused on a 4 GB phone (supersedes the old blunt 4 GB floor, which
  blocked the very low-RAM devices we now serve with smaller models);
  (2) the context length scales to headroom — `ctx_for_memory()` drops `n_ctx`
  from 4096 to 2048 when under ~2 GB is allocatable at session creation,
  halving the KV/compute footprint; (3) Android `device_memory_mb()` now reports
  real MemAvailable (was `None`), so `status()` and the ctx sizing have a true
  signal. iOS keeps its existing jetsam preflight; desktop is unchanged.

### Added
- **Total physical RAM on `status()`** (`totalMemoryMb`) so the host can pick a
  model size to fit the device. Measured cross-platform: `/proc/meminfo`
  MemTotal (Android/Linux), `sysctl hw.memsize` (macOS/iOS), `None` on Windows.
- **`noThink` chat option** — seeds the assistant turn with an empty
  `<think></think>` block (the canonical Qwen3 non-thinking prefill) so hybrid
  models (0.6B/1.7B) answer directly instead of reasoning aloud. No effect on
  the non-thinking Instruct 4B.
- **Quantized KV cache (Q8_0) on Apple/Metal** — ~halves KV memory at negligible
  quality cost, backed by flash attention (AUTO, on by default). Android/desktop
  CPU keep F16 (FA may not engage on CPU, and quantized KV depends on it).
  Verified on Metal via llama-server.

### Changed
- **Token streaming is coalesced (Android ANR fix).** The actor emitted one
  `llm-token` IPC event per token; on Android every event marshals to the WebView
  on the UI thread as a JS eval result (a `Handler.post` onto the main looper per
  token), flooding it on fast decode — a confirmed Play-vitals ANR
  (`onEvaluateJavaScriptResult`) and a drag on the WebView's own frame/input
  servicing. Pieces are now flushed at most every ~40 ms (or per 256 bytes),
  capping event rate at ~25/s regardless of decode speed. First token flushes
  immediately (time-to-first-token preserved); the tail flushes before
  `llm-done`. Byte-identical to the frontend, which concatenates `token` strings.

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

### Added
- **KV-cache prefix reuse across turns.** The actor now holds ONE persistent
  `LlamaContext` per conversation (`ChatSession`) instead of building a fresh
  context and re-prefilling system+grounding+history every turn. Each turn
  reuses the longest common prefix already resident in the KV cache and prefills
  only the diverged suffix (`clear_kv_cache_seq` + decode from the divergence
  point). Self-healing: a new system prompt (language switch), a fresh
  conversation, the sliding window dropping turns, or the prior reply
  re-tokenizing differently all simply lower the reuse length — never produce a
  wrong result. The session is dropped (KV invalidated) on model reload/unload
  and poisoned on any mid-turn error. PERF log now reports `prefill: N tok
  (reused M)`. SAFETY note on the persistent context's lifetime in `state.rs`
  (`ChatSession`). No IPC/JS changes — the actor derives reuse from the prompt.
- **Sliding context window (robustness).** The prompt is rebuilt fresh every
  turn (system + grounding + RAG + the WHOLE history), so a long conversation
  used to grow until it hard-errored at `n_ctx=4096` and decode slowed (attention
  spans the full KV). `run_chat` now trims the oldest non-system turns to fit a
  token budget that reserves room for the reply (keeps all leading system
  message(s) + the most recent turns), and a new `CONTEXT_OVERFLOW` error is the
  defensive floor if even a single turn can't fit. Keeps Android bounded + fast
  as a chat grows, and makes headroom to afford a richer grounding/RAG block now
  that dotprod prefill is ~3× faster. See `window_messages()` in `state.rs`.

### Fixed
- **Android `armv7` (32-bit) build no longer panics in the vendored
  `llama-cpp-sys-2` `build.rs`.** Upstream `expect()`s `CARGO_CFG_TARGET_FEATURE`,
  but Cargo does not set it for every target (notably `armv7-linux-androideabi`),
  aborting the build. The vendored fork falls back to an empty feature list
  (`unwrap_or_default()`) instead of panicking; arm64/Apple targets are
  unaffected (they always have the env var).
- **Android prefill ~3.2× faster** (warm ~29 → ~91 tok/s on Snapdragon 8 Elite):
  upstream `llama-cpp-sys-2` hardcodes `-march=armv8-a` for the Android
  `arm64-v8a` ABI, which compiles out the vectorized Q4_K matmul kernels
  (`ggml/src/ggml-cpu/arch/arm/quants.c`, gated on `__ARM_FEATURE_DOTPROD`) and
  runs scalar fallbacks. A vendored fork of `llama-cpp-sys-2`
  (`corpan-app/src-tauri/vendor/llama-cpp-sys-2`, `[patch.crates-io]`) sets
  `GGML_CPU_ARM_ARCH=armv8.2-a+dotprod+fp16` for that one ABI; Apple/Metal and
  other ABIs untouched. dotprod is ARMv8.2 (safe for the minSdk-26 fleet); `+i8mm`
  is intentionally NOT baked into the static baseline (would SIGILL on pre-2021
  devices). Decode is bandwidth-bound and unchanged (~20 tok/s). Verified on a
  Galaxy S25 Ultra; numbers + cold/warm caveat in `ANDROID_PERF.md`.
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
