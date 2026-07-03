# Journey — North Star

**Status: v1.0 (design phase complete). Owner: CTO/integrator agent. Branch: `journey`.**
Design record: `ARCHITECTURE.md` (D1–D14) + `CTO-RESOLUTIONS.md` (binding panel rulings)
+ eight reconciled specs under `specs/`. Build plan: `BUILD-PLAN.md`.

## The problem we are solving

Corpan today is an embarrassment of riches: lingo-hero, juice-squeeze, phrase-flip,
hover-runner, earthgate/stargate readers, corpan-city, tutomaton, beatlounge,
hanzipan, wordpan, pronunciation-coach… Each is genuinely good, but the user has
to *choose*, and choosing requires the autodidact drive of a polyglot. The result
is "wow, that's amazing — get me out of here." Choice overload kills retention.
Heavy reliance on random selection compounds it: nothing meets the learner where
they are.

## The product

**Journey**: one prescriptive, adaptive sequence per **target language** that takes
a learner from zero to mastery — greetings on step one, the rarest literary
grammar at the summit — consumable from **any** of the ~54 supported native
languages. The learner never chooses what to do next. They scroll.

The core interaction is a **feed**: each activity is a full-screen card — listen,
speak, translate, read, write, pick, tap-to-order, a round of a mini-game, an
etymology gem, a story chapter. Complete it, it celebrates, the next card is
already waiting. Zero decision cost. The feed *is* the course. Doom-scroll
mechanics pointed at mastery instead of outrage.

## Non-negotiable principles

1. **One course per target language** (`journey-en`, `journey-es`, `journey-zh`, …).
   The spine is L1-agnostic; L1-specific scaffolding (instructions, contrastive
   notes, cognate shortcuts, transfer traps) is injected per native language.
   54 courses, not 2,862.
2. **Prescriptive by default, adaptive underneath.** Placement in minutes,
   fast-forward when cruising, gentle rewind when struggling, spaced review woven
   invisibly into the feed. The learner feels a straight path; the engine walks a DAG.
3. **Modular activity contract.** The course spine references abstract *activity
   types* fulfilled by pluggable providers (in-app exercises, experience packs,
   readers, the LLM, STT). Any experience we author later hooks into the course
   retroactively by implementing the contract. No experience is load-bearing.
4. **Pedagogy is the physics.** Four Strands balance (meaning-focused input,
   meaning-focused output, language-focused learning, fluency development),
   comprehensible input, retrieval + FSRS spacing, frequency-ordered vocabulary,
   output with feedback. Fun is the delivery vehicle; the learning science is
   the payload.
5. **100% on-device, offline.** Course packs, adaptive engine, scheduling, STT,
   TTS, LLM — everything local. The Spark builds artifacts; phones run them.
6. **Content is packs.** The course itself ships as a new pack kind (a curriculum
   graph), following the wordpan precedent: generated in `dja`, distributed via
   S3/CloudFront with its own index, versioned, updatable independently of the app.
7. **Every existing asset is fuel.** ~25k phrases, narration/book packs,
   11,757-word × 54-lang etymology corpus, whisper, qwen3, TTS voices, and every
   mini-game become interchangeable ammunition for feed cards.
8. **Images enter the arsenal.** Direct-method picture cards for concrete
   vocabulary, heavy at A1 and tapering — an offline image pack kind (strategy
   under research).
9. **Compulsion without dark patterns.** Streaks, variable-reward rare cards,
   juicy feedback, visible progress — but honest copy (no absolutes), no
   pay-to-un-lose mechanics, and every "one more card" genuinely teaches.

## Program plan

- **Phase 1 — Map + Research** (running): six subsystem maps (`codebase/`),
  five research foundations (`research/`).
- **Phase 2 — Design**: synthesize this document to v1.0; write `ARCHITECTURE.md`
  (course-graph schema, activity contract, adaptive engine spec, feed UX spec,
  course-pack format + dja pipeline); adversarial design review panel.
- **Phase 3 — Build**: parallel implementation teams on this branch — core feed
  surface, engine, contract plumbing in the SDK/host, first course pack
  (`journey-en`), instrumentation of 2–3 existing experiences as providers.
- **Phase 4 — Integrate + prove**: end-to-end walkthrough as an es→en learner
  and an en→zh learner; changelogs; ship gate.
