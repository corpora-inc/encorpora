# tauri-plugin-corpan-llm

On-device LLM runtime for Corpán. Vendored llama.cpp with Metal (iOS) / Vulkan (Android) / CPU fallback. Streaming inference. Designed for cross-pack consumption — the Spanish tutor is the first consumer; future language tutors and other LLM-using packs all tap in.

## Architecture — pure Rust, on every platform

This is a **pure-Rust plugin**. Every command *and* the llama.cpp inference runtime live
in Rust and run on all platforms including iOS and Android, on a dedicated actor thread
(`src/state.rs`). Inference goes through the `llama-cpp-2` crate over a vendored
llama.cpp, with Metal on iOS, Vulkan/CPU on Android, and CPU/Metal on desktop.

There is **no Swift and no Kotlin in the build**. `build.rs` deliberately calls
`tauri_plugin::Builder::new(COMMANDS).build()` with **no `.ios_path()` and no
`.android_path()`** (see the comment at `build.rs:10-18`), so there is no
`run_mobile_plugin` bridge and nothing to keep in sync across three languages.

> The `ios/` and `android/` directories are **inert reference scaffolding from the
> original design**. They are not compiled and not registered. Do **not** follow the old
> instructions to build an `llama.xcframework`, uncomment a `.binaryTarget`, or fill in
> the JNI bridge in `bridge.cpp` — that work is intentionally dead. If you touch native
> code here, you are on the wrong path; the Rust actor is the implementation.

Layout:

- `Cargo.toml` — crate + link target
- `build.rs` — registers the command list only (no native paths, on purpose)
- `src/lib.rs` — plugin init and command registration
- `src/commands.rs` — IPC command signatures
- `src/models.rs` — serde request/response types (the public IPC surface)
- `src/state.rs` — actor thread, session tracking, llama.cpp inference, KV-cache reuse
- `src/error.rs` — typed errors with serializable codes
- `permissions/schemas/schema.json` — Tauri permission identifiers
- `ios/`, `android/` — reference scaffolding, **not built**

Android performance work (thread selection, prefill cost, KV-cache prefix reuse) is
documented in `ANDROID_PERF.md`.

## Host app integration

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
| `plugin:corpan-llm\|llm_status` | — | `{ loaded, modelId, backend, availableMemoryMb, totalMemoryMb }` |
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

`totalMemoryMb` is the stable device-class signal the host uses to pick a model size;
`availableMemoryMb` fluctuates and is diagnostic only.

## How a pack consumes this

Packs do not invoke the plugin directly — they go through the host wrapper,
`corpan-app/src/contentPacks/hostApi.ts` (`llm.chat` / `llm.unload`). The canonical
consumer is Tutomaton: `corpan/packs/tutomaton/src/chat.ts`, with model/RAM tiering in
`src/modelTiering.ts` and `src/modelManager.ts`.

## Known gaps

- **`llm_query_pack_db` is a no-op stub.** Packs use `hostApi.queryPackDb` instead. Keep
  both or delete this command; it has never been wired.
- **No Vulkan device probing.** Some Android devices report Vulkan support while the
  runtime kernels are slow. A per-device benchmark on first load with auto-fallback to
  CPU would fix it.
- **Cold start.** First `llm_load` on a flagship is ~3–5 s for a 2.5 GB GGUF (mmap +
  Metal pipeline state cache). The UI must show a loading state.
- **No LoRA support.** When personas arrive, `llama_lora_adapter_init` /
  `llama_lora_adapter_set` are the APIs (llama-cpp-2 has bindings).
