# Journey Feed UX + Surface Spec

**Status: v1.0 implementable spec. Elaborates ARCHITECTURE.md D7, D8, D9, D11. Owner: feed-UX lead. 2026-07-03.**

Inputs verified against code on branch `journey`:
`corpan-app/src/App.tsx` (overlay state machine, `activeGame`, `corpan:exit`, landing consumption at 679–746),
`components/home/HomeHub.tsx`, `onboarding/graph.ts`, `store/landing.ts:14-19`, `store/progress.ts`,
`store/settings.ts:720-757` (persist conventions), `components/MainExperience.tsx` (gate v2 usage,
framer-motion + reduce-motion pattern), `components/StreakChip.tsx`, `store/drawer.ts`, `i18n.ts`,
`packs/shared/monetization/src/quotas.ts`, `store/paywall.ts:23-45`.
Research inputs: `research/engagement.md` (§2.1–2.9, P0 list), `research/adaptivity.md` (§5 mixer, §4 placement),
`research/pedagogy.md` (§12). Contract facts: `codebase/pack-contract.md` (§2, §3, §5), `codebase/app-shell.md`.

Engine internals (FSRS, mixer, placement math) are the engine spec's job. This document specifies the
**surface**: components, interactions, stores, shell integration, quota UX, i18n, and visual direction.
Where this spec needs the engine, it consumes the interface in §2.3 and nothing deeper.

---

## 1. Component tree — `corpan-app/src/journey/`

```
corpan-app/src/journey/
├── JourneySurface.tsx          # full-screen surface root (overlay sibling of HomeHub, §5)
├── JourneyChrome.tsx           # thin top ribbon: progress, StreakChipV2, overflow menu
├── runtime.ts                  # useJourneyRuntime() — glue between engine, stores, feed (§2.3)
├── quota.ts                    # journey daily gate wiring (gate v2, §7)
├── streakV2.ts                 # streak v2 accounting (rest days, repair) over progress + journey stores
├── StreakChipV2.tsx            # journey-aware streak chip (extends StreakChip semantics, §1.8)
│
├── feed/
│   ├── FeedScroller.tsx        # the scroll container: 3-card mounted window, snap, pre-mount (§3.1)
│   ├── FeedCard.tsx            # card frame: settled state, checkmark stamp, why-this-card long-press
│   ├── ActivityCardHost.tsx    # ActivitySpec → native renderer resolution + result plumbing (§1.4)
│   ├── CheckpointCard.tsx      # designed stopping point (§1.6)
│   ├── RareCard.tsx            # shimmer reveal wrapper + variant dispatch (§1.7)
│   ├── rare/
│   │   ├── DelightVariantCard.tsx    # alt-voice phrase / “did you notice?” micro-pattern
│   │   ├── EtymologyGemCard.tsx      # wordpan-backed typographic gem
│   │   ├── TimeCapsuleCard.tsx       # “3 weeks ago you struggled with this”
│   │   ├── MiniGameRoundCard.tsx     # pack anchor poster → overlay handoff (§6)
│   │   └── StoryChapterCard.tsx      # reader-chapter epic reward poster → overlay handoff (§6)
│   ├── PackActivityCard.tsx    # shared poster/launch/return frame used by MiniGameRound + StoryChapter
│   │                           # and by scheduled (non-rare) anchor cards
│   ├── BlockIntroCard.tsx      # model-heavy block header (speaking block, §6.3)
│   └── WelcomeBackCard.tsx     # re-entry arc opener (7+ days away; engine emits it)
│
├── exercises/                  # the native renderers (§4). One file per activityType.
│   ├── IntroEcho.tsx
│   ├── ChoicePick.tsx
│   ├── ListenPick.tsx
│   ├── ListenType.tsx
│   ├── Cloze.tsx
│   ├── WordOrder.tsx
│   ├── MatchPairs.tsx
│   ├── FlipRecall.tsx
│   ├── SpeakEcho.tsx           # thin host mounting cap-pronounce (specs/capability-modules.md)
│   ├── GrammarNote.tsx
│   └── common/
│       ├── AnswerTiles.tsx     # shared choice/tile grid (RTL-aware, dir per target lang)
│       ├── AudioButton.tsx     # play / replay / slow-replay (0.7×) — wraps speakWithStackPrefs
│       ├── TypeInput.tsx       # dictation/cloze input; diacritic-tolerant compare
│       ├── ScaffoldHint.tsx    # retry scaffold (reveal-one-word / slow audio)
│       └── ResultStamp.tsx     # correct/incorrect stamp morph (feeds CelebrationLayer tier 0)
│
├── celebration/
│   ├── CelebrationLayer.tsx    # ONE host-owned layer, 4 tiers + intensity (§1.5)
│   ├── ComboCounter.tsx
│   ├── particles.ts            # canvas-confetti-style particle burst (no DOM node spam)
│   └── sounds.ts               # pentatonic chime family; never overlaps TTS speech
│
├── placement/
│   ├── PlacementFlow.tsx       # ≤3 framing screens + probe card loop (§1.9)
│   ├── PlacementCard.tsx       # reuses exercises/ renderers in probe mode (no hints, no retry)
│   └── PlacementResult.tsx     # frontier + endowed-progress (“starting with N already known”)
│
├── path/
│   ├── PathViz.tsx             # P0: arc → unit ribbon (§1.10). Constellation is P1, NOT here.
│   └── UnitSummit.tsx          # unit-complete milestone view (tier-2 celebration target)
│
└── engine/                     # pure TS, zero DOM/Tauri imports — separate spec
```

Store file (house convention keeps stores together): `corpan-app/src/store/journey.ts` (§2).
Experience metadata: one new entry in `experiences/registry.ts` local map, id `journey_main` (§5.4).

### 1.1 `JourneySurface`

Props: none (reads stores). Renders, top to bottom in z-order:

```tsx
<div className="fixed inset-0 z-[1050] flex flex-col bg-background" dir={dir()}>
  <JourneyChrome />        {/* absolute top; ~44px; auto-hides while a card is mid-interaction */}
  <FeedScroller />         {/* fills; owns all gesture handling */}
  <CelebrationLayer />     {/* absolute inset-0 pointer-events-none; portal target for tiers */}
</div>
```

z-1050 sits **above HomeHub (z-0..30), below the pack overlay (z-1100)** — a pack anchor card
launched from the feed stacks on top of the still-mounted feed (§6). While open, the surface sets
`document.body[data-experience-active]` exactly like `activeGame` does (`App.tsx:581-593`) so
Home's scroller freezes.

First mount per (stack, course): if `placementDone` is false and the course meta has no
`placementDeclined`, render `<PlacementFlow/>` instead of the feed (§1.9). PlacementFlow completes
or is skipped → feed.

`JourneySurface` wraps its body in `ErrorBoundary` with `onError` → close surface (App-level
fallback mirrors the pack-overlay pattern, `App.tsx:797-804`).

### 1.2 `JourneyChrome`

- **Progress ribbon**: thin bar, fill = cards completed since last checkpoint / cards to next
  checkpoint (goal-gradient: “2 cards to checkpoint” is free motivation). Below it, one line:
  current unit name (`journey.path.unit`).
- **StreakChipV2** trailing edge (leading in RTL is the Home button side — mirror like
  `PhraseFlipChrome`, `App.tsx:105-142`).
- **Home button**: dispatches `corpan:journey-exit` (§5.2). Exit mid-card ⇒ that card resolves
  `abandoned` (§3.5).
- **Overflow menu** (single unobtrusive `⋯`): opens a vaul drawer (extend `store/drawer.ts` with
  `journeySettingsOpen` — the store is explicitly “shaped to grow”). Contents: advance mode,
  celebration intensity, listening mode, open PathViz, streak settings. Power-user levers live
  here and ONLY here — never as feed interruptions (engagement §2.1).

### 1.3 `FeedScroller`

The core. **Not** a generic virtual list; a purpose-built 3-slot window:

- Mounted slots: `prev` (last completed card, read-only), `current`, `next` (pre-mounted,
  pre-fetched, hidden below the fold or peeking ~15% after completion). Content is local, so
  pre-mount is free; the pre-mount is the TikTok “no loading gap” requirement (engagement §1.2.4).
- Snap paging via framer-motion `drag="y"` on the card stack with spring snap-to-slot (do NOT use
  CSS scroll-snap: we need to intercept the gesture for skip semantics, read-only back pages, and
  the settle animation). Wheel + keyboard (↑/↓/Space) handled for desktop.
- **Scroll-back read-only** (§3.4): swiping back (downward gesture) pages through the last
  `N = 20` completed cards from the session history ring. Completed cards render in `review` mode
  — answers shown, inputs disabled, audio replayable, nothing re-scored. A subtle “viewed earlier”
  chip labels them. Swiping forward returns to `current`.
- Exposes imperative `advance()` used by auto-advance and by CheckpointCard’s “Keep going”.

Signature:

```ts
// feed/FeedScroller.tsx
export function FeedScroller(props: {
  runtime: JourneyRuntime          // §2.3
}): JSX.Element
```

### 1.4 `ActivityCardHost`

Resolves a `FeedCard` (§2.4) to a renderer and owns the per-card lifecycle:

```ts
export function ActivityCardHost(props: {
  card: FeedCard
  mode: "live" | "review" | "probe"     // probe = placement (no hints/retry/celebration)
  onResult: (r: ActivityResult) => void  // exactly once per live card
  onRequestAdvance: () => void           // renderer signals “I’m done displaying”
}): JSX.Element
```

Responsibilities: map `spec.activityType` → renderer component; inject shared handlers
(`speak`, quota-free audio replay, hint accounting); enforce the retry state machine (§3.3);
assemble the `ActivityResult` (renderers report raw outcome + latency; host adds `specId`,
`durationMs`, `hintsUsed`); trigger CelebrationLayer with the computed tier; then arm advance.

### 1.5 `CelebrationLayer` — 4 juice tiers + intensity

One host-owned layer; every provider (native renderer, pack round, reader chapter) gets feedback
free. API is imperative via a tiny module-level emitter (no prop drilling):

```ts
// celebration/CelebrationLayer.tsx
export type CelebrationTier = 0 | 1 | 2 | 3
export function celebrate(e: {
  tier: CelebrationTier
  comboCount?: number          // tier 1
  milestone?: MilestoneKind    // tier 2: 'unitComplete'|'wordsLearned'|'streakDay'|'placementDone'
  anchorEl?: HTMLElement       // origin for particle burst (defaults to card center)
}): Promise<void>              // resolves when the moment ends (or is skipped by scroll)
```

| Tier | Trigger | Content | Duration |
|---|---|---|---|
| 0 | any correct answer | chime + checkmark morph + card glow | ~400 ms |
| 1 | perfect (fast, first-try) or combo 5/10/15… | particle burst in course color + haptic tick + ComboCounter grow | ~800 ms |
| 2 | milestone (unit summit, word #100/#500, streak day 7/30/100, placement done) | full-screen moment; PathViz node animates filled; stat line | ~1600 ms, skippable |
| 3 | rare-card reveal | shimmer PRE-animation on the incoming card back, then flip reveal — anticipation is designed (engagement §2.2) | ~1200 ms pre + reveal |

**Intensity setting** `juiceIntensity: 'full' | 'reduced' | 'minimal'` (journey store §2.1):

- `full`: everything above. Default for `ageBand` ≠ adult/senior.
- `reduced`: no particles, no screen-scale pulses; chime + stamps + counters kept. Default for
  `userClass === 'learner' && ageBand === 'adult'` and always when the OS
  `prefers-reduced-motion` is on (the global `MotionConfig` in `main.tsx:85` already respects it;
  CelebrationLayer must additionally gate its canvas particles on `useReducedMotion()` since
  canvas ignores MotionConfig).
- `minimal`: tier 0 stamp only; tiers 1–3 collapse to a one-line text moment. Sounds off.

Sounds: pentatonic ascending family keyed by combo depth; **never played while TTS is speaking**
(check `speechSynthesis.speaking` / plugin state before firing; drop, don’t queue).
Over-juicing measurably hurts (engagement §1.3) — no tier may exceed its budget.

### 1.6 `CheckpointCard`

Emitted by the engine's lesson/checkpoint layer as an `EngineCard` — cadence comes from
`FeedConstraints.checkpointCadence` (derived from `goalIntensity`, §3.7); unit-boss checkpoint
batches additionally carry a `pass_score` that gates position advancement, with failures routed
to REPAIR (engine spec owns all of that — the surface renders what arrives). Never
auto-advances. Contents:

1. Summary line: `journey.checkpoint.summary` — “{{new}} new · {{reviews}} reviews · best combo {{combo}}”.
2. **Daily ring**: cards done today / daily goal (goal from `goalIntensity` mapping §3.7).
   Overfill renders as over-glow, never a second guilt ring.
3. PathViz mini (current unit progress animates +N).
4. Personal-record proximity when applicable (“2 cards from your best Tuesday” — P1; slot reserved).
5. **Two equal-weight buttons** — identical size, variant, and visual weight, order swapped on RTL:
   `journey.checkpoint.done` (“Done for now”) and `journey.checkpoint.keepGoing` (“Keep going”).
   “Done” → tier-2-lite settle animation → `corpan:journey-exit`. Stopping is presented as a win
   (engagement §1.2.5 — this is our principled deviation from TikTok).
6. If the session has passed ~25 min: append the time-dignity line `journey.checkpoint.deepSession`
   (“That’s a deep session — your reviews are scheduled either way.”). Report, never cut off.
7. If ≤ `softNagEvery` cards remain in the free daily quota: quiet counter line
   `journey.quota.cardsLeft` (§7.2).
8. Session-end Zeigarnik tease on “Done”: `journey.tease.next` with the next headline card’s title,
   one line, no pressure.

### 1.7 `RareCard` variants

Wrapper handles the tier-3 shimmer + flip; variants supply the face. The `rareVariant` is
selected by the engine’s seeded PRNG over the pack’s `rare_cards` (deterministic offline —
engine spec); the surface renders what it’s given:

| Variant | Face | Scoring |
|---|---|---|
| `delight` | same exercise, alternate narrator voice OR “did you notice?” micro-pattern callout | scored normally |
| `etymology` | wordpan paragraph for a word the learner *just* learned; large type, course-color accent | exposure only (unscored; counts as input strand) |
| `timeCapsule` | replay of a card struggled with weeks ago, banner `journey.rare.timeCapsule.title` | scored normally (it’s a review) |
| `miniGame` | `PackActivityCard` poster: pack art + “Bonus round” + play CTA | pack round result (§6) |
| `storyChapter` | `PackActivityCard` poster: book cover + “You’ve earned the next chapter” | reader segment-range result (§6) |

Rules baked into the wrapper: rarity never purchasable, never skippable-content-in-disguise;
every variant carries real learning value; `miniGame`/`storyChapter` never auto-launch — the
learner taps Play (a pack mount is a commitment; abandon = swipe past the poster, §3.5).

### 1.8 `StreakChipV2` + streak v2 accounting

Existing pieces stay: `store/progress.ts:92-119` `streakDays()` (books) and the opt-in
`StreakChip`. Journey extends, never forks:

- **New progress-store input**: journey card completions must count as “showed up”. Add to
  `store/progress.ts` (non-breaking, additive):

```ts
// store/progress.ts — additive
learningDays: string[]                    // localDay strings, ring-capped at 400
recordLearningDay: () => void             // idempotent per local day; called by journey runtime
// streakDays() gains: union(bookDays, learningDays, restDays())   — restDays injected via
// an optional provider registered by journey/streakV2.ts (progress stays journey-agnostic):
registerStreakDayProvider: (fn: () => string[]) => void
```

- **Rest days** (engagement §2.6): earn 1 token per 7 consecutive days, bank cap 2. On a missed
  day, `streakV2.ts` auto-applies a banked token — the day is *recorded* as a rest day (shown
  honestly: `journey.streak.restDayUsed`), never silently. Tokens live in the journey store (§2.1).
- **Repair by learning**: a broken streak ≥14 days offers a 3-day window: complete 2 standard
  sessions (2 checkpoints reached) to restore. One repair banked at a time; never purchasable.
  State machine in `streakV2.ts`; offer surfaces ONLY as a card in the feed
  (`journey.streak.repairTitle`), never a popup or notification.
- **Milestones**: day 7/30/100/365 → tier-2 celebration. No push notifications at P0.
- **Consent**: the chip stays governed by `corpan-streak-enabled`. Journey’s **pact card** (first
  session, after placement result) asks explicitly — `journey.streak.pactTitle/pactBody` with
  equal-weight accept/decline; accept writes `setStreakEnabled(true)`. This is the pact-consent
  resolution of engagement gap #3 (app-wide opt-in stance preserved; Journey users get a real
  consent ritual). **Copy discipline**: the chip states “{{count}} days”; banned: “don’t lose…”,
  any absolute.

`StreakChipV2` renders: flame + count, a tiny rest-day dot ×(tokens banked), and nothing at
streak 0. Used in `JourneyChrome` and (when enrolled) inside the HomeHub journey hero card;
Home’s global header keeps the v1 chip untouched.

### 1.9 `PlacementFlow`

UX shell over the engine’s 3-phase probe (adaptivity §4.3). Hard budget: ≤3 framing screens,
≤25 items, ~5 min.

1. **Offer screen**: `journey.placement.offerTitle/offerBody`, two equal choices:
   `journey.placement.startNew` (“I’m new to {{lang}}”) → skip test, θ=−4, done;
   `journey.placement.placeMe` (“I know some {{lang}}”).
2. **Probe loop**: `PlacementCard` renders engine-chosen probes through the same renderers in
   `mode="probe"`: no hints, no retry, no celebration beyond the tier-0 stamp, muted “skip if
   unsure” affordance (counts as miss). Progress: thin dots, not a numbered bar (a countdown reads
   as an exam). Fast forms only: `choice_pick`, `listen_pick`, `word_order`, `listen_type` short —
   **no `speak_echo` during placement** (mic friction).
3. **Result screen** (`PlacementResult`): frontier unit named (`journey.placement.doneBody`),
   endowed progress line `journey.placement.prelit` (“You’re starting with {{count}} items already
   known”) with PathViz pre-filling animation, then the streak pact card, then the feed.

Abandoning placement mid-probe (Home button) stores nothing; next entry re-offers. Declining
twice sets `placementDeclined = true` (starts at zero; “place me” remains available in the
overflow menu).

### 1.10 `PathViz` P0

Simple arc/unit path — NOT the constellation (explicitly P1, D11 out-of-scope):

- Vertical ribbon: arcs (A1 Launchpad → …) as sections, units as nodes with fill = unit mastery
  (engine-derived, recomputed on read). Current unit pulses gently. Locked units dimmed, no red.
- Node states: locked / current / practiced / mastered (hysteresis is engine-side; UI just renders).
- Entered from: checkpoint mini-viz tap, overflow menu, unit-summit tier-2 moment.
- Tapping a *previous* (dimmed-toward-review) unit enqueues its review into the next session —
  the one pull-based user choice allowed into the feed (engagement §2.7).
- Render as DOM/SVG; unit counts at P0 (≤ ~40 nodes for Launchpad + Arc A1) don’t need canvas.

---

## 2. State

### 2.1 Zustand store `corpan-journey-v1` — meta only

Engine per-item state (ItemCards, review log) is **IndexedDB LARGE tier** per D5 — never here.
This store is small, follows the exact house pattern (`create<T>()(persist(...))`,
`createJSONStorage(() => localStorage)`, partialize, integer version + migrate,
`getState()` imperative access):

```ts
// corpan-app/src/store/journey.ts
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type AdvanceMode = "swipe" | "auto"
export type JuiceIntensity = "full" | "reduced" | "minimal"

export type CourseKey = string // `${stackId}::${courseId}` e.g. "abc123::journey_en"
export const courseKeyOf = (stackId: string, courseId: string): CourseKey =>
  `${stackId}::${courseId}`

export type JourneyCourseMeta = {
  enrolledAt: string                  // ISO
  // Placement
  placementDone: boolean
  placementDeclined?: boolean
  // Path position (display only — engine owns truth; this is the resume hint)
  arcId: string | null
  unitId: string | null
  // Session bookkeeping
  sessionCounter: number              // display/resume bookkeeping only — the engine owns the rare-card PRNG seed (§2.4)
  lastCardAt: string | null           // ISO
  cardsToday: { day: string; count: number }   // localDay-keyed; display + ring only (quota truth is the gate, §7)
  checkpointCountToday: number
  // Streak v2 (journey-scoped economy; day set lives in progress store)
  restDayTokens: number               // 0..2
  restDaysGrantedAt: string[]         // localDay of each grant (audit)
  restDaysUsed: string[]              // localDays covered by a token
  repair: { offeredAt: string; deadlineDay: string; checkpointsDone: number } | null
  // Zeigarnik tease persisted across sessions
  nextTease: string | null            // i18n-ready title of next headline card
}

type JourneyState = {
  byCourse: Record<CourseKey, JourneyCourseMeta>
  // Surface settings (global, not per-course)
  advanceMode: AdvanceMode            // default "swipe"
  juiceIntensity: JuiceIntensity      // default derived: kid→full, adult learner→reduced
  soundsEnabled: boolean              // default true (minimal intensity forces off)
  streakPactAnswered: boolean         // pact card shown+answered (accept wrote corpan-streak-enabled)

  // Actions
  enroll: (key: CourseKey) => void
  updateCourse: (key: CourseKey, patch: Partial<JourneyCourseMeta>) => void
  noteCardCompleted: (key: CourseKey) => void   // bumps cardsToday (local-midnight reset) + lastCardAt
  setAdvanceMode: (m: AdvanceMode) => void
  setJuiceIntensity: (j: JuiceIntensity) => void
  setSoundsEnabled: (on: boolean) => void
  setStreakPactAnswered: (b: boolean) => void
  grantRestDay: (key: CourseKey) => void        // cap 2
  consumeRestDay: (key: CourseKey, day: string) => boolean
}

export const useJourneyStore = create<JourneyState>()(
  persist(
    (set, get) => ({ /* … */ }),
    {
      name: "corpan-journey-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        byCourse: s.byCourse,
        advanceMode: s.advanceMode,
        juiceIntensity: s.juiceIntensity,
        soundsEnabled: s.soundsEnabled,
        streakPactAnswered: s.streakPactAnswered,
      }),
      migrate: (state: unknown, _version: number) => state as JourneyState, // v1 no-op; bump on shape change
    }
  )
)
```

Size audit: ~300 B per enrolled course + ~120 B settings — comfortably inside the shared
localStorage budget. Anything that grows per-item or per-review goes to the engine’s IndexedDB
tier, no exceptions (the 5 MB budget has already overflowed once — `app-shell.md` §2).

Keying is `(stackId, courseId)` — the established multi-profile pattern (`history.ts`). The
active course = `courseKeyOf(activeStackId, "journey_" + targetLangOf(activeStack))`, where
target = `languages[1]` (SINGLE_LANGUAGE_RULE: a one-language stack has no target ⇒ Journey entry
points hide, §5.4).

### 2.2 Session-scoped state (NOT persisted)

Lives in `runtime.ts` React state/refs: current card window, session history ring (last 20
completed cards for scroll-back), combo counter, replay-queue mirror, per-session flags
(listening-mode toggle §3.2, deep-session notice fired). A backgrounded app resumes mid-session
if <30 min elapsed (`lastCardAt`), else next entry starts a fresh session (warm-win opener).

### 2.3 Runtime interface (feed ⇄ engine seam)

```ts
// journey/runtime.ts
export type JourneyRuntime = {
  current: FeedCard | null
  next: FeedCard | null                      // pre-mounted by FeedScroller
  history: CompletedCard[]                   // read-only ring for scroll-back
  submitResult: (r: ActivityResult) => void  // grades, schedules, advances window
  abandonCurrent: () => void                 // §3.5 — emits ActivityResult{abandoned:true}
  peekQuota: () => { remaining: number; limit: number }  // §7
  sessionStats: () => { newCount: number; reviewCount: number; bestCombo: number; startedAt: number }
}
export function useJourneyRuntime(courseKey: CourseKey): JourneyRuntime
```

`submitResult` is the single write path: engine update → `useJourneyStore.noteCardCompleted` →
`useProgressStore.recordLearningDay()` → quota `gate.note()` when the completed card was a
**debut** (§7.2 — the one debit site) → pull the next `EngineCard`s from the engine and map them
(§2.4) as needed.

### 2.4 `FeedCard` (surface-side card descriptor)

The **engine is the producer of session structure**. It emits `EngineCard`s (engine spec) —
exercise cards, `checkpoint` cards (with their summary), a `welcomeBack` signal from
`startSession()` (gap ≥ 7 days; `retainedPct` = mean retrievability over seen cards), and the
`rareVariant` selected by its seeded PRNG over the pack’s `rare_cards`. `journey/runtime.ts`
maps `EngineCard` → `FeedCard` **1:1** and synthesizes ONLY `blockIntro` (at `modelNeeds` run
boundaries, §6.3) — no other behavior invention in the runtime. The `FeedCard` discriminated
union is surface-owned and canonical **here**:

```ts
export type FeedCard =
  | { kind: "exercise";  cardId: string; spec: ActivitySpec; rare?: RareVariant }
  | { kind: "checkpoint"; cardId: string; summary: CheckpointSummary }
  | { kind: "packActivity"; cardId: string; packId: string; spec: ActivitySpec;
      poster: { name: string; imageUrl?: string }; rare?: "miniGame" | "storyChapter" }
  | { kind: "blockIntro"; cardId: string; modelNeeds: ("stt" | "llm")[]; blockLen: number }
  | { kind: "welcomeBack"; cardId: string; retainedPct: number }

export type RareVariant = "delight" | "etymology" | "timeCapsule" | "miniGame" | "storyChapter"
```

`cardId` is unique per feed instance (`${sessionCounter}-${seq}`) — it is `ActivityResult.specId`’s
sibling, used for the scroll-back ring and result de-dup (a card may resolve exactly once).

Poster/cover art (`poster.imageUrl` — pack art, book covers) and any HomeHub journey imagery
render via `<OfflineImage>` per `specs/offline-cache.md`, never a raw `<img>`.

---

## 3. Interaction spec

### 3.1 Card lifecycle

`arrive → do → celebrate → advance`, per engagement §2.1:

1. **Arrive**: card is full-screen, already mounted. Audio-first cards (`listen_*`, `intro_echo`,
   `speak_echo` prompt) auto-play their audio once on arrival (never on pre-mount — the hidden
   next card is silent until it becomes current).
2. **Do**: one interaction paradigm per card. Renderer reports raw outcome to `ActivityCardHost`.
3. **Celebrate**: tier computed by host: correct+fast+firstTry → 1 (or combo), correct → 0,
   milestone override → 2, rare wrapper → 3. Scroll gesture during celebration skips it
   (celebrate() promise races the gesture).
4. **Advance**: per mode (§3.2). Completed card “settles”: checkmark stamp, scale 0.98, next card
   peeks ~15% from the bottom (top in… no — vertical feed is always bottom-peek; RTL does not flip
   the vertical axis).

**Why-this-card transparency** (engagement §2.9.7): long-press (500 ms) anywhere on the card frame
→ small popover: `journey.exercise.whyThisCard` interpolated with the engine’s reason string
(“Reviewing *pedir* — last seen 4 days ago”). Never forced into view.

### 3.2 Advance rules per card type — scroll vs auto

Global setting `advanceMode: 'swipe' | 'auto'` (default **swipe** — commitment gesture preserves
autonomy; engagement gap #4 acknowledges this deserves a usability test).

| Card type | swipe mode | auto mode | Notes |
|---|---|---|---|
| `choice_pick`, `cloze`, `word_order`, `match_pairs` | swipe to advance | auto after celebration + 800 ms | |
| `flip_recall` | swipe | auto + 800 ms | self-verdict tap is the completion |
| `intro_echo` | swipe | auto after audio end + 1500 ms (time to echo aloud) | |
| **`listen_pick`, `listen_type`** | **listening-run exception ↓** | auto + 800 ms | |
| `speak_echo` (in block) | auto within block (+1000 ms after score) | auto | hands/mouth busy; swiping mid-block still allowed |
| `blockIntro` | requires tap (“Ready”) | requires tap | model load + mic consent must be deliberate |
| `checkpoint` | manual only | manual only | equal-weight stop/continue |
| `rare` reveal | manual only | manual only | anticipation moment is never rushed |
| `packActivity` poster | manual only (tap Play or swipe past) | manual only | |
| `welcomeBack` | swipe | auto + 2000 ms | |

**Listening-run exception** (the listen-heavy case): when ≥2 consecutive `listen_*` cards are
queued, the first card shows a one-tap pill `journey.settings.listeningMode` (“Hands-free ▸”).
Tapping arms auto-advance for the remainder of the run even in swipe mode; the pill turns into a
visible countdown ring on each card (800 ms post-celebration) with tap-to-pause. The run ends →
mode reverts. This gives eyes-free/commute listening without flipping the global default.

Auto-advance NEVER fires on a failed card (§3.3 owns that flow) and never past a manual-only card.

### 3.3 Failure: inline retry with scaffold, then re-enqueue

Wrong answer never blocks scrolling for long (engagement §2.1 failure handling):

1. **First miss**: gentle incorrect stamp (no harsh buzz; short low chime at full intensity only).
   Card stays; `ScaffoldHint` offers ONE scaffold appropriate to the type:
   - `choice_pick`/`listen_pick`: eliminate one distractor.
   - `listen_type`/`cloze` (type): reveal first word / first letter of the blank.
   - `word_order`: lock the first tile into place.
   - `match_pairs`: flash one correct pair.
   - `speak_echo`: replay at 0.7× + show the text enlarged.
   Retry is a fresh attempt on the same card. Scaffold use ⇒ `hintsUsed ≥ 1` in the result
   (grades to Hard at best — engine mapping).
2. **Second miss**: show the correct answer plainly (`journey.exercise.answerWas`), speak it once,
   one-line note `journey.exercise.comeBackNote` (“We’ll come back to this.”). Card completes as
   `outcome: 'fail'`; the engine re-enqueues the item **3–8 cards later in an easier form**
   (mixer REPLAY pool, minGap 3 — adaptivity §5.4). Advance arms normally.
3. No lives, no lesson restart, no third attempt (frustration guard: a second same-session failure
   of the *replayed* card marks it for tomorrow — engine rule; the surface just renders what’s next).

`match_pairs` partial rule: each wrong pairing counts one miss against that pair’s item only;
the card completes when all pairs match; `perItem` carries per-pair outcomes.

### 3.4 Scroll-back is read-only review

Swipe back through up to 20 completed cards. Review mode: answers rendered, inputs disabled
(`pointer-events` off on interactive regions), audio replay allowed (replay is free and unmetered),
no scoring, no celebration, no quota effect. Kills grinding, keeps “wait, what was that word?”.
The history ring is session-scoped; leaving the surface clears it.

### 3.5 Swipe-away / abandon semantics → `ActivityResult.abandoned`

An unanswered card can be skipped, but never by accident:

- First forward-swipe on an incomplete card: rubber-band resist + edge hint
  `journey.exercise.skipHint` (“Swipe again to skip”).
- Second forward-swipe within 1.5 s: commits the skip. `ActivityCardHost` emits:

```ts
{
  specId, score: 0, perItem: [],        // no per-item grades — abandonment is not evidence of forgetting
  durationMs, abandoned: true
}
```

- Exiting the surface (Home button, `corpan:exit` chain, app kill mid-card): same envelope,
  emitted best-effort on teardown (`visibilitychange`/unmount hook); if the process dies first,
  the un-resolved card simply reappears next session (cardIds are session-scoped; no double-grade
  risk).
- `packActivity`: swiping past the poster = abandoned (cheap). Abandoning *inside* the pack =
  pack exits via `corpan:exit` without reporting → overlay teardown calls `endActivitySession()`,
  which synthesizes the abandoned result from the buffered `reportItem` evidence
  (activity-contract §3.2 — partial work is never lost; §6.2).
- Engine treatment (for reference; engine spec owns it): abandoned ⇒ no FSRS grade; item returns
  to its pool; ≥3 abandonments of one activityType in a session is a mixer signal to down-weight
  that type today.

Checkpoint cards cannot be abandoned (they are already a stopping point — swiping forward equals
“Keep going”, swiping back reviews).

### 3.6 Card ordering constraints (surface-enforced sanity)

The mixer owns composition; the surface re-verifies two invariants before mounting (defense in
depth, cheap): no two consecutive cards with identical `activityType`; every `modelNeeds` run is
preceded by the runtime-synthesized `blockIntro` (§2.4/§6.3 — a lone `speak_echo` still gets one;
runs are engine-batched, never surface-remapped). Violations log a console warning — they
indicate an engine bug; the surface performs no fix-up (R5: the runtime maps, never invents).

### 3.7 Session shapes (goalIntensity finally drives something)

`goalIntensity` (`store/settings.ts:237`, captured at onboarding, unused at runtime today) maps to
defaults; the cadence value is passed to the engine as `FeedConstraints.checkpointCadence` — the
engine’s checkpoint layer owns emission (§1.6, §2.4). All adjustable in the overflow menu later (P1):

| goalIntensity | Daily ring goal | `FeedConstraints.checkpointCadence` |
|---|---|---|
| `casual` | 10 cards | 8 |
| `daily` | 20 cards | 10 |
| `intensive` | 40 cards | 12 |

Micro sessions fully count: any 1 card ticks the streak (streak = showed up; the ring measures
learning volume separately — engagement §1.4 split).

---

## 4. The native exercise renderers (v1: 8 core + 2 composite)

**The canonical activityType registry is `ACTIVITY_TYPES`, an exported const in
`activityContract.ts`** (activity-contract §1). It carries per-type metadata
`{ activityType, form, strand, guessable, estSec, modelNeeds }` for exactly these ten
snake_case types: `choice_pick, listen_pick, listen_type, cloze, word_order, match_pairs,
flip_recall, speak_echo, intro_echo, grammar_note`. Translation direction is a **param**
(`direction`, below) of `choice_pick`/`listen_type`/`cloze` — never a type. Pack types are
`<packId>:<name>`. The registry is the one metadata source — it also feeds the engine’s
activityTemplates; the table below is this surface’s *rendering* spec for the same ten types,
and its Form/modelNeeds columns restate registry metadata (CI drift check, sync-contract style).

All renderers implement one contract:

```ts
// exercises/types.ts
export type ExerciseProps = {
  spec: ActivitySpec                  // from contentPacks/types.ts (D2)
  items: ResolvedItem[]               // resolved by journey/content/resolve.ts — see specs/content-resolver.md
  mode: "live" | "review" | "probe"
  scaffold: ScaffoldState             // §3.3 retry state, host-owned
  onOutcome: (o: RawOutcome) => void  // { correct: boolean|number, perItem?, latencyMs, detail? }
  speak: (lang: string, text: string, opts?: { rate?: number }) => Promise<void>
}
```

`ResolvedItem`, the exact per-ItemRef-kind resolution queries, and the **distractor sampler
contract** (pool, exclusions, dedup, seeded determinism) are owned by `specs/content-resolver.md`
(`journey/content/resolve.ts`); renderers develop against it in the fixture slice. What follows
here are the renderer-side requirements only: each renderer receives fully resolved display/tts
text, translations, and romanization — it never queries content itself.

`ActivitySpec.params` is `Record<string, unknown>` at the contract level (D2); each renderer
declares a typed params schema below (validated with a lightweight parse; unknown fields ignored —
additive-optional, house convention). `ItemRef` kinds per D3.

Common param fields: `direction: 'toNative' | 'toTarget' | 'targetOnly'`,
`level: string` (CEFR hint for distractor pools).

| # | activityType | Form | Accepts ItemRef kinds | Key params | modelNeeds | Notes |
|---|---|---|---|---|---|---|
| 1 | `choice_pick` | recognition | `phrase`, `word`, `concept`* | `direction`, `choices: 3\|4`, `media: 'text'\|'image'`, `distractors: 'sameSkill'\|'nearTheta'` | — | The MC workhorse; grades cap at Good (guessable). Distractor semantics per `specs/content-resolver.md`. *`concept` + `media:'image'` = picture-choice — **params-gated on imagepan presence** (D10.6); until imagepan ships, runtime never emits `media:'image'`. |
| 2 | `listen_pick` | recognition | `phrase`, `word` | `choices: 3\|4`, `hideTextUntilAnswer: boolean`, `slowReplay: boolean` | — | Audio auto-plays on arrival; replay + 0.7× replay free. |
| 3 | `listen_type` | production | `phrase`, `word` | `tolerance: {diacritics: boolean, punctuation: boolean, caseFold: boolean}`, `maxLen` | — | Dictation. Compare via per-language normalizer (NFKD fold per tolerance). ASR dictation input optional later via `hostApi.asr` (keyboard is the floor). |
| 4 | `cloze` | cued recall | `phrase`, `grammarNode`† | `mode: 'bank'\|'type'`, `blankIndex: number`, `bankSize: 4..6` | — | †`grammarNode` resolves to an exemplar phrase carrying the node; the node is the graded item. |
| 5 | `word_order` | cued recall | `phrase`, `grammarNode`† | `distractorTiles: 0..2`, `sourceShown: boolean` | — | Tokenize space-delimited langs by whitespace; CJK/Thai via `Intl.Segmenter(lang, {granularity:'word'})` with a per-language fallback table. Tiles honor `dir` of the TARGET language, not the UI. |
| 6 | `match_pairs` | recognition | `word`, `phrase` (2–5 refs) | `pairs: 4\|5`, `axis: 'text-text'\|'text-audio'` | — | Multi-item card: `perItem` outcome per pair. `text-audio` axis is a listening card for advance rules (§3.2). |
| 7 | `flip_recall` | cued recall | `word`, `phrase` | `direction` | — | Show prompt → learner recalls → tap to flip → self-verdict `journey.exercise.knewIt` / `didntKnow`. Self-report caps at Good; `didntKnow` = fail (enters retry flow §3.3 step 2 directly — no scaffold retry for self-graded cards). |
| 8 | `speak_echo` | production | `phrase`, `word` | `passThresholds: {again: 0.45, hard: 0.7, good: 0.9}`, `maxAttempts: 2`, `showText: boolean` | `['stt']` | Renders via the `cap-pronounce` capability module (`specs/capability-modules.md`); `SpeakEcho.tsx` is a thin mount host. Speak-after-me via `hostApi.stt` session with `expectedText`. Graded on comprehensibility, **never hard-fails a speech item below Hard when `overallScore ≥ 0.45`** (pedagogy §12.5). Mic-denied / STT unavailable ⇒ runtime swaps the card to `listen_type` and flags the speaking block skipped (§6.3). MUST call `stt.releaseAudio` at block end. |
| 9 | `intro_echo` | — (unscored) | `phrase`, `word` | `showRomanization: boolean` | — | New-item debut: show + hear + echo prompt. No scoring; the FSRS card is created at first *scored* exposure (adaptivity §5.3). Composite half of every new-item intro pair. |
| 10 | `grammar_note` | language-focused | `grammarNode` (+ exemplar `phrase` refs) | `noteKey: string` (L1-keyed scaffolding string from course pack overlay tables), `drill: { activityType: 'cloze'\|'word_order', params }` | — | Composite: note panel (L1 per taper, pedagogy §12.4) + one embedded micro-drill graded as the node’s item. |

That is the D8 menu minus `read-segment` (deferred: book segments ship inside reader packs and are
served through the earthgate *provider* in v1 — see decisions, §10) and minus standalone
`etymology gem` (it is a rare-card face, §1.7, not a scheduled exercise).

Renderer-internal rules, all types:

- Target-language text always rendered with `dir={isRTL(targetLang) ? 'rtl' : 'ltr'}` and
  `lang` attribute set (font selection + hyphenation).
- Romanization honors stack `showRomanization`.
- Long-press word explanations (`WordExplanationText`) attach where a wordpan pack covers the pair
  — same wiring as `MainExperience.tsx:228-237`.
- Every renderer must be dumb about scheduling: no store writes, no quota calls, no celebration
  calls. `onOutcome` only.

---

## 5. Shell integration (App.tsx, landing, HomeHub, onboarding)

### 5.1 Decision: **sibling surface**, not an `activeGame` union member

Recommendation (firm): Journey mounts as its **own overlay state, sibling to `activeGame`**, not
as a pseudo-game id like `phrase_main`.

Why: `activeGame` is a single slot. Journey must stay warm-mounted while a pack anchor card
launches — if Journey *were* the `activeGame`, launching lingo-hero would tear the feed down and
lose the session window, defeating D1’s “core cards must be instant.” As a sibling at z-1050 the
existing pack overlay (z-1100) stacks above it and `corpan:exit` from the pack naturally lands
back on the still-running feed. Readers already prove the “overlay above an always-mounted
surface” architecture over Home; Journey adds one more layer with identical semantics.

```tsx
// App.tsx — additions
const [journeyOpen, setJourneyOpen] = useState(false)

// Launch chokepoint (mirrors openPhrase, App.tsx:598-604):
const openJourney = useCallback(() => {
  setJourneyOpen(true)
  updateJourneyParam(true)            // pushes ?journey=1 (URL-addressable, popstate-safe)
}, [])

// Render, between HomeHub and the activeGame overlay block:
{journeyOpen ? (
  <ErrorBoundary onError={() => { setJourneyOpen(false); updateJourneyParam(false) }}>
    <JourneySurface />
  </ErrorBoundary>
) : null}
```

- URL param `?journey=1` parsed at boot alongside `?game=` (deep link + popstate, same pattern as
  `App.tsx:165-185, 488-501`). A `?game=` deep link wins over `?journey=`.
- `data-experience-active` effect extends its condition to `Boolean(activeGame) || journeyOpen`.

### 5.2 Exit chain

New event `corpan:journey-exit` (dispatched by JourneyChrome’s Home button and CheckpointCard
“Done”): App handler closes the journey surface. The existing `corpan:exit` handler is untouched —
it clears `activeGame` only; when a pack launched by Journey exits, the feed is revealed again
underneath. Sequence from deepest: pack `corpan:exit` → feed; feed `corpan:journey-exit` → Home.

### 5.3 `LandingIntent` + onboarding graph

```ts
// store/landing.ts — union extension (one line, per app-shell.md §1)
export type LandingIntent =
  | { kind: "home"; tab?: "roll" | "library" | "recommended"; razzle?: boolean }
  | { kind: "experience"; packId: string; razzle?: boolean }
  | { kind: "discover" }
  | { kind: "tour" }
  | { kind: "journey"; razzle?: boolean }        // NEW
```

Consumption in the `useLayoutEffect` landing block (`App.tsx:679-746`): `intent.kind === "journey"`
→ `openJourney()` (razzle variant reuses `PackLaunchTransition` with `launch: openJourney`,
`isReady: () => journeyCoursePackInstalled()`).

**Onboarding graph nodes** (data-only additions to `ONBOARDING_GRAPH`, no engine change — the
graph was designed for this, `graph.ts:116-120`):

1. `whatToStart` gains a first option (learn/polyglot journeys only, hidden for enjoy/child at v1):

```ts
{
  id: "journey",
  labelKey: "onboarding.whatToStart.journey.label",     // “Follow the Journey”
  descKey: "onboarding.whatToStart.journey.desc",       // “A guided course, one step at a time”
  apply: (c) => { c.patch({ whatToStart: "journey" }); preinstallForChoice("journey") },
  next: "commit",
},
```

2. `resolveLanding` maps `"journey"` → `{ intent: { kind: "journey", razzle: true },
   installPackId: journeyPackIdFor(targetLang) }` (quiet-preinstalls the `journey_en` course pack
   via the existing `corpan:preinstall-pack` seam; graceful fallback if the course pack for the
   target doesn’t exist yet → phrase_main, exactly the existing fallback discipline). The journey
   pack index consulted by `journeyPackIdFor`/`journeyCoursePackInstalled` is a `cachedFetch`
   resource (TTL 300 s policy) per `specs/offline-cache.md`.
3. **Placement offer is NOT an onboarding node.** It lives inside `PlacementFlow` on first surface
   entry (§1.9) — onboarding stays short, and users entering Journey later (Home hero) get the
   identical flow. The existing `calibrateLearn` answer seeds the engine’s placement prior
   (never→skip-offer-default-new, a_little/advanced→offer prominently).
4. The streak **pact** card also lives in-surface (post-placement), not in onboarding.

### 5.4 HomeHub hero card + registry

- **Registry**: add `journey_main` to the local `ExperienceMeta` map in `experiences/registry.ts`
  (`categories: ["study"]`, `goodForClass: ["learner","polyglot"]`, low `order` so it ranks high,
  `kidFriendly: true`). It participates in “For you” ranking pre-enrollment like any experience;
  `onClick` = `openJourney`. Hidden when the active stack has no target language
  (`languages.length < 2`) — same mechanism as language-gated packs.
- **Enrolled state — pinned continue hero**: when `useJourneyStore` has an enrolled course for the
  active stack, HomeHub renders a dedicated Journey card ABOVE the “For you” section (not part of
  the cycling hero): course-color gradient frame, `journey.heroCard.title` (“Your Journey”),
  progress line `journey.heroCard.progress` (“{{unit}} · {{count}} cards to today’s goal”),
  StreakChipV2 inline, CTA `journey.heroCta.continue`. One tap → `openJourney()`. This is the
  CURR lever: the returning user’s next action is always one tap from Home.

### 5.5 Result transport (owned elsewhere)

Result transport is owned by `journey/activitySession.ts` (activity-contract §3.2–3.3): the
typed rail (`hostApi.journey.reportResult`) and the event rail (`corpan:activity-result`) both
delegate to the same ingest there — validation, specId matching, per-item dedup, and terminal
de-dup included. The feed registers a callback via `beginActivitySession` (§6.1) and consumes
exactly one validated `(ActivityResult, meta)` per pack session (§6.2). This surface adds no
listener of its own and never re-implements routing. A standalone pack emitting results outside
a journey session is dropped by the session guard (contract-owned, logged).

---

## 6. Pack activity cards: launch, handoff, return

### 6.1 Launch (host → pack)

`PackActivityCard` poster tap:

1. Runtime marks the card `pending` (a ref mapping `cardId` → the launched spec; survives
   re-render, not persisted) and calls
   `beginActivitySession(game.id, spec, { onResult })` (activity-contract §3.2) — the callback
   is the ONLY path a result reaches the feed (§6.2). This pack-anchor launch is a quota debit
   event (§7.2).
2. Host calls the existing chokepoint: `handleLaunchGame(game, entry)` with the widened
   `PackLaunchEntry` (D2): `entry = { activity: spec }`. The spec flows through the proven seam
   `mount(container, hostApi, initialState)` (`ContentPackHost.tsx:549-558`) — the pack reads
   `initialState.activity`.
3. Pack overlay (z-1100) mounts over the live feed (z-1050). Feed pauses TTS/audio and its
   timers on `corpan:host-pause`-equivalent (it watches `activeGame` via a store subscription).
4. Capability guard: the card is only ever *emitted* for packs whose catalog/manifest declares a
   matching `activities: [{activityType, itemKinds}]` entry AND whose installed version satisfies
   it (catalog-first, OTA — D2). Not installed → the mixer never schedules it (graceful
   degradation, adaptivity §5.1); the surface never shows a dead poster.

### 6.2 Result return (pack → host) + celebration on return

1. Pack finishes its round → calls `hostApi.journey.reportResult(result)` (or dispatches
   `corpan:activity-result` directly — dual-rail for SDK-lagging packs), THEN dispatches
   `corpan:exit` — reporting before exit is already normative (activity-contract §3.4).
2. Both rails ingest through `activitySession.ts` (activity-contract §3.2–3.3); the runtime
   receives exactly one validated `(ActivityResult, meta)` through the `onResult` callback it
   registered in `beginActivitySession` (§6.1), clears the pending card, submits to the engine.
3. `corpan:exit` clears `activeGame` → feed is revealed → the pending card is now `complete`:
   it plays its **celebration on return** — tier 1 for `score ≥ 0.8`, tier 0 otherwise; if the
   card was a rare roll the tier-3 shimmer already played pre-launch, so return celebration is
   capped at tier 1 (no double jackpot).
4. **Exit without result** (user quit the pack mid-round): overlay teardown calls
   `endActivitySession()`, which synthesizes the abandoned result from the buffered `reportItem`
   evidence — partial work is never lost, and the feed receives it through the same callback
   (`meta.synthesized: true`). The card settles as skipped, no celebration, no retry loop. There
   is no feed-side timer and no feed-side synthesis of any kind.
5. Reader chapters (`storyChapter`): earthgate is instrumented (D11) to accept a segment-range
   param inside `spec.params` and report a segment-coverage result; the legacy
   `corpan:segment-progress` event continues to fire independently (progress store double-entry
   is fine — different schemas, different consumers).

### 6.3 Model-heavy blocks: the speaking block

STT (≈1.5 GB) and LLM (≈3.3 GB) cannot co-reside on ≤8 GB phones and load/unload is seconds-slow
(D8). The mixer batches `modelNeeds` cards into contiguous **blocks** (3–4 cards); the surface
presents them as a unit:

1. `BlockIntroCard` arrives: mic glyph, `journey.block.speakingIntro` (“Speaking practice —
   {{count}} cards”), Ready button (manual advance, §3.2). On arrival (not on Ready), the runtime
   already kicked `hostApi.stt.prepare()` in the background; the button shows
   `journey.block.loadingModel` with a progress shimmer until `prepare` resolves, so the wait
   overlaps the reading moment.
2. Cards 2–4: `speak_echo` cards, auto-advance within the block (+1000 ms) — hands are busy.
3. Block end: `stt.releaseAudio()` (iOS mic indicator, non-negotiable — pack-contract §1.7) and
   `stt.unload()` if the next 10 mixer slots contain no STT card.
4. Failure paths: `prepare` fails / mic permission denied → `journey.block.sttUnavailable` line,
   block cards transparently re-rendered as `listen_type` equivalents; the engine is told via
   `detail: { flags: { sttUnavailable: true } }` on each result (the typed detail envelope,
   activity-contract §1) so it stops scheduling STT today.
5. LLM-backed cards (out of v1 scope for native renderers; tutomaton grading is explicitly
   deferred, D11) will reuse the identical block pattern with `modelNeeds: ['llm']`.

---

## 7. Quota surface (D9)

### 7.1 Registry row

```ts
// packs/shared/monetization/src/quotas.ts — add
journey_daily: {
  packId: "corpan_app",
  surface: "journey_daily",
  dailyLimit: 60,          // placeholder — free-tier N is an OPERATOR DECISION (parked, ARCHITECTURE
                           // “Open decisions”); remote-config overridable like every row
  softNagEvery: 0,         // no mid-feed nags; the checkpoint counter line is the only pre-cap signal
  unitLabel: "cards",
},
```

Plus `"journey_daily"` added to the `PaywallSurface` union (`store/paywall.ts:23-45`), NOT in
`ENGAGEMENT_SURFACES` (it is interaction-gated, per-pack-cadence class).

### 7.2 Behavior

- Gate constructed once per surface mount in `runtime.ts` — inside an effect, StrictMode-safe,
  exactly like `MainExperience.tsx:289-308`:
  `createDailyQuota("journey_daily", { isSubscribed: () => useEntitlementStore.getState().subscription.active })`.
- **What counts — NEW intake only**: one `note()` per completed **debut** card (the first-ever
  presentation of an item) and one per **pack-anchor launch** (poster tap, §6.1; swiping past
  the poster is free). **Due-review, replay, and repair cards are NEVER metered** — pay-to-not-
  forget is dead, matching the parlometron dignity precedent exactly. Also free: scroll-back
  review, audio replays, checkpoint cards, placement probes, abandoned cards, and rare-card
  *reveals* (a rare card whose exercise is a review stays free; a rare debut debits as a debut).
- **One debit site**: `runtime.ts` — `submitResult` debits completed debuts (§2.3); the §6.1
  launch path debits pack-anchor launches. No other code path may `note()` this gate;
  activity-contract §9 references this site rather than defining its own rule.
- **Pack activities launched by Journey debit `journey_daily`, not the pack’s quota** (D9). Wiring:
  when `initialState.activity` is present, the pack MUST NOT construct/note its own daily gate
  (rule added to PACK_DEV.md; enforced in the three v1 instrumented providers). Standalone
  launches of the same packs keep their existing caps untouched.
- **At the cap**: the gate dispatches `corpan:daily-locked` (host already renders the ONE universal
  `DailyLockOverlay`, `App.tsx:370-389`) — accomplishment framing (“You did your {{limit}} cards
  today ✓”), countdown to local midnight, clearly-labeled Plus CTA. Never shown to subscribers.
  The feed behind it stays on the last completed card; scroll-back review remains available after
  dismissing the overlay (review is never gated).
- **Upsell moment + copy** (honest, no absolutes — house rule): the pre-cap signal is one quiet
  line on checkpoint cards when ≤10 cards remain (`journey.quota.cardsLeft`). The lock overlay body
  uses `journey.quota.plusBody`: “Corpán Plus removes the daily card limit.” Banned framings:
  “unlimited forever”, “never stop”, any pedagogy-disguise (“your brain needs rest” as a lock
  rationale is dishonest — the lock is monetization and says so).

---

## 8. i18n key inventory

All keys ship in `public/locales/en/common.json` under a new top-level `journey` object (+ 3 keys
in existing namespaces). **The `npm run check:i18n` build gate requires every key in all ~54
locales — translation is a build task, agents translate directly per `corpan/CLAUDE.md`, fan out
per-locale subagents, preserve `{{placeholders}}`.** Inventory (en defaults shown; final copy may
be tuned but keys are fixed):

```jsonc
"journey": {
  "name": "Journey",                                  // registry/experience name
  "tagline": "Your guided path, one card at a time",
  "heroCard": { "title": "Your Journey",
                "progress": "{{unit}} · {{count}} cards to today's goal" },
  "heroCta": { "start": "Start your Journey", "continue": "Continue" },
  "chrome": { "home": "Home", "menu": "Journey options", "unit": "Unit {{n}}: {{name}}" },

  "exercise": {
    "check": "Check", "continue": "Continue", "skipHint": "Swipe again to skip",
    "retry": "Try again", "showAnswer": "Show answer", "answerWas": "The answer was",
    "comeBackNote": "We'll come back to this.", "whyThisCard": "Why this card?",
    "typeWhatYouHear": "Type what you hear", "typeHere": "Type here…",
    "tapToOrder": "Tap the words in order", "matchPairs": "Match the pairs",
    "flipToReveal": "Tap to reveal", "knewIt": "I knew it", "didntKnow": "Not yet",
    "speakNow": "Speak now", "listen": "Listen", "listenSlow": "Slower",
    "hint": "Hint", "correct": "Correct", "incorrect": "Not quite",
    "pickTranslation": "Pick the translation", "pickWhatYouHear": "Pick what you heard",
    "fillTheBlank": "Fill the blank", "newItem": "New", "reviewedEarlier": "Viewed earlier"
  },
  "intro": { "listenAndEcho": "Listen, then say it aloud", "newWord": "New word", "newPhrase": "New phrase" },
  "grammar": { "noteLabel": "Grammar note", "tryIt": "Try it" },

  "checkpoint": {
    "title": "Checkpoint",
    "summary": "{{new}} new · {{reviews}} reviews · best combo {{combo}}",
    "done": "Done for now", "keepGoing": "Keep going",
    "dailyRing": "{{done}}/{{goal}} today",
    "deepSession": "That's a deep session — your reviews are scheduled either way.",
    "streakTicked": "Day {{count}} ✓"
  },
  "celebrate": {
    "combo": "{{count}} in a row", "perfect": "Perfect",
    "wordsLearned": "{{count}} words learned", "unitComplete": "Unit complete: {{name}}",
    "streakDay": "Day {{count}}", "placementDone": "You're placed"
  },
  "rare": {
    "reveal": "Something special…",
    "etymologyGem": "Word story",
    "timeCapsule": { "title": "Time capsule", "body": "You worked hard on this {{when}} — look at you now." },
    "delight": { "newVoice": "A different voice", "didYouNotice": "Did you notice?" },
    "miniGame": { "title": "Bonus round", "play": "Play" },
    "story": { "unlocked": "You've earned the next chapter", "read": "Read it" }
  },

  "placement": {
    "offerTitle": "Where should we start?",
    "offerBody": "A few quick questions find your starting point. About five minutes.",
    "startNew": "I'm new to {{lang}}", "placeMe": "I know some {{lang}}",
    "skipItem": "Skip if unsure", "doneTitle": "Found your starting point",
    "doneBody": "Starting at {{unit}}.",
    "prelit": "You're starting with {{count}} items already known.",
    "redo": "Re-check my level"
  },
  "path": { "title": "Your path", "arc": "Arc {{name}}", "locked": "Ahead",
            "current": "You are here", "review": "Tap to review", "mastered": "Strong" },

  "streak": {
    "pactTitle": "Keep a streak?",
    "pactBody": "One card a day keeps it alive. Miss a day and a rest day may cover you — you earn one each week.",
    "pactAccept": "Count me in", "pactDecline": "No thanks",
    "days": "{{count}} days",
    "restDayEarned": "Rest day earned", "restDayUsed": "{{day}} was a rest day",
    "repairTitle": "Pick your streak back up",
    "repairBody": "Finish two sessions in the next {{days}} days to restore your {{count}}-day streak.",
    "repairCta": "Start"
  },

  "block": {
    "speakingIntro": "Speaking practice — {{count}} cards",
    "ready": "Ready", "loadingModel": "Warming up the microphone…",
    "micPrompt": "Corpán uses the microphone to score your speech on this device.",
    "sttUnavailable": "Speech scoring isn't available right now — switching to listening practice."
  },

  "quota": {
    "cardsLeft": "{{count}} cards left today",
    "plusBody": "Corpán Plus removes the daily card limit."
  },

  "welcomeBack": { "title": "Welcome back",
                   "body": "Your reviews kept {{pct}}% of their strength. Let's warm up." },
  "tease": { "next": "Next time: {{title}}" },

  "settings": {
    "title": "Journey options",
    "advanceMode": "Advancing", "advanceSwipe": "Swipe to continue", "advanceAuto": "Auto-continue",
    "celebration": "Celebrations", "celebrationFull": "Full", "celebrationReduced": "Reduced",
    "celebrationMinimal": "Minimal", "sounds": "Sounds",
    "listeningMode": "Hands-free listening", "viewPath": "View path", "redoPlacement": "Re-check my level"
  }
},
// existing namespaces:
"onboarding": { "whatToStart": { "journey": {
  "label": "Follow the Journey",
  "desc": "A guided course — the app picks each next step"
}}},
"experiences": { "journey_main": { "name": "Journey", "blurb": "Your guided path, one card at a time" } }
```

Count: ~110 keys. Not localized: engine-internal reason strings for `whyThisCard` are composed
from localized fragments + item text (the fragments above cover it). `dailyLock.*` copy already
exists and is reused with `unitLabel: "cards"` — add `"cards"` to whatever unit-label localization
table `DailyLockOverlay` consumes (verify at build; if unit labels are raw strings today, route
through `journey.quota` instead).

---

## 9. Visual direction

**Flashy-but-focused.** The card is a stage; chrome disappears.

- **Layout**: one card fills the safe-area viewport minus the 44 px chrome ribbon. Card content
  uses the same vertical optical-centering discipline as `MainExperience.tsx:542-581` (anchor ~20%
  when tall, optical center when short). Max content width 40rem on tablets/desktop; the card
  frame itself stays full-bleed.
- **Course color**: each target language gets one accent from a fixed palette (course pack
  manifest carries `accentColor`; fallback = app purple). Used for: particle bursts, progress
  ribbon fill, combo counter, PathViz current node, hero card gradient. Everything else stays on
  semantic tokens (`bg-background`, `text-foreground`, `border-border`) so **dark/light themes
  come free** — no hardcoded hex outside the course-color token, which must carry a
  dark-mode-adjusted variant (define as an HSL pair in CSS vars: `--journey-accent`,
  `--journey-accent-soft`).
- **Typography**: target-language text is the hero — `text-3xl/4xl` weight 600 with correct
  `lang`/`dir`; instructions are `text-sm text-muted-foreground`. Romanization italic muted,
  `dir="ltr"` always (matches MainExperience).
- **Motion**: all animation via framer-motion inside the existing global `MotionConfig`
  (`main.tsx:85` — 0.24 s, cubic-bezier(0.4,0,0.2,1), reduce-motion respected). Card transit =
  spring (stiffness ~320, damping ~32); settle = scale 1→0.98 + stamp. Canvas particles gate on
  `useReducedMotion()` explicitly (§1.5). No screen shake ever (webview jank + vestibular);
  “impact” is expressed with scale pulses ≤1.04 and color.
- **RTL correctness**: surface root sets `dir={dir()}` from settings (like HomeHub). Vertical feed
  axis never mirrors; horizontal elements do: chrome buttons swap corners (PhraseFlipChrome
  precedent), checkpoint button order, `rtl:rotate-180` on directional arrows (house pattern,
  `HomeHub.tsx:321`), AnswerTiles grid flows with `dir`. Mixed-direction cards (ar UI × en target)
  set `dir` per text block, never inherit.
- **Performance floor**: 3 mounted cards max; particle canvas is a single reused element;
  no backdrop-blur on Android (`glass()` helper already encodes this); target 60 fps on the
  low-end Android webview — any effect that can’t hold it gets cut, not throttled.

---

## 10. Build order + acceptance

Suggested implementation slices (each lands green through `npm run tsc` + `check:i18n`, with a
`corpan-app/CHANGELOG.md` `[Unreleased]` line per user-visible slice):

1. Store + shell: `store/journey.ts`, App.tsx sibling surface + `?journey=1` + LandingIntent +
   `corpan:journey-exit`, HomeHub registry entry + continue hero (feature-flagged devMode).
2. FeedScroller + FeedCard + ActivityCardHost with 3 renderers (`choice_pick`, `listen_pick`,
   `flip_recall`) against a fixture engine.
3. CelebrationLayer (tiers 0–2) + CheckpointCard + daily ring + streak v2 + pact.
4. Remaining renderers incl. speaking block; quota gate; DailyLock integration.
5. RareCard variants (delight, etymology, timeCapsule) + tier 3.
6. PlacementFlow + PathViz P0; onboarding option; razzle landing.
7. Pack anchor cards: PackLaunchEntry widening + `hostApi.journey.reportResult` + the three
   instrumented providers (contract workstream owns the seam; this surface consumes it).
8. i18n fan-out ×54 locales; RTL pass (ar, he, fa, ur, pa-Arab); dark/light pass.

Acceptance checks (the ones a reviewer can run):
`check:i18n` green; feed playable offline in airplane mode; abandon → engine receives
`abandoned: true`; pack round result round-trips and celebrates on return; DailyLock appears at
the (dev-lowered) cap and never for a subscriber; scroll-back never re-scores; reduce-motion
kills particles; `?journey=1` cold-start lands in the feed.

---

## 11. Ambiguities resolved here (flagged for review)

1. **Sibling surface over `activeGame` union** (§5.1) — forced by warm-mount-during-pack-launch;
   ARCHITECTURE left it open.
2. **`read-segment` dropped from the native renderer set** — D8 lists it, but segments live inside
   reader packs; v1 serves them via the earthgate provider (anchor/rare cards). A native renderer
   would need cross-pack file access that doesn’t exist.
3. **Picture-choice ships as `choice_pick` params variant**, emitted only when imagepan is
   installed (imagepan content is out of v1 per D11) — no dead renderer.
4. **Free-tier N placeholder = 60** with remote-config override — the actual N is the operator’s
   parked decision (D9).
5. **Streak default = pact opt-in** (in-surface consent card), preserving the app-wide opt-in
   stance — the opt-in-vs-pact question is parked for the operator; this is the reversible middle.
6. **`goalIntensity` → session-shape mapping** (§3.7) implemented with concrete numbers — parked
   decision, numbers are tunable constants in one place (`runtime.ts`).
7. **Onboarding placement offer lives in-surface, not as a graph node** — keeps onboarding short
   and gives late enrollers the identical flow.
8. **Abandoned native cards carry no per-item grades** — engine treats abandonment as a mixer
   signal, not memory evidence. Abandoned *pack sessions* keep their buffered partial `perItem`
   evidence (activity-contract §3.2 synthesis).

---

## Tracked risks (panel round 1)

Product-scope lens risks relevant to this surface, preserved verbatim per CTO-RESOLUTIONS R16.
Non-blocking: these inform build-time tests; none gate the build start.

1. Course-exhaustion and over-placement are unhandled: v0.1 ships ~30 units (arcMax A1) but
   placement Phase 1 probes up to b=+3 and the engine has no 'you are beyond this course /
   course complete' state — a B1 learner or a cruising daily-fast persona runs off the end of
   content in weeks with no specced feed behavior. Define an end-of-content card + graceful
   frontier cap before preview users hit it. *(See also R10: placement now terminates with
   outcome `above-content`; the end-of-content feed card remains open surface work.)*
2. Rare-card economy underdelivers in the launch window: storyChapter gates on measured 95%
   vocab coverage over real book segments (implausible for A1 learners against the current
   non-graded book catalog, and the coverage computation itself — tokenize segments vs
   FSRS-known items — is defined nowhere); timeCapsule needs weeks of history; miniGame is 1:25.
   Week-one 'wow' rests entirely on delight variants (1:8) and etymology gems (1:50). Tune
   early-session ratios (e.g. guaranteed gem in session 1–2) or the variable-reward economy
   reads as absent exactly when retention is decided.
3. A1 feed is text/audio-only at v1 (imagepan out per D11; picture-choice params-gated off) —
   the direct-method flash the North Star promises for beginners is missing at the level where
   it matters most. Consider a tiny bundled starter image set (~100 concrete A0 concepts) or an
   explicitly audio-first card design pass for Launchpad.
4. First-session flow front-loads friction: enroll → placement offer → up-to-25-probe test →
   streak pact → feed. The learner's first dopamine is an exam. Consider a 3-card
   guaranteed-win taste BEFORE the placement offer (warm-win opener exists but only
   post-placement).
5. Instrumented-provider Leitner retirement (lingo-hero) creates two scheduling brains for the
   same user across standalone vs journey launches of the same pack — accepted for v1, but
   expect confusing 'why is this word back' moments; the parked Leitner→FSRS importer will
   become user-visible debt.
6. check:i18n build gate: the ~110 journey UI keys ×54 locales are declared a build task —
   fine — but any drift in the key inventory during build slices 2–7 re-triggers 54-file
   fan-outs; freeze the key list at slice 1 or batch the fan-out to the end (slice 8 already
   suggests this; enforce it).
