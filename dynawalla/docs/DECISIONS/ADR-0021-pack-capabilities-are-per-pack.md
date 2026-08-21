# ADR-0021 — Microphone, on-device LLM and 3D are pack decisions, not a blanket ban

**Status:** Accepted
**Date:** 2026-07-26
**Supersedes:** [ADR-0004](ADR-0004-no-mic-no-llm-no-3d.md)
**Related:** [ADR-0020](ADR-0020-content-packs-are-the-product.md),
[ADR-0022](ADR-0022-host-ships-no-content.md),
[ADR-0001](ADR-0001-kids-category-posture.md)

## Context

ADR-0004 banned the microphone, any on-device LLM, any 3D renderer and all
executable content packs from V1, and fixed the native plugin set at haptics and
tts. Like ADR-0003 it was written `Proposed`, marked `Accepted` inside the
program, and built against without the founder ever ratifying it.

What it produced is on the record:

> "I WANT FUCKING FUN. 3D COOL SHIT. JUICY SHIT. HAPTICS, ANIMATIONS, DIFFERENT
> KINDS OF EXERCISES. UNIQUE WAYS TO LEARN."

## Decision

**The blanket ban is lifted. Capability is decided per pack, at the boundary,
and the host grants nothing it does not need for itself.**

- **Executable packs are the product** ([ADR-0020](ADR-0020-content-packs-are-the-product.md)).
  The "no executable content packs" clause is gone outright.
- **3D is allowed and expected.** This repository already ships four Babylon.js
  worlds. A pack that wants a renderer brings one and pays for it in its own
  budget.
- **An on-device LLM is allowed to a pack that has a use for it**, under the
  standing rule that a wrong sentence must be harmless where it is used. It is
  never the thing that decides whether a child's answer is right.
- **The microphone stays closed until a compliance decision opens it.** This one
  survives, and not for the reason ADR-0004 gave. A child-directed product
  asking for microphone permission is a store-review and parent-trust
  conversation before it is an engineering one, and it is coupled to the Kids
  Category posture that is still open (`G-01`). It is a *sequencing* decision,
  not a statement that speech has no place here.

## What was right in ADR-0004, and is kept

Its per-capability paragraphs were not wrong about the hazards, and every one is
carried forward as an engineering constraint rather than a prohibition:

- An on-device model dwarfs the app and needs RAM tiering or it OOM-crashes
  low-memory devices. That was a real Corpán incident, and the tiering work
  exists — reuse it, do not rediscover it.
- `radio-stream` injects a cleartext-HTTP network security config. That remains
  unacceptable in a children's product regardless of category posture. Banned on
  its merits, by name.
- Third-party ads, analytics, attribution and crash reporters are forbidden
  unconditionally ([ADR-0001](ADR-0001-kids-category-posture.md)), and a pack
  cannot smuggle one in: what a pack may reach is enumerated in
  `dynawalla-app/src/packs/host.ts` and is a closed list.
- A non-null CSP and per-command capability grants stay. The claim they depended
  on a narrow plugin set was the mistaken part: they depend on the host granting
  only what it uses, which is now *one* command.

## Consequences

- The performance floor moves from "no 3D" to "measured on the reference
  device". A pack that cannot hold frame rate on the Galaxy Tab A9 is a pack
  that ships when it can.
- Every capability a pack needs is a grant somebody has to add and justify. A
  live app cannot narrow its permissions without breaking installed clients, so
  each one is still a creation-time decision — just not a program-wide one.
- The host's own native surface is unchanged by this ADR and is one command:
  `core:app:allow-version`. `capabilities.test.ts` fails the build if that
  drifts from `src-tauri/capabilities/default.json` in either direction.
