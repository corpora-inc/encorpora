# Corpán ASR contract (`@shared/asr`)

The frozen `AsrProvider` spine. Every speech-to-text **runtime** —
OS-native, whisper.cpp, Qwen3-ASR, sherpa/onnx — is a Tauri plugin that
conforms to this one contract, which is what makes the providers
interchangeable and stops them drifting.

**Scope: pure transcription (dictation).** Parlometron's alignment/scoring
(the rich 18-field result with per-token logprobs) is a *separate* contract
that stays with `tauri-plugin-stt` and runs *on top of* a transcription
provider. Do not add scoring fields here.

Authoritative design: [`corpan/docs/STT_MASTERPLAN.md`](../../../docs/STT_MASTERPLAN.md).

## Two halves, kept in lockstep

| Half | File | Role |
|---|---|---|
| **Rust** | `plugins/corpan-asr-contract/src/lib.rs` | Wire-format gatekeeper. serde drops any undeclared field **both directions**. Every plugin depends on this crate by path so the structs exist in exactly one place. |
| **TypeScript** | `packs/shared/asr/{contract,host}.ts` | Host/pack-facing twin. `contract.ts` = the provider/session/capability types; `host.ts` = `host.asr` (selection) + `host.models` (registry) surfaces. |

Change one half → change the other. The Rust tests pin the exact JSON keys
(`cargo test -p corpan-asr-contract`); a failing test there is a breaking
change to every provider.

## What a provider plugin must expose

Commands (full invoke string `plugin:asr-<provider>|<command>`):

| command | args | returns |
|---|---|---|
| `capabilities` | — | `AsrCapability` |
| `is_available` | `IsAvailableArgs` | `IsAvailableResult` |
| `ensure` | `EnsureArgs` | `EnsureResult` |
| `start_session` | `TranscribeArgs` | `TranscribeStartResult` |
| `stop_session` | `SessionRef` | `TranscriptOut` |
| `cancel_session` | `SessionRef` | `()` |

Streaming events on the plugin's event channel, keyed by `sessionId`:
`PartialEvent`, `LevelEvent`, `SessionErrorEvent`.

## Non-negotiables every provider inherits

- **Keyboard is the permanent floor.** `host.asr.pick` returning `null`
  means "type instead"; callers must handle it. Never block a field.
- **Stream downloads to disk** (never buffer a model in RAM) —
  `memory/content-pack-download-streaming.md`.
- **Process-global init lock per in-process runtime** (whisper/qwen/onnx) —
  the `ggml_backend_sched_split_graph` SIGSEGV lesson. Native is
  out-of-process and exempt.
- **Coexist with `tauri-plugin-radio-stream`'s `.longForm` AVAudioSession** —
  do not strip/reset it; a reader/radio stream must survive a dictation
  session.
- **`INTERRUPTED` is a clean cancel, never a crash** (call / Control-Center
  pull).
- **`confidence` is best-effort** — providers that lack a real posterior
  return a calibrated proxy, not a fake `1.0`.

## Capability descriptor cheatsheet

`residentMemoryMB` = peak RAM the runtime ADDS while transcribing (`0` for
native; this is what the Budget Arbiter checks). `autoregressive: false` =
non-autoregressive decode (Parakeet TDT / SenseVoice) — cheap on Android
CPU, weighted up there by the router. `modelSizeMB`/`residentMemoryMB` keep
the **uppercase-MB** key (serde rename) — do not "fix" the casing.
