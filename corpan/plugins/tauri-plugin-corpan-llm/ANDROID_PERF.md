# Android LLM performance — Qwen3-4B Q4_K_M

Why Tutomaton was ~5 minutes to first token on Android, and the staged plan to fix it.
iOS/iPad uses the Metal GPU and is fast; Android has no comparable GPU path, so the
Android win is **well-tuned CPU**, not GPU.

## TL;DR diagnosis (verified in code + 2026 ecosystem research)

The 5-minute "hello" is **not** "no GPU" — it's a CPU **thread misconfiguration** chewing
through a large prompt:

1. **Threads defaulted to 4, unpinned (THE bug).** `run_chat` set only `n_ctx` on the
   context; llama.cpp's `LlamaContextParams::default()` leaves `n_threads`/`n_threads_batch`
   at a hardcoded **4** (it does NOT autodetect cores). On an 8-core big.LITTLE Snapdragon,
   those 4 threads get scheduled partly onto **efficiency** cores. → fixed: pin to the
   performance-core count (see `perf_core_count()` in `state.rs`).
2. **Prefill-bound on a big prompt.** Tutomaton's grounded system prompt (persona + warmth
   directive + RAG rows) is ~1000–2500 tokens. Prefill is O(prompt) matmul; at single-digit
   tok/s that alone is 3–7 min before the first token. The user sees "5 min for hello"
   because nothing streams until prefill completes. → instrumented separately now (PERF logs).
3. **Native build is already `Release`** (`llama-cpp-sys-2` build.rs: `LLAMA_LIB_PROFILE`
   defaults to `Release`, applied via `.profile()`). So a debug build is **ruled out** as a
   cause. Good — one less variable.

Target after the thread fix: **~10–20 tok/s decode + seconds-to-first-token** for a 4B
Q4_K_M on a modern Snapdragon (one public report: Qwen3-4B-Instruct Q4_K_M @ 13.5 tok/s).

## GPU on Android: a confirmed dead end (don't chase it)

- **Vulkan via `llama-cpp-2`**: the crate's `vulkan` feature has **no Android branch** in
  `llama-cpp-sys-2`'s build.rs (Windows/Linux only; needs `VULKAN_SDK`, no shader-gen
  cross-compile help). And upstream Vulkan-on-Adreno **crashes on the native driver** or runs
  ~15× **slower** than CPU; ~7 tok/s only via the third-party Turnip/mesa driver.
- **Adreno OpenCL** (Qualcomm's backend): **not exposed by `llama-cpp-2`** (would require
  forking `build.rs`); speeds **prefill not decode** (decode can be *slower* than a good CPU);
  tuned for `Q4_0`, **not our `Q4_K_M`** (docs recommend re-quantizing `--pure` Q4_0). Only
  Adreno 750/830/X85.
- **Mali**: slower than CPU.
- iOS Metal has **no clean Android analogue**. NPU (QNN/Hexagon) is the real future win but
  is outside llama.cpp / `llama-cpp-2` scope today.

Conclusion: invest in CPU tuning; treat GPU as a research spike only (Phase 4), gated on
real measured need and the newest silicon.

## Staged plan (measure → fix highest-leverage first; all on-device, iterative)

### ✅ Phase 0 — Instrument (DONE)
Added PERF logs to `state.rs::run_chat`:
- load ms + `perf_cores=` at load START,
- **prefill: N tok in Xms = Y tok/s | threads=…**,
- **decode: N tok in Xms = Y tok/s**.
Read on device: `idevicesyslog`-equivalent → Android `logcat | grep corpan-llm`, or the
device-log tail. This makes prefill-vs-decode and the chosen thread count visible.

### ✅ Phase 1 — Thread count fix (DONE, cargo-check clean)
`run_chat` now sets `.with_n_threads(perf_core_count())` + `.with_n_threads_batch(...)`.
`perf_core_count()` reads `/sys/devices/system/cpu/cpuN/cpufreq/cpuinfo_max_freq` and counts
cores above the slowest frequency tier (the perf + prime cores); falls back to
`max(2, logical/2)` off-Android. **Expected: the single biggest win** — turns "5 min" into
seconds-to-first-token + usable decode.

### Phase 1.5 — Verify on device (NEXT, needs the Android dev loop)
Build + run on the phone, send one Tutomaton turn, read the PERF logs. Capture:
`perf_cores`, prefill tok/s, decode tok/s, total to first token. Record numbers here.
Decision gate: if first-token < ~10s and decode ≥ ~8 tok/s → ship it. Else → Phase 2/3.

### Phase 2 — Tune batch + KV cache (if prefill still slow)
- `with_n_batch` / `with_n_ubatch` are llama defaults (512); raising `n_ubatch` can speed
  prefill on CPU at some memory cost — measure.
- KV-cache quantization (e.g. q8_0/q4_0 instead of f16) cuts memory + can speed decode;
  llama-cpp-2 exposes `KvCacheType`. Measure on a long conversation.

### Phase 3 — Shrink the prompt (if prefill is still the long pole)
The Android system prompt is large (persona + warmth + grounding). Options: a leaner
Android-specific prompt variant, smaller `contextSize`, or trimming RAG blocks to ≤1 on
Android. Cheapest lever for prefill latency after threads.

### Phase 4 — GPU/quant spike (ONLY if 1–3 insufficient, newest Snapdragon)
Evaluate shipping a `Q4_0 --pure` model variant + forking `llama-cpp-sys-2` to enable the
Adreno OpenCL backend. High effort, prefill-only payoff, 8 Gen 3 / 8 Elite only. Likely
unnecessary; document the spike result here if attempted.

## Notes / gotchas
- `GGML_CPU_ARM_ARCH` is set to `armv8-a` by the crate (conservative). `armv8.2-a+dotprod+i8mm`
  kernels are materially faster for Q4_K matmul; if Phase 1–3 leave decode lacking, a
  crate-level arch bump is worth investigating (may need a `build.rs` env or fork).
- Don't pass `gpuLayers` on Android (no GPU backend linked → no-op; `want_gpu=999` is
  harmless, llama keeps layers on CPU).
- Keep the iOS Metal path untouched — `perf_core_count()` falls back sensibly on Apple
  (≈ P-core count) and the threading set is also correct/beneficial there.

## Source research
Two investigation agents (code ground-truth + 2026 ecosystem). Key refs:
llama.cpp `token_generation_performance_tips.md` (set n_threads = physical/perf cores);
discussions #9464 (Vulkan-Adreno crashes/15× slower), #16606 (Android GPU "wrong for GGUF");
OPENCL.md + PR #10693 (Adreno OpenCL: prefill-only, Q4_0); `llama-cpp-sys-2` build.rs
(no Android Vulkan branch; Release default profile).
