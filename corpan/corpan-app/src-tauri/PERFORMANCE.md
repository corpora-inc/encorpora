# Native performance & memory notes (corpan-app/src-tauri)

Findings from the 0.17.3 hardening pass. Verified by the native team; kept
here so future work doesn't re-litigate the known-good parts.

## Verified optimal — do NOT change

- **`[profile.release]`** (`Cargo.toml`): `opt-level = "z"`, `lto = true`,
  `codegen-units = 1`, `panic = "abort"`, `debug = 1`, `strip = false`
  (Gradle strips for the APK / symbols go into the AAB). Correct for mobile;
  prioritizes binary size without sacrificing the hot inference paths.
- **`.cargo/config.toml`**: Apple linker pins (`linker = "/usr/bin/cc"` on both
  `*-apple-darwin`) — this is the documented fix for the desktop link bug, do not
  remove. Android 16 KB page-size link args on all 4 ABIs, NDK 28.2 toolchain
  pins, bindgen SDK args. All intentional.
- **llama-cpp-sys-2 vendored fork**: Android CPU arch raised to
  `armv8.2-a+dotprod+fp16` (large speedup on Snapdragon). Keep.

## Fixed in 0.17.3

- **Models freed on pack exit.** `hostApi.dispose()` now calls `llm.unload()`
  (`Cmd::Unload` drops the ~2.5 GB Metal/CPU model buffer), `stt.unload()` (frees
  the resident Whisper model — the native unload paths already existed on
  iOS/Android, the host just never called them), `stt.releaseAudio()`, and
  idempotent `radio-stream`/`audio-keepalive` stops. Root cause of the
  re-entering-an-LLM-pack memory growth and iOS jetsam kills.
- **Release logging gated.** Per-prefill/decode PERF traces (`state.rs`) and pack
  fetch/install traces (`content_packs.rs`) were unconditional `eprintln!` in
  release — gated behind `#[cfg(debug_assertions)]`. Error/failure logs remain
  visible in release (noisy errors, not silent).

## Resource teardown — audited, complete

- `radio-stream`, `audio-keepalive`, `tts` all have idempotent native stop paths.
  Packs invoke radio/keepalive directly (via `@shared/audio`), so the host can't
  own their lifecycle — but `dispose()` now fires idempotent stops as a
  belt-and-braces for a pack that exits mid-playback.
- No stray threads/channels/listeners found in the plugins beyond the (intended)
  single long-lived corpan-llm actor thread.

## Deferred (post-0.17.3, measure before doing)

- **Whisper model caching across prepare cycles** — avoid reload cost on repeated
  transcribe within a session. ROI unmeasured.
- **LLM KV-cache / model persistence across pack switches** — would trade memory
  for re-entry latency; only if telemetry shows frequent rapid re-entry AND
  jetsam is rare. Currently we favor freeing on exit (correctness over latency).
- **Cache `perf_core_count()`** — recomputed per session; <1% win, cleanup only.
- Pre-existing clippy lint debt in `content_packs.rs`/`state.rs` (map_err→
  inspect_err, map_or simplifications) — cosmetic.
