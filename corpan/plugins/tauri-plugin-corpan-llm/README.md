# tauri-plugin-corpan-llm

On-device LLM runtime for Corpán. Vendored llama.cpp with Metal (iOS) / Vulkan (Android) / CPU fallback. Streaming inference. Designed for cross-pack consumption — the Spanish tutor is the first consumer; future language tutors and other LLM-using packs all tap in.

## What's complete (this scaffold)

- **Rust plugin structure** mirroring `tauri-plugin-stt`:
  - `Cargo.toml` (declares the crate, links target)
  - `build.rs` (registers Android/iOS paths + commands)
  - `src/lib.rs` (plugin init, command handler registration)
  - `src/commands.rs` (IPC command signatures: status/load/chat/stop/unload/query_pack_db)
  - `src/models.rs` (serde request/response types — the public IPC surface)
  - `src/state.rs` (plugin state + session tracking + desktop stub via llama-cpp-2)
  - `src/error.rs` (typed errors with serializable codes)
  - `permissions/schemas/schema.json` (Tauri permission identifiers)
- **iOS scaffold** at `ios/`:
  - `Sources/CorpanLlmPlugin.swift` — Plugin class with all commands signatured; TODO markers where llama.cpp FFI calls go
  - `Package.swift` — skeleton with `.binaryTarget` commented; polish machine drops `llama.xcframework` and uncomments
- **Android scaffold** at `android/`:
  - `build.gradle.kts` — CMake config with `-DGGML_VULKAN=ON`
  - `src/main/cpp/CMakeLists.txt` — bridge build; vendored llama.cpp `add_subdirectory` commented
  - `src/main/cpp/bridge.cpp` — JNI bridge stub
  - `src/main/java/com/corpan/llm/LlmPlugin.kt` — Kotlin Plugin class with all commands wired (stub generation for now)
  - `src/main/AndroidManifest.xml` — empty (no permissions required for inference itself)

## What's needed to ship (polish machine work)

### iOS

1. Vendor llama.cpp under `vendor/llama.cpp/` (pin a commit). Build the XCFramework with Metal enabled:
   ```bash
   cd vendor/llama.cpp
   GGML_METAL=ON ./build-xcframework.sh  # or whatever the current invocation is
   ```
2. Drop the resulting `llama.xcframework` into `ios/llama.xcframework/`.
3. Uncomment the `.binaryTarget` in `ios/Package.swift` and add `"llama"` to the target dependencies.
4. In `ios/Sources/CorpanLlmPlugin.swift`, replace the TODO blocks with real `llama_model_default_params` / `llama_load_model_from_file` / sampling loop calls. The structure (where to emit events, where cancellation checks go) is already in place.
5. Real device test: iPad Pro M2 should hit 25–40 t/s with Metal; iPhone 15 Pro similar.

### Android

1. Vendor llama.cpp under `android/src/main/cpp/llama.cpp/` (pin a commit).
2. Uncomment the `add_subdirectory(llama.cpp)` in `android/src/main/cpp/CMakeLists.txt` and add `llama vulkan` to the linker.
3. In `bridge.cpp`, replace the stubs with real `llama_*` calls.
4. In `LlmPlugin.kt`, replace the `LlmNative.chatStub` echo with the real JNI-driven token streaming.
5. Real device test: Pixel 8 Pro should hit 10+ t/s with Vulkan; Pixel 6a (CPU fallback) ~3–5 t/s.

### Tauri host app integration

In `corpan-app/src-tauri/Cargo.toml`:

```toml
tauri-plugin-corpan-llm = { path = "../../plugins/tauri-plugin-corpan-llm" }
```

In `corpan-app/src-tauri/src/lib.rs`:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_corpan_llm::init())
    // ...
```

## Public IPC surface (what packs can call)

| Command | Args | Returns |
|---|---|---|
| `plugin:corpan-llm\|llm_status` | — | `{ loaded, modelId, backend, availableMemoryMb }` |
| `plugin:corpan-llm\|llm_load` | `{ modelPackId, gpuLayers?, contextSize? }` | `()` |
| `plugin:corpan-llm\|llm_chat` | `{ messages: [{role, content}], options }` | `sessionId: string` (then events) |
| `plugin:corpan-llm\|llm_stop` | `{ sessionId }` | `()` |
| `plugin:corpan-llm\|llm_unload` | — | `()` |
| `plugin:corpan-llm\|llm_query_pack_db` | `{ packId, dbName, sql, params }` | `{ columns, rows }` (TODO) |

## Events during streaming

| Event | Payload |
|---|---|
| `llm-token:{sessionId}` | `{ sessionId, token }` |
| `llm-done:{sessionId}` | `{ sessionId, totalTokens, elapsedMs }` |
| `llm-error:{sessionId}` | `{ sessionId, code, error }` — codes: `MODEL_NOT_LOADED`, `INSUFFICIENT_MEMORY`, `LLAMA_CPP_ERROR`, `INTERNAL_ERROR` |

## How a pack consumes this

See `corpan/packs/llm-tutor-es/src/chat.ts` for the canonical consumer pattern.

## Open questions for the polish pass

1. **Should `llm_query_pack_db` actually replace `HostApi.queryPackDb`?** I left it as a no-op stub because the existing host API already covers it. If we keep both, packs choose; if we deprecate `queryPackDb`, this becomes the single path. Probably fine to keep both for now.
2. **Vulkan device probing** — on Android, some devices report Vulkan support but the actual runtime kernels are slow. Worth a per-device benchmark on first load with auto-fallback to CPU if results are bad.
3. **Cold-start time** — first `llm_load` on a flagship device is ~3–5 sec for a 2.5 GB GGUF (mmap + Metal pipeline state cache). UI needs a loading state.
4. **Multi-LoRA loading** — not in v1 since we have no persona layer. When personas arrive, `llama_lora_adapter_init` + `llama_lora_adapter_set` is the API (llama-cpp-2 has bindings for these per docs.rs).
