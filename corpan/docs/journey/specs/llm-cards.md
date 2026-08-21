# Journey — on-device LLM cards (tutor moment)

Status: design + feasibility, 2026-07-06 (DEPTH wave). Binding context:
`ARCHITECTURE.md` D8 (model-residency batching), `CTO-RESOLUTIONS.md`, the
tutomaton RAM-tiered on-device Qwen3 work, and `capability-modules.md`.

This spec covers the **tutor moment**: an end-of-lesson card where on-device
Qwen3 writes ONE short, warm recap in the target language that naturally reuses
2–3 words the learner just struggled with. **No grading.** It is a human beat,
not an assessment.

## Verdict: designed, foundation landed, live card DEFERRED

A tested, framework-free prompt builder ships now
(`journey/cards/tutorMoment.ts` + `tutorMoment.test.ts`) so the model input is
reviewable and pinned. The **live streaming card is deferred** — not because the
idea is unclear, but because a correct implementation crosses three seams that
are out of the DEPTH wave's scope and cannot be verified headlessly:

1. **No LLM seam in the Journey runtime today.** `runtimeWiring.ts` builds
   `ResolverDeps` + the capability host from `createHostApi()`, but never
   threads `hostApi.llm` (the `LlmApi`: `status/isInstalled/load/chat`) into the
   runtime. Wiring it is straightforward but is a runtime/host-contract change.
2. **Card emission is the engine's job.** The engine already models
   `modelNeeds: ("stt" | "llm")[]` on cards and the runtime already synthesizes
   a `blockIntro` at `llm` model boundaries (`types.ts`, `runtime.ts`) — the
   architecture RESERVES this exact card. But actually *scheduling* a tutor
   moment (once per lesson, gated on a real struggle + model residency, batched
   per D8) is engine-owned (`engine/**`), which this wave must not touch.
3. **Residency + device-only verification.** D8: a 3.3 GB LLM and a 1.5 GB
   whisper model cannot co-reside on ≤8 GB phones, so model-needing cards batch
   into blocks and the LLM loads only when it fits. Streaming generation, the
   non-thinking prefill, and graceful absence can only be *proven* on a device —
   there is no headless harness for it. Shipping it unverified would repeat the
   "friendly-mock proves nothing about the device path" mistake.

None of these is a blocker to the concept; together they make a *clean minimal*
card infeasible within this wave's file ownership and verification bar. The
prompt builder de-risks the largest correctness question (what exactly we ask
the model) so the future card is a thin, well-scoped shell.

## Card behavior

- **Trigger.** At a lesson/checkpoint boundary, at most once per lesson, only
  when the learner had ≥1 genuinely struggled item (a fail or a
  multi-miss/partial) in that lesson. No struggle ⇒ no card (never filler).
- **Capability gate (hard).** Emit ONLY when all hold, else emit nothing:
  - `hostApi.llm` exists (plugin registered), and
  - `llm.status().loaded === true` (a model is ALREADY resident — never trigger
    a multi-second cold load mid-feed), **or** the device is "wifi-class" and
    high-RAM by `status().totalMemoryMb` and policy allows a background load.
    Conservative first ship: **resident-only**.
  - whisper is not needed in the same block (respect D8 co-residency).
- **Content.** `buildTutorMomentMessages({ targetLang, nativeLang, cefr,
  struggled })` → messages; `TUTOR_MOMENT_OPTIONS` (temp 0.4, minP 0.05,
  repeatPenalty 1.1, `noThink: true`, `maxTokens: 96`). Output is target-language
  only, ≤2 sentences, reuses ≤3 struggled words, no translation/lists/meta.
- **Render.** A calm reward card: the streamed text appears token-by-token (the
  host `chat` callback), a target-language `lang`/`dir` block, one Continue
  button. Unscored — it counts as input exposure, exactly like the etymology
  gem. `cancel()` on unmount/advance so a half-stream never leaks.
- **Graceful absence.** Any of: no model, error, empty stream, cancel → the card
  simply never mounts (or self-drops pre-mount). The lesson-end flow is
  identical to today when the tutor moment is absent. It is pure upside.

## Prompt (pinned in code)

Authored so the OUTPUT is in the target language and the recap never switches to
the native language (that would undo immersion). Brevity + no-meta directives
mirror the tutomaton house rules; low temperature keeps it on-model. A future
refinement (per the repo rule that generation directives read best in the
destination language) is to author the system instruction itself in the target
language — the builder centralizes this so it is a one-line change.

`struggled` items carry the target surface + optional native gloss (to
disambiguate sense); the builder quotes up to `TUTOR_MOMENT_MAX_WORDS` (3),
most-struggled first.

## Implementation checklist (when picked up)

1. **Host wiring** (runtime/host contract): thread `hostApi.llm` into
   `runtimeWiring.ts` as an optional runtime dep; add a small
   `tutorCapability()` probe (`llm?.status()` → resident + RAM class).
2. **Struggle capture** (surface/runtime): accumulate the lesson's fail/partial
   items (target text + native gloss) — the data already flows through
   `ActivityResult.perItem`; keep a per-lesson ring buffer in the runtime.
3. **Card kind** (surface): add `{ kind: "tutorMoment" }` to the `FeedCard`
   union; a `TutorMomentCard.tsx` streaming shell over `hostApi.llm.chat` +
   `buildTutorMomentMessages`; unscored settle + Continue (reuse the gem's
   advance contract).
4. **Emission** (engine, separate wave): schedule the boundary card with
   `modelNeeds: ["llm"]` so D8 batching + the existing `blockIntro` handle
   residency; the surface renders it only when the capability gate passes.
5. **Device verification** (owner/QA): real phone, model resident, confirm the
   recap streams in target language, reuses the words, and that with the model
   NOT resident the card is simply absent — no jank, no cold-load stall.

## What landed now

- `journey/cards/tutorMoment.ts` — pure `buildTutorMomentMessages` +
  `TUTOR_MOMENT_OPTIONS` + `TUTOR_MOMENT_MAX_WORDS`.
- `journey/cards/tutorMoment.test.ts` — null-on-no-struggle, word cap,
  target-language + CEFR directive, low-temp/non-thinking/token-capped options.
