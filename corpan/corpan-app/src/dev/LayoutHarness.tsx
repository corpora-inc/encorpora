// src/dev/LayoutHarness.tsx — DEV-ONLY visual layout harness for feed cards.
//
// Mounts the EXACT production ancestor chain of the journey feed —
// JourneySurface's structural shell (fixed inset-0 flex-col) → JourneyChrome →
// the `relative min-h-0 flex-1` feed slot → the REAL FeedScroller →
// FeedCardFrame → ActivityCardHost → exercise renderer — with a fake runtime
// serving one mock card, so card layout can be screenshotted / eyeballed at
// phone viewports without a course install.
//
// Usage (dev server only; tree-shaken from production via the
// import.meta.env.DEV guard in main.tsx):
//   http://localhost:1421/?layoutHarness=intro         intro_echo, text-tile debut (Frase nueva)
//   http://localhost:1421/?layoutHarness=introWord     intro_echo, word debut
//   http://localhost:1421/?layoutHarness=introPassive  intro_echo, passive show-and-tell
//   http://localhost:1421/?layoutHarness=choice        choice_pick (toTarget)
//   http://localhost:1421/?layoutHarness=flip          flip_recall
//
// NEVER routable in production: main.tsx only reads the query param when
// import.meta.env.DEV is true, and the dynamic import keeps this module out
// of the production bundle.

import { useMemo } from "react"
import type { ActivitySpec, ItemRef } from "../contentPacks/activityContract"
import type { DistractorSet } from "../journey/content/distractors.ts"
import type { ResolvedItem } from "../journey/content/resolve.ts"
import type { EngineCard } from "../journey/engine/index.ts"
import { FeedScroller } from "../journey/feed/FeedScroller.tsx"
import { JourneyChrome } from "../journey/JourneyChrome.tsx"
import type { JourneyRuntime } from "../journey/runtime.ts"
import type { FeedCard, SessionStats } from "../journey/types.ts"

// ------------------------------------------------------------- mock content

const phraseItem = (id: string, target: string, native: string): ResolvedItem => ({
  ref: { kind: "phrase", source: "base", id } as ItemRef,
  key: `phrase:base:${id}`,
  kind: "phrase",
  target: { text: target, ttsText: target },
  native: { text: native, ttsText: native },
  level: "A1",
})

const wordItem = (word: string, native: string): ResolvedItem => ({
  ref: { kind: "word", source: "es", id: word } as ItemRef,
  key: `word:es:${word}`,
  kind: "word",
  target: { text: word, ttsText: word },
  native: { text: native, ttsText: native },
})

const tokenDistractors = (texts: string[]): DistractorSet => ({
  distractors: texts.map((text, i) => ({ mode: "token", text, fromKey: `mock-${i}` })),
  shortfall: 0,
  eliminationOrder: texts.map((_, i) => i),
})

function exerciseCard(opts: {
  cardId: string
  activityType: string
  item: ResolvedItem
  distractors: DistractorSet | null
  params?: Record<string, unknown>
  unscored?: boolean
}): FeedCard {
  const spec: ActivitySpec = {
    specId: `harness-${opts.cardId}`,
    activityType: opts.activityType,
    itemRefs: [opts.item.ref],
    params: opts.params,
    level: "A1",
    targetLang: "es",
    nativeLang: "en",
  }
  const engine = {
    spec,
    meta: {
      pool: "new",
      strand: "input",
      form: 0,
      estSec: 20,
      provider: "native",
      celebration: "normal",
      unscored: opts.unscored ?? false,
      coolDownCandidate: false,
    },
  } as EngineCard
  return {
    kind: "exercise",
    cardId: opts.cardId,
    spec,
    prepared: {
      spec,
      engine,
      items: [opts.item],
      distractors: opts.distractors,
    },
  }
}

const CARDS: Record<string, FeedCard> = {
  // "Frase nueva" — the CTO's report: interactive text-tile debut of a phrase.
  intro: exerciseCard({
    cardId: "harness-intro",
    activityType: "intro_echo",
    item: phraseItem("1", "¿Dónde está la estación de tren?", "Where is the train station?"),
    distractors: tokenDistractors([
      "I would like a coffee, please",
      "See you tomorrow morning",
      "How much does it cost?",
    ]),
    unscored: true,
  }),
  // "Palabra nueva" — word debut, same text-tile mode.
  introWord: exerciseCard({
    cardId: "harness-intro-word",
    activityType: "intro_echo",
    item: wordItem("estación", "station"),
    distractors: tokenDistractors(["bridge", "ticket", "suitcase"]),
    unscored: true,
  }),
  // Passive show-and-tell degrade (no tappable meaning available).
  introPassive: exerciseCard({
    cardId: "harness-intro-passive",
    activityType: "intro_echo",
    item: phraseItem("2", "El tren sale a las nueve.", "The train leaves at nine."),
    distractors: null,
    unscored: true,
  }),
  // Sibling regression checks through the same frame/host chain:
  choice: exerciseCard({
    cardId: "harness-choice",
    activityType: "choice_pick",
    item: phraseItem("3", "¿Cuánto cuesta el billete?", "How much is the ticket?"),
    distractors: tokenDistractors([
      "El museo abre a las diez.",
      "Quisiera un café con leche.",
      "Hasta mañana por la tarde.",
    ]),
  }),
  flip: exerciseCard({
    cardId: "harness-flip",
    activityType: "flip_recall",
    item: phraseItem("4", "La maleta está en el andén.", "The suitcase is on the platform."),
    distractors: null,
  }),
}

// ------------------------------------------------------------- fake runtime

function fakeRuntime(card: FeedCard): JourneyRuntime {
  const stats: SessionStats = {
    newCount: 2,
    reviewCount: 5,
    bestCombo: 3,
    combo: 0,
    cardsCompleted: 4,
    startedAt: Date.now(),
  }
  const rt = {
    subscribe: () => () => {},
    current: () => card,
    next: () => null,
    prev: () => null,
    history: () => [],
    currentSettled: () => null,
    submitResult: () => null,
    advance: () => {},
    completePresentation: () => {},
    clearSettled: () => false,
    abandonCurrent: () => {},
    peekQuota: () => ({ remaining: 20, limit: 20 }),
    sessionStats: () => stats,
    noteImpression: () => {},
    checkpointChoice: () => {},
    packReturnPending: () => null,
    launchPackActivity: () => false,
    replayPackActivity: () => false,
    acceptJumpOffer: () => false,
    requestLegendary: () => false,
    requestUnitReview: () => false,
    endSession: async () => {},
  }
  return rt as unknown as JourneyRuntime
}

// --------------------------------------------------------------- component

export function LayoutHarness(props: { variant: string }) {
  const card = CARDS[props.variant] ?? CARDS.intro
  const runtime = useMemo(() => fakeRuntime(card), [card])
  const noop = () => {}
  return (
    // EXACT copy of JourneySurface's structural shell (root + chrome + feed
    // slot) so the harness sees the same height chain as production.
    <div
      className="fixed inset-0 z-[1050] flex flex-col bg-background"
      dir="ltr"
      data-testid="layout-harness"
    >
      <JourneyChrome
        courseKey="harness::journey_es"
        unitName="Travel basics"
        progressFrac={0.4}
        onHome={noop}
        onOpenPath={noop}
        onRedoPlacement={noop}
      />
      <div
        className="relative min-h-0 flex-1"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
      >
        <FeedScroller
          runtime={runtime}
          courseKey="harness::journey_es"
          speak={async () => {}}
          showRomanization
          dailyGoal={20}
          unitName="Travel basics"
          streakDays={3}
          onExit={noop}
        />
      </div>
    </div>
  )
}
