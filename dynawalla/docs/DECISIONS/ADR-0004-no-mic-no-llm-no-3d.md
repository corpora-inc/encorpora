# ADR-0004 — No microphone, no on-device LLM, no 3D in V1

**Status:** **Superseded by [ADR-0021](ADR-0021-pack-capabilities-are-per-pack.md)** (2026-07-26)

> Reversed by the founder, except for the microphone, which stays closed pending
> a compliance decision. Capability is decided per pack at the boundary. The
> hazards named below are real and are carried forward as engineering
> constraints by ADR-0021; the blanket ban is not.

## Context

Corpán ships speech-to-text with pronunciation scoring (~2,900 Swift lines), an
on-device LLM plugin with RAM-tiered model management, a radio-stream plugin, and other
native surfaces. All of it is available to Dynawalla under locked decision #4 (share the
native layer). Availability is not a reason to use it.

## Decision

V1 uses **no microphone, no on-device LLM, no 3D renderer, and no executable content
packs**. The V1 native plugin set is **haptics and tts**, plus iap/subscriptions only if
[ADR-0013](ADR-0013-monetization-model.md) requires them.

Explicitly out of scope: `tauri-plugin-stt`, `tauri-plugin-asr-native`,
`tauri-plugin-corpan-llm`, `tauri-plugin-audio-keepalive`, `tauri-plugin-radio-stream`,
`tauri-plugin-game-packs`.

## Consequences

- **Microphone.** A child-directed product asking for microphone permission is a
  compliance conversation, a store-review conversation and a parent-trust conversation,
  for a capability arithmetic practice does not need. Read-aloud is output, not input.
- **On-device LLM.** A model artifact would dwarf the app, needs RAM tiering to avoid
  OOM-crashing low-RAM devices (a real Corpán incident), and cannot be relied on for
  correctness in a product whose entire claim is that it knows *which step* broke. The
  character is a combinatorial grammar precisely so that every utterance is true by
  construction — see [ADR-0009](ADR-0009-stakes-without-loss.md).
- **3D.** The art direction is 2D throughout. A 3D renderer on a 4 GB reference tablet
  is a performance risk with no product benefit here.
- **`radio-stream` specifically** injects a cleartext-HTTP network security config.
  That is unacceptable in a children's product regardless of category posture.
- The narrow plugin set is what makes a **non-null CSP and per-command capability
  grants** achievable from day one (`X-07`). A live app cannot narrow its permissions
  later, so this is a creation-time decision.

## Revisit conditions

Each is a separate ADR, not a "while we're in there":
microphone requires a compliance decision first; an on-device LLM requires a use case
where a wrong sentence is harmless; 3D requires a measured frame budget on the Galaxy
Tab A9.
