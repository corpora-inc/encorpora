# beatlounge

A dark, opinionated, AI-driven beat sequencer / DAW that also teaches language —
the sibling-in-reverse of [melopán](../melopan). Build loops on a premium,
tick-accurate sequencer; reshape them with a word ("more hihats") through the
on-device LLM; and sample the 25k-phrase corpus into your music as a live,
pitch-performable instrument.

> Everything melopán has × 100 — organized with elegant-minimal surface and
> unlimited power beneath. Pure Learning, made of rhythm.

## Architecture (the spine)

One JSON document is the source of truth. **Every** mutation — UI gesture, LLM
tool call, phrase placement — is a typed `Command` applied by a pure
`reduce(doc, cmd)` through the `CommandBus`. There is exactly one write path,
which is what makes infinite widgets, the LLM-DSL, undo/redo and live sampling
all tractable without special-casing.

- `src/model/` — the frozen pure spine (no audio, no DOM, fully tested):
  - `timing.ts` — PPQ 960 tick math (128-beat loops, 16th-triplets exact).
  - `document.ts` — `BeatloungeDoc`, tracks, events, instrument configs.
  - `command.ts` / `reduce.ts` / `commandBus.ts` — the one write path.
- `src/contracts/` — frozen engine + UI module interfaces teams build against.
- `src/sdk/` — the Corpán host API (TTS, corpus, LLM, `synthesizeToBuffer`).

## Develop

```bash
npm install
npm run test       # pure-layer unit tests (vitest)
npm run typecheck
npm run dev        # standalone with a mock host
npm run dev:corpan # serve to a corpan-app on a device (port 8993)
```

## Status

Wave 0 (frozen spine) complete. Wave 1 brings the lookahead scheduler, the
audio-graph reconciler, the Stage/Rail/immersive shell, and the first audible
pattern. See the master plan and `CHANGELOG.md`.
