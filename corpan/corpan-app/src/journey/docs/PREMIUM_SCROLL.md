# Journey — The Premium Scroll

> Design direction for turning the Journey feed into an infinite, addictive, *dignified*
> language-learning scroll: TikTok/Reels-grade feel in the hand, but every swipe makes you
> more fluent. Grounded in the code that already ships — this doc invents feel, not APIs.

**Status:** design direction (spec). No feature code here.
**Owner vision:** a premium scroll — go super fast, thousands of exercises a day, so juicy
you can't stop; drop into a game for one phrase (hover-runner, lingo-hero, juice-squeeze),
into a reader interlude (stargate, earthgate), into a 3D world (world-plaza, corpan-city),
then swipe to the next mind-blowing thing. More addictive than TikTok — but built on Pure
Learning, understated and elegant, never loud.

**The one line that governs every decision below:** *Premium is not loud. Premium is
intentional, tactile, and effortless — the feed never asks you to read it, it just feels
right under your thumb.*

---

## 0. What already exists (the seams we build on)

This is not a greenfield. The scroll spine is already load-bearing; read these before
touching anything.

| Capability | Where | Notes |
|---|---|---|
| 3-slot swipe window (prev / current / next, pre-mounted) | `feed/FeedScroller.tsx` | framer-motion drag, wheel + keyboard, double-swipe skip, scroll-back redo. `next` is already mounted so there is **zero dead air** on advance. |
| Card union (the taxonomy today) | `types.ts` `FeedCard` | `exercise · checkpoint · packActivity · capability · blockIntro · welcomeBack · jumpOffer` |
| Engine→feed mapping (1:1) + prepare | `runtime.ts` `mapEngineCard` / `prepareExercise` | Content resolved **pre-mount** (`PreparedExercise`) — no loading gap. Runtime synthesizes only `blockIntro`. |
| **Drop into a pack, return to the feed** | `runtime.ts` `launchPackActivity` / `pendingPack` / `packReturnPending` | The interlude seam ALREADY works: feed hands a pack an `ActivitySpec`, pack returns an `ActivityResult`, feed scrolls on. This is the whole game. |
| Jump / gauntlet passthrough | `runtime.ts` `acceptJumpOffer`, `JumpOfferCard.tsx` | "You seem to know this — skip ahead" already exists as a card. |
| Rare-card rolls | `feed/rare/*` (`MiniGameRoundCard`, `StoryChapterCard`, `EtymologyGemCard`, `TimeCapsuleCard`, `DelightVariantCard`) | The variable-reward surprise layer is already scaffolded and engine-driven (`ec.meta.rareVariant`). |
| Celebration (4 juice tiers) | `celebration/CelebrationLayer.tsx` (`celebrate({tier})`, `skipCelebration()`), `particles.ts` (`burst`), `sounds.ts` (`playChime`/`playFlourish`/`playSoftMiss`) | ONE host-owned layer, imperative emitter, reduced-motion + intensity aware. Every provider gets feedback free. |
| Combo / streak | `runtime.ts` `combo`, `streakV2.ts`, `StreakChipV2.tsx`, `celebration/ComboCounter.tsx` | Combo already tracked; barely surfaced. |
| **Pack↔host result ABI** | `contentPacks/activityContract.ts` `JourneyHostApi` (`isActive`/`getSpec`/`reportItem`/`reportResult`/`abandon`) | The contract every interlude speaks. `reportItem` streams partial verdicts; buffered work is folded into an abandoned result if the learner swipes away. Nothing is ever lost. |
| The packs that become interludes | `packs/*` | hover-runner (3D catch), lingo-hero (rhythm/notes), juice-squeeze (arcade), beatlounge/melopán (DAW), stargate/earthgate readers, world-plaza (3D RPG), corpan-city, teletron, world-radio, quest-ear, tutomaton. |

**Design consequence:** the biggest "whoa" is already 80% wired. The work is the *juice
layer* and *turning existing packs into one-phrase interludes* — not new infrastructure.

---

## 1. The core loop & feel

TikTok is addictive because of three things: **zero friction to the next hit**, a
**variable reward schedule** (you never know if the next swipe is gold), and **no natural
stopping point**. We keep all three and add the one thing TikTok can't: **the reward is
real** — you actually got better, and the app *shows you that you did* without a single
line of read-back copy.

### 1.1 The five-beat card rhythm (arrive → do → resolve → savor → go)

Every card, native or interlude, runs the same micro-loop. This is the heartbeat.

```
ARRIVE     card springs in from below (already mounted → instant, no spinner)
DO         one decision, one gesture — tap / type / speak / play
RESOLVE    answer lands with weight (haptic + chime + micro-particle)
SAVOR      120–400ms of earned stillness; combo ticks; the "up" chevron breathes
GO         swipe up (or auto-advance on a listening run) — next card is ALREADY there
```

The `settle → advance` two-phase already implements ARRIVE/RESOLVE/GO (`settleCard` /
`advance` in `runtime.ts`, the breathing `ChevronsUp` in `FeedScroller.tsx`). We are
tightening the timing and enriching SAVOR — not rebuilding flow.

### 1.2 What makes it more addictive than TikTok, and still dignified

- **Momentum you can feel.** Combo is a physical force, not a number. Each correct card
  in a row makes the *whole frame* infinitesimally more alive: the accent warms, the
  chime rises in pitch (`playChime(depth)` already takes a depth arg — wire `combo` into
  it), the card-to-card spring gets a hair snappier. Break the combo and it exhales back
  to calm. **The learner reads their own streak off the feel of the interface, never off a
  counter.** (Memory: *communicate state through design, not read-back copy.*)
- **Variable reward, engine-owned.** The rare rolls (`rareVariant`) are our "is the next
  swipe gold?" The learner cannot predict when a game interlude, an etymology gem, a
  time-capsule ("you learned this word 40 days ago — still got it?"), or a full 3D
  drop-in appears. This is the slot-machine core — but every payout is *learning*, so it's
  the honest version. Tune frequency in §2.5.
- **"Just one more" is structural, not manipulative.** The feed never ends
  (`feed_exhausted` refills; reviews are infinite). But we never nag, never guilt, never
  interrupt with a "keep your streak!" modal. The pull to continue comes from the *next
  card already peeking* and the fact that stopping mid-combo feels like leaving money on
  the table — a pull the learner controls. Checkpoints offer a graceful, celebrated exit
  ("Done for now" is a first-class, un-punished choice — `checkpointChoice("stop")`).
- **Escalation.** Difficulty and spectacle both ramp inside a session. Early cards are
  fast recognition (tap); as the combo climbs the mixer earns the right to production
  (speak/type) and to spend a game interlude. A jump-offer ("skip ahead") is a *reward*
  for competence, not a shortcut sold.

### 1.3 "Super fast, thousands a day" — how it feels in the thumb

Thousands/day only works if a card costs the learner ~4–10 seconds and **zero setup
cost**. Non-negotiables, most already true:

1. **Instant readiness.** `next` is pre-mounted and content pre-resolved
   (`PreparedExercise`). Never a spinner between cards. *(Extend this to interludes — see
   §4.4 warm-mount.)*
2. **One thumb, one decision per card.** No card requires two-handed input or reading a
   paragraph to act. The gesture set stays tiny: swipe up = go/next, swipe down = review,
   double-swipe = skip. (Already implemented.)
3. **Auto-advance where reading isn't needed.** Listening runs and correct
   tap-answers can auto-advance on a short countdown ring (already built) so a confident
   learner can rip through 40 cards barely lifting their thumb — a "hands-free run."
4. **No jolt.** No transient status text that appears and reflows the layout (memory:
   *no jolting text*). Feedback is overlaid (celebration layer), never inserted into flow.
5. **Cadence target:** median card 6s, p90 12s. A 20-minute session = ~150–250 cards.
   "Thousands a day" = a power user across sessions; the feel must make 250 in a sitting
   feel like 30 seconds of TikTok.

---

## 2. Card taxonomy (the variety engine)

The scroll is a **deck of card *classes*, shuffled by the engine to a rhythm**. Variety is
what defeats fatigue — the same reason a Reels feed alternates format. Every class below is
a `FeedCard.kind` that exists or a thin new variant of one.

### 2.1 Micro-exercise cards — the fast, juicy core (~75% of the feed)

The bread. `kind: "exercise"`, already fully built (`ChoicePick`, `Cloze`, `WordOrder`,
`ListenPick`, `ListenType`, `FlipRecall`, `SpeakEcho`, `IntroEcho`, `MatchPairs`,
`GrammarNote`). These are the fast hits — 4–12s each. The engine already guarantees no two
consecutive cards share an `activityType` (`fillQueue` warns on it). Picture-choice
(imagepan) and words-in-context cloze already add texture within this class.

**Design work here is pure juice, not new types** (§3): make the *tap* land, the *type*
feel like a keyboard that wants to help, the *speak* card show the live waveform and
confidence read as it already can. The core must feel like the best-made buttons the
learner has ever touched.

### 2.2 Game interludes — "drop in for one phrase, then scroll on" (~1 in 12–18 cards)

`kind: "packActivity"` (+ optional `rare: "miniGame"`). The engine schedules an anchor
card for an installed game; the learner taps Play (never auto-launched — a mount is a
commitment, `PackActivityCard.tsx`), plays **one round for one phrase/skill**, the pack
reports an `ActivityResult`, the feed celebrates and scrolls on. **This already works
end-to-end** via `launchPackActivity`.

The rhythm: a game interlude is a *spike*, not a detour. It should feel like the feed
handed you a toy for 20–40 seconds. Which game the engine picks depends on the skill being
exercised (§4.3):

- **hover-runner** — a *catch-the-meaning* spike (input/recognition). 3D, kinetic.
- **lingo-hero** — a *rhythm/production* spike; the phrase falls as timed notes you catch
  in order. Output + listening.
- **juice-squeeze** — a fast *arcade* spike; pure reflex dopamine wrapped around a word.
- **beatlounge / melopán** — a *creative* spike; scratch/loop a real phrase (rare, high
  savor; more a "delight" than a graded round).

### 2.3 Reader interludes — the immersive breath (~1 in 20–30 cards)

`kind: "packActivity"` pointing at `stargate_reader` / `earthgate_reader`, launched with a
**segment ItemRef** (`kind: "segment"`, `activityType: "earthgate_reader:read-segments"`).
A reader interlude is deliberately a *change of tempo* — the feed exhales. 20–40 seconds of
narrated, word-synced immersion (stargate = words streaming through 3D space; earthgate =
calm earth-toned page). It returns a lightweight completion result (segments read) and
scrolls on. Where the game interlude spikes arousal, the reader interlude *lowers* it — the
variety engine needs both. Also the natural surface for `rare: "storyChapter"`.

### 2.4 3D experience drop-ins — the "mind-blowing" tent-pole (~1 in 60–120 cards, gated)

The rarest, biggest beat: the feed drops you into **world-plaza** (HD-2D RPG) or
**corpan-city** for a *single scene* — walk up to one NPC, complete one exchange in the
target language, claim the reward, and get returned to the scroll exactly where you were.
Same `packActivity` seam, a heavier pack. Because these are expensive to mount, they are:
- gated to strong Wi-Fi / already-installed / high-momentum moments,
- always **opt-in** (tap the poster — never yanked into 3D mid-flow),
- warm-mounted behind the poster while the learner reads it (§4.4),
- capped hard (a tent-pole loses its awe if it's frequent).

These are the "whoa" the owner is describing — but they are the *spice*, not the meal. One
per long session, unforgettable.

### 2.5 Milestone / celebration beats (engine-timed, not content)

`kind: "checkpoint"` (already built) plus tier-2 milestone celebrations
(`celebrate({tier:2, milestone})`). These punctuate: unit complete, N words learned, a
streak day, a placement result. A checkpoint is the **dignified rest stop** — it shows real
progress and offers "Done for now / Keep going" with no dark pattern. Spacing is
engine-owned (`checkpointCadence`). This is where the scroll *breathes and rewards*, the
counterweight to the relentless core.

### 2.6 The rhythm table (the variety engine, at a glance)

Target texture over a rolling ~30-card window. The engine's mixer owns the actual schedule;
this is the felt cadence we tune toward.

```
 core micro-exercise ████████████████████████  ~75%   every 1–2 cards
 rare micro-variant  ███                        ~8%    etymology gem / time capsule / delight
 game interlude      ██                          ~6%    ~1 in 12–18
 reader interlude    █                           ~4%    ~1 in 20–30
 checkpoint/milestone █                          ~4%    engine cadence
 jump offer          ▍                          ~2%    only when competence detected
 3D drop-in          ▏                          ~1%    tent-pole, gated + opt-in
```

**Rule of the variety engine:** never two interludes back-to-back; a game spike is always
followed by ≥2 fast core cards before another spike (arousal needs a floor to spike from);
a reader interlude (down-tempo) is preferred after a hot combo (comedown), a game interlude
after a cold stretch (re-ignite). Encode these as mixer preferences, not hard rules.

---

## 3. The juice system (the reusable feel vocabulary)

One tactile language, applied everywhere, squared-off and premium, always reduced-motion
safe. All of it routes through the existing `CelebrationLayer` emitter and the `journey`
motion tokens — **no prop drilling, no per-card reinvention.**

### 3.1 Motion vocabulary

- **Card spring (arrive/leave).** Keep the existing `spring, stiffness 320, damping 32`.
  Make it *combo-reactive*: at high combo, stiffness edges up (snappier), giving physical
  momentum. One shared `cardTransition(combo)` helper.
- **Settle weight.** On a correct answer the card gives a single, small, *heavy* pulse —
  scale 1 → 1.015 → 1, ~140ms. Premium = weight, not bounce. Wrong answer: a low,
  short lateral nudge (not a jitter — one shake), paired with `playSoftMiss()`.
- **The peek.** The breathing up-chevron (`ChevronsUp`, already built) is the single
  "come get the next one" signal. Keep it minimal; it *is* the "just one more" pull made
  visible. Never a filled drawer.
- **Reduced motion** downgrades springs to cross-fades and disables particles (already
  honored in `CelebrationLayer` via `useReducedMotion`). Every new motion must have a
  reduced-motion branch.

### 3.2 Haptics (net-new, small)

A `haptics.ts` shim (Tauri/Capacitor plugin on device, `navigator.vibrate` fallback,
no-op on desktop). One tiny vocabulary, called from the celebration emitter so every
provider gets it free:
- `tap` — light, on any answer commit.
- `land` — medium, on a correct resolve.
- `combo` — a rising double-tick at combo milestones (5/10/25…).
- `miss` — a soft, short buzz on a wrong answer (once, never punishing).
Respect a `hapticsEnabled` store flag (mirror `soundsEnabled`).

### 3.3 Sound

Extend the existing `sounds.ts`. It already has `playChime(depth)` / `playFlourish` /
`playSoftMiss`. Design intent: a **tuned, warm, short** palette — think a single struck
felt mallet, not a game arcade. Chime pitch rises with combo depth (wire `combo` in).
Milestone flourish is a brief resolving chord, never a fanfare. All gated by
`soundsEnabled` and `juiceIntensity !== "minimal"` (already). Silence is the default-safe
state; sound is a bonus, never required to understand feedback.

### 3.4 Particles

`burst()` already exists (canvas, anchored, tier-scaled 28/60 count). Design intent:
particles are **sparse, monochrome-accent, and fast** — a premium confetti is barely
confetti. Reserve dense bursts (tier ≥2) for genuine milestones. Never full-screen
confetti on an ordinary correct answer — that's the loud, cheap look we reject.

### 3.5 Combo made visible (extend `ComboCounter.tsx`)

Today combo is tracked but nearly invisible. Make it a **quiet, persistent ambient signal**
in a corner: a small squared chip that fills/warms as the combo climbs and gently exhales
on a break. No number shouting — the *fill* and *color temperature* carry it. At milestones
(5/10/25) it pulses once and fires the `combo` haptic + rising chime. This is the momentum
gauge; it must never jolt the layout (fixed position, overlay).

### 3.6 The live-speak read (already built, elevate it)

`SpeakEcho` renders a live Whisper waveform + per-word confidence
(`detail.stt.perWord[].probability`). This is a signature premium moment — *you speak, and
the words light up green as you nail them*. Design intent: make this the single most
beautiful surface in the app. Words fill with the accent color in real time as confidence
resolves; a clean final read; the settle weight on a strong score. It already degrades
gracefully (`sttFallback`) when there's no model. Elevate, don't rebuild.

### 3.7 Component list to build / extend

| Component | New/Extend | Purpose |
|---|---|---|
| `celebration/haptics.ts` | **new** | device haptic shim, one vocabulary, called by emitter |
| `celebration/sounds.ts` | extend | combo-reactive pitch, warmer palette |
| `celebration/ComboCounter.tsx` | extend | ambient momentum gauge (fill + temp, milestone pulse) |
| `celebration/particles.ts` | tune | sparser/premium defaults; dense reserved for tier ≥2 |
| `feed/cardTransition.ts` | **new** | shared combo-reactive spring config |
| `feed/SavorRing.tsx` | **new** (optional) | the auto-advance countdown ring, unified for listening + confident-tap runs |
| `feed/InterludePoster.tsx` | **new** | premium poster frame for game/reader/3D interludes (generalizes `PackActivityCard`) |
| `journey` motion tokens | extend | one set of durations/easings all cards read |

Everything above is *additive to* or *a tune of* the existing juice layer. No new
scheduling, no new result path.

---

## 4. The interlude model (the contract)

The interlude is the feature. Precisely how "drop into a game/reader, then return and
continue" works — grounded entirely in `launchPackActivity` and the `JourneyHostApi` ABI.

### 4.1 The flow (already implemented; this is the spec of it)

```
1. ENGINE schedules an anchor    → EngineCard(meta.provider = "lingo_hero", spec = ActivitySpec)
2. runtime.mapEngineCard         → FeedCard { kind: "packActivity", packId, spec, poster, rare? }
3. FEED shows the poster         → PackActivityCard (never auto-launches; tap Play = commit)
4. learner taps Play             → runtime.launchPackActivity(card, launch)
                                    ├─ activitySession.begin(packId, spec, { onResult })   [R8: single owner]
                                    ├─ quota.note()                                         [the pack-anchor debit]
                                    └─ launch(packId, spec)  → host mounts the pack overlay
5. PACK runs one round           → sees hostApi.journey.isActive() === true, getSpec() = the spec
                                    ├─ reportItem(verdict)   per phrase/word as it resolves (buffered)
                                    └─ reportResult(result)  ONCE at natural completion, then corpan:exit
6. onResult(result)              → runtime.submitResult(card.cardId, result)  → engine grades it
7. FEED celebrates + advances    → celebrate({tier: score>=0.8 ? 1 : 0}) then doAdvance()   [FeedScroller §6.2]
   (abandon path: swipe away → host synthesizes { abandoned:true } from buffered items → advance)
```

Nothing is lost on a swipe-away: `reportItem` verdicts are buffered and folded into the
abandoned result (contract, `JourneyHostApi.reportItem` docstring). The learner is **never
trapped in an interlude** — a swipe/back-out always returns them to the scroll.

### 4.2 The "game interlude contract" (what a pack must honor to be a good interlude)

A pack is a *scroll-grade interlude* — distinct from a standalone game — when it:

1. **Respects `isActive()`.** When journey-launched, it turns OFF its own menus, level
   select, pack-local scheduling, and "play again" — it does ONE round for the given spec
   and exits. (Contract already says providers switch pack-local gating off under
   `isActive()`.)
2. **Consumes the spec's `itemRefs`** as its content — the exact phrase/word the feed is
   teaching — instead of pulling its own random corpus. This is what makes the interlude
   *count* toward the learner's actual course.
3. **Reports incrementally** (`reportItem`) so partial work survives a swipe-away, then
   **exactly one** `reportResult` at the natural end.
4. **Mounts fast and is swipe-outable at any time** (no unskippable intro).
5. **Fits the budget** — `spec.timeboxSec` is advisory; a good interlude self-limits to
   ~20–45s. The host never force-kills, so the pack must be a good citizen.
6. **Returns a real score** (0..1) mapped to its round so the engine can grade the item
   and the feed can pick the celebration tier.

This contract is *already expressible* in the ABI — no changes needed. The work is auditing
each pack (lingo-hero, hover-runner, juice-squeeze) to honor it, and documenting it as the
"interlude conformance checklist" in each pack's README.

### 4.3 How the engine picks *which* interlude

The engine already tags activities with strands (`mfi/mfo/lfl/fd`) and knows the skill
being exercised. Interlude selection maps skill+strand → best game:

| Skill moment | Best interlude | Why |
|---|---|---|
| First-exposure / recognition | hover-runner (catch meaning) | kinetic recognition, low stakes |
| Production / speaking | lingo-hero (rhythm) or speak-echo game | output + timing |
| Reflex / overlearned review | juice-squeeze | fast dopamine on known items |
| Reading / comprehension | earthgate / stargate reader | immersion, comedown |
| Milestone / delight | beatlounge scratch, 3D drop-in | high savor, rare |

The mixer already has strand accounting; this is a lookup table it consults when it decides
to spend an interlude slot.

### 4.4 Readers as short interludes (and warm-mount)

A reader interlude is a `packActivity` with a `segment` ItemRef and a short segment count
(1–3 segments, not a whole chapter). The reader honors the contract: mounts to the passage,
plays word-synced narration, reports read-completion, exits. The *3D* drop-ins
(stargate/world-plaza) use **warm-mount**: begin loading the pack behind the poster the
instant the poster becomes `current` (it's pre-mounted in the `next` slot), so tapping Play
is instant. This preserves the "zero dead air" promise even for a heavy 3D scene.

---

## 5. Net-new games & readers (invented for the scroll)

The existing packs are excellent but were built as *destinations*. The scroll wants
purpose-built *interludes* — a tight 20–60s loop, one skill, maximum juice, built to the
§4.2 contract from day one. Below: 4 games + 2 readers. All buildable on the ABI; each
reads `spec.itemRefs`, reports a score, exits.

### Game 1 — **Echo Chamber** (speaking, ~25s)
The phrase you're learning is spoken by the corpan voice; it *echoes and fragments* across
a dark, resonant space. You speak it back and your voice **re-assembles the shattered
phrase** — each word you nail snaps a shard back into place (driven by the same live
Whisper per-word confidence `SpeakEcho` already reads). Nail the whole line and the room
resolves into a single clean tone. **Addictive because:** it turns pronunciation — the
scariest skill — into a satisfying physical *repair*, and the feedback is instantaneous and
gorgeous. Trains output/pronunciation. Reuses the STT read we already have.

### Game 2 — **Tone Ladder** (listening discrimination, ~20s)
Two near-identical target-language phrases (a minimal pair — `phoneme` ItemRefs already
exist in the contract) play; you swipe toward the one that matches the meaning shown. The
ladder climbs, pairs get closer, speed rises. Miss and you drop a rung. **Addictive
because:** pure escalating reflex + the ear-training payoff is real (tones, vowel length,
false-friend sounds). Trains input/discrimination. Fast, one-thumb, endless.

### Game 3 — **Wordfall** (vocab under pressure, ~30s)
Words of the target language rain down; you catch the ones that mean the shown native word
and let the distractors fall (distractors from the same sampler the feed already uses —
`buildDistractorRequest`). Combo builds as you catch clean; a wrong catch shatters. A
lightweight, gorgeous cousin of juice-squeeze built to the interlude contract. **Addictive
because:** the catch-vs-avoid tension is the oldest arcade loop there is, and here every
catch is a word learned. Trains recognition/vocab breadth.

### Game 4 — **Sentence Forge** (syntax, ~40s)
Word-tiles of the target language drift in; you drag them into order to forge the sentence
(same tokenized content as `word_order`, but *tactile and timed*). Correct order → the
sentence "ignites" and is spoken back. A combo meter rewards forging without hints.
**Addictive because:** it's a physical puzzle with a satisfying *click* when it locks, and
it turns grammar (usually the dry part) into a craft. Trains production/syntax.

### Reader A — **Drift** (immersive micro-story, ~40s)
A 1–3 segment narrated micro-scene where the *scene reacts to the narration* — as each
phrase is read, a single evocative visual element resolves (a lantern lights, snow starts,
a door opens) in a calm parallax space. Lighter than stargate's full 3D, warmer than
earthgate's page. Word-synced highlighting throughout. **Addictive because:** it's the
*comedown* the variety engine craves — a 40-second cinematic breath that still teaches
reading + listening, and it makes you want to know what happens in the next Drift. Serial:
Drifts chain into a slow story across sessions (a reason to come back tomorrow).

### Reader B — **Overheard** (comprehension via eavesdropping, ~30s)
You "overhear" a short two-voice exchange in the target language (Gemini dialog packs make
this trivial — AITW already ships multi-voice). One tap answers a single comprehension
beat ("who's leaving?"). Word-synced, native gloss on demand. **Addictive because:**
eavesdropping is innately compelling, the dialogs are tiny and human, and it trains
real-world *listening comprehension* — the skill flashcards can't touch. Chains into a cast
of recurring characters (soap-opera pull, dignified).

> Build order for net-new: **Wordfall** and **Tone Ladder** first — cheapest, purest
> arcade dopamine, no new model needs, straight onto the contract. **Echo Chamber** next
> (reuses the STT read). **Drift**/**Overheard** as the reader-interlude tent-poles.
> **Sentence Forge** last (most UI).

---

## 6. Phased roadmap

Sequenced for **maximum "whoa" per unit of risk.** Phase 1 is almost entirely juice + the
already-wired interlude seam — the highest-drama, lowest-risk slice. 3D drop-ins come last
because they're the heaviest and the seam matures under them first.

### Phase 1 — "The feel" (juice layer only; the whoa slice) ⟵ **build this first**
Make the *existing* feed feel unmistakably premium under the thumb. No new card types, no
new packs. Pure tactile upgrade + surfacing the momentum that's already tracked.
- `celebration/haptics.ts` (new) + wire into the emitter.
- `sounds.ts` combo-reactive pitch + warmer palette.
- `ComboCounter.tsx` → ambient momentum gauge (fill + color temp, milestone pulse).
- `particles.ts` → sparser premium defaults.
- `feed/cardTransition.ts` (new) → combo-reactive spring; adopt in `FeedScroller`.
- Elevate the `SpeakEcho` live-word read to signature quality.
- Tighten SAVOR timing (settle weight pulse; the breathing chevron).
**Touches:** `journey/celebration/*`, `journey/feed/FeedScroller.tsx`,
`journey/exercises/SpeakEcho.tsx`, `store/journey.ts` (add `hapticsEnabled`).
**Whoa:** the same content, but every swipe now *feels* like a premium product. This is the
demo that sells the vision.

### Phase 2 — "Interludes on the existing seam" (game + reader drop-ins)
Turn 2–3 existing packs into contract-honoring one-phrase interludes and let the engine
schedule them.
- Audit + conform **lingo-hero**, **hover-runner**, **juice-squeeze** to §4.2 (honor
  `isActive()`, consume `spec.itemRefs`, `reportItem`+`reportResult`, self-timebox).
- `feed/InterludePoster.tsx` (new) → premium poster generalizing `PackActivityCard`.
- Reader interludes: **earthgate/stargate** with 1–3 segment specs; comedown pacing.
- Mixer: skill→game lookup (§4.3), interlude spacing rules (§2.6).
**Touches:** `packs/lingo-hero`, `packs/hover-runner`, `packs/juice-squeeze`,
`packs/earthgate-reader`, `journey/feed/*`, engine mixer, pack READMEs (conformance
checklist).
**Whoa:** the feed now *drops you into a game for a phrase and scrolls on* — the core of the
owner's vision, on infrastructure that already exists.

### Phase 3 — "Net-new interludes" (purpose-built for the scroll)
Ship the games/readers designed *as* interludes.
- **Wordfall** + **Tone Ladder** (cheapest, no new models).
- **Echo Chamber** (reuses STT read).
- **Drift** + **Overheard** reader tent-poles (serial, come-back pull).
- **Sentence Forge**.
**Touches:** new packs under `packs/*`, each on the SDK + activity contract.
**Whoa:** variety the learner can't predict — the variable-reward engine at full strength.

### Phase 4 — "The tent-poles" (3D drop-ins)
The rarest, biggest beats.
- **world-plaza / corpan-city** single-scene drop-ins on the `packActivity` seam.
- **Warm-mount** (§4.4) so the 3D scene is instant behind the poster.
- Hard frequency cap + opt-in + connectivity/momentum gating (§2.4).
**Touches:** `packs/world-plaza`, `packs/corpan-city`, `journey/feed` warm-mount,
mixer tent-pole gating.
**Whoa:** once a session, the scroll becomes a 3D world for 40 seconds, then hands you back
to the feed. The unforgettable beat.

---

## 7. Guardrails (the dignity floor — non-negotiable)

Pulled straight from the brand voice and design-feedback memory. Premium ≠ loud.

- **No read-back copy.** State is communicated through design (fill, warmth, weight,
  motion), not sentences the learner has to read. No "Great job!" banners.
- **No jolting text.** Nothing appears/disappears in-flow and reflows the layout. All
  feedback overlays via the celebration layer.
- **No dark patterns.** Streak is opt-in and dignified; "Done for now" is a celebrated,
  un-punished exit; no guilt modals, no "you'll lose your streak!" nags.
- **Squared-off, compact-mobile** design standard: 8px corners on controls, compact on
  phone / roomy on iPad, no accumulating rows. Verify at 320/360 with no horizontal
  overflow.
- **Reduced-motion + sound-off are first-class**, not degraded — the feed is fully
  understandable silent and still (feedback never *requires* sound or particles).
- **Never trap the learner.** A swipe always escapes any interlude; buffered work is never
  lost. Skipping is always one gesture away.
- **Minimize strings.** Every UI string ships ~50× translated; the feed's power is that it
  barely needs words. Put design thinking in docs, not in the UI.
- **Localize any new string in all ~54 locales** before a PR goes green (`check:i18n` is a
  hard build gate).

---

## 8. The one thing to remember

The scroll is already a scroll. What's missing is **the feel of a premium object in the
hand** and **the moment-to-moment surprise of not knowing what the next swipe holds** — a
game, a story, a 3D world, or just the most satisfying little exercise you've ever tapped.
Build the juice layer first (Phase 1); it's the whole promise in a single afternoon of
polish, on a spine that already works. Everything after is variety on a seam that's already
proven.
```
