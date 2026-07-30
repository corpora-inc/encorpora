# ADR-0025 — The native side is reached through the pack capability seam, never directly

**Status:** Accepted
**Date:** 2026-07-29
**Related:** [ADR-0021](ADR-0021-pack-capabilities-are-per-pack.md),
[ADR-0020](ADR-0020-content-packs-are-the-product.md),
[ADR-0022](ADR-0022-host-ships-no-content.md),
[ADR-0011](ADR-0011-native-workspace-and-patch-placement.md),
[ADR-0001](ADR-0001-kids-category-posture.md)

## Context

ADR-0021 lifted the blanket ban on the microphone, an on-device model and 3D, and
said capability is decided per pack at the boundary. It did not say *how* a pack
reaches a device capability, because at the time none of them did.

`corpan/plugins/` holds eleven Tauri plugins — text to speech, three speech
recognisers, an on-device LLM runtime, haptics, audio keep-alive. Dynawalla's
`src-tauri/Cargo.toml` declares two of them. The native surface exists and this
product uses almost none of it.

The founder's direction:

> "we will need more bidirectional communication between the native side and the
> games in the future. We sort of forgot about LLMs and TTS and other possible
> things we may utilize from the native side. In the end, **every game shouldn't
> just be a browser game** … **I think we should make a sort of abstract
> interface to the native side**."

> "**Look at all of the native features packs in corpan can use** … we don't want
> to limit ourselves to webview only for every game forever. **The host should be
> able to provide elegant interfaces that the games can use if they want to.**"

And a concrete request already blocked: ARENA wants real online competition, and
VOLTA wants tilt steering and cannot have it.

## Decision

**A pack reaches the native side only through the existing capability seam. There
is no second channel, and there will not be one.**

Concretely:

1. **A native capability is a row in the same table** as every other
   (`packs/sdk/src/capabilities.ts`), marked `native: true`, with a declared
   `budgetMs`. It is declared in a manifest, granted by `gateRun`, and enforced by
   `bridge.ts`, exactly like `storage` or `haptics`.
2. **A pack is never handed the thing itself.** Not a sensor, not a socket, not a
   token, not an `invoke`. It is handed a value or a stream over its port. The
   host holds the resource and the credential.
3. **Grant and availability are different questions.** A native capability stays
   in `HOST_SUPPORTS` once the build implements it, whatever a particular device
   can do. Absence is `Connect.available` at runtime, and a stream may still end
   `unavailable` after starting.
4. **Absence is loud to the developer and invisible to the child.** The SDK's
   native surfaces never throw and never reject; each absent path writes one
   `console.error` naming the capability and the fix.
5. **Consent is asked for by the host, in the host's document, from a real user
   gesture, at most once per install.** A pack has no user activation to lend and
   no origin to hold a grant.
6. **Nothing native outlives a pack.** Teardown ends every stream and releases
   every source, and a paused pack receives nothing.

The contract, with worked examples for text to speech, an on-device model and a
leaderboard socket, is [`../NATIVE_CAPABILITIES.md`](../NATIVE_CAPABILITIES.md).

### Rejected: widening the pack frame

`allow="gyroscope; accelerometer"` on the pack frame would have delivered tilt
steering in one line. It is rejected: it grants motion sensors to all
twenty-eight installed packs in order to serve one, and `frame.ts` states what
that attribute protects. The same reasoning rejects adding a remote origin to the
pack CSP's `connect-src` to give a game a socket — verified as the single
directive that closes the network today, in `src-tauri/src/packs/mod.rs`.

The general form: **a capability is never delivered by relaxing the sandbox.** If
the boundary has to move to serve one pack, the answer is a host-owned capability
instead.

## Consequences

- Every native capability costs a host PR. That is the intended price: the list
  of what a pack can reach stays a closed, reviewable table, and ADR-0021's
  "the host grants only what it uses" survives contact with eleven plugins.
- **A capability whose only source is a web API is still a capability.**
  `sensors.orientation` ships with a `DeviceOrientationEvent` source and a port
  shaped for the plugin that replaces it. The seam is what is being fixed; where
  the bytes come from is an implementation detail that may change once.
- The first capability that introduces a real Tauri plugin pays the ACL tax: a
  command grant in `capabilities/default.json`, a row in `permissions.ts`, and a
  serde round-trip test. Registering a plugin without the grant is denied at
  runtime with everything compiling.
- `SDK_VERSION` becomes a thing that moves. A pack built against 1.1 does not run
  on a 1.0 host, by design.
- **A leaderboard is not only an engineering decision.** Real players means
  visible handles, and anything identifying collected from under-13s is a
  compliance question (COPPA; `G-01` is still open). Recorded in the contract as a
  constraint for the founder to choose deliberately rather than discover.
