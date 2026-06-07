import { useSettingsStore, ALL_LEVELS } from "@/store/settings"
import { useLandingStore } from "@/store/landing"
import { trackOnboardingCompleted } from "@/util/analytics"
import type { OnboardingGraph, NodeCtx } from "./types"

/** The phrase experience pack id (Phase 3). Until it exists as a pack, the
 *  landing consumer gracefully falls back to the in-app phrase experience. */
export const PHRASE_PACK_ID = "phrase_main"

/** Central reader/radio packs we want ready by the time the user lands. */
export const PRELOAD_READERS = ["earthgate_reader", "stargate_reader", "world_radio"]

export const ENTRY_NODE = "welcome"

const ALL = [...ALL_LEVELS]

/** Flush the accumulated draft to the stores and complete onboarding. */
function commitDraft(ctx: NodeCtx) {
  const d = ctx.draft
  const s = useSettingsStore.getState()
  if (d.levels) s.setLevels(d.levels)
  if (d.rate != null) s.setRate(d.rate)
  s.setUserProfile({
    userClass: d.userClass ?? "learner",
    goalIntensity: d.goalIntensity ?? "daily",
    ageBand: d.ageBand ?? "adult",
  })
  if (d.interests?.length) s.setInterests(d.interests)
  // Everyone lands in the gentle guided tour, which introduces the top-ranked
  // experiences and drops them into their first "Try it" (skippable → Home).
  // The per-journey `d.landing` is retained only as a fallback if the tour has
  // nothing to show (offline cold start).
  useLandingStore.getState().setLanding({ kind: "tour" })
  if (d.preloadPacks?.length) {
    // Best-effort background preload; a host listener (Home) kicks the batch.
    window.dispatchEvent(
      new CustomEvent("corpan:preload-packs", { detail: { ids: d.preloadPacks } })
    )
  }
  trackOnboardingCompleted()
  s.setOnboarded(true)
}

/**
 * The onboarding decision graph. Language-first (welcome → pickPrimary) so
 * every text-heavy node after the picker is localized. TTS + Plus pitch are
 * single shared nodes reached by every journey. Adding curricula / program
 * deals later = more nodes, no engine change.
 */
export const ONBOARDING_GRAPH: OnboardingGraph = {
  welcome: { kind: "adapter", id: "welcome", component: "welcome", next: "pickPrimary" },

  pickPrimary: { kind: "adapter", id: "pickPrimary", component: "pickPrimary", next: "welcomePact" },

  // Honest-hello interlude: set expectations + build a human connection in the
  // user's chosen language before the journey fork. (Compliant feedback plea,
  // not a review gate.)
  welcomePact: { kind: "adapter", id: "welcomePact", component: "welcomePact", next: "forkJourney" },

  forkJourney: {
    kind: "question",
    id: "forkJourney",
    titleKey: "onboarding.fork.title",
    subtitleKey: "onboarding.fork.subtitle",
    interpolate: (c) => ({ lang: c.primary() }),
    options: [
      {
        id: "enjoy",
        labelKey: "onboarding.fork.enjoy.label",
        descKey: "onboarding.fork.enjoy.desc",
        apply: (c) => c.patch({ journey: "enjoy", userClass: "enjoyer", goalIntensity: "casual" }),
        next: "calibrateEnjoy",
      },
      {
        id: "learn",
        labelKey: "onboarding.fork.learn.label",
        descKey: "onboarding.fork.learn.desc",
        apply: (c) => c.patch({ journey: "learn", userClass: "learner", goalIntensity: "daily" }),
        next: "pickLearning",
      },
      {
        id: "polyglot",
        labelKey: "onboarding.fork.polyglot.label",
        descKey: "onboarding.fork.polyglot.desc",
        apply: (c) =>
          c.patch({
            journey: "polyglot",
            userClass: "polyglot",
            goalIntensity: "intensive",
            levels: ALL,
            rate: 0.9,
            landing: { kind: "experience", packId: PHRASE_PACK_ID },
            preloadPacks: PRELOAD_READERS,
          }),
        next: "pickLearning",
      },
      {
        id: "child",
        labelKey: "onboarding.fork.child.label",
        descKey: "onboarding.fork.child.desc",
        apply: (c) => c.patch({ journey: "child", userClass: "kid_native", goalIntensity: "casual" }),
        next: "childAge",
      },
    ],
  },

  // ── Enjoy: single language, comfort calibration → readers/Library ──
  calibrateEnjoy: {
    kind: "question",
    id: "calibrateEnjoy",
    titleKey: "onboarding.calibrate.enjoyTitle",
    interpolate: (c) => ({ lang: c.primary() }),
    options: [
      {
        id: "native",
        labelKey: "onboarding.calibrate.enjoyNative",
        apply: (c) => c.patch({ levels: ALL, rate: 1.0, landing: { kind: "home", tab: "library" }, preloadPacks: PRELOAD_READERS }),
        next: "tts",
      },
      {
        id: "comfortable",
        labelKey: "onboarding.calibrate.enjoyComfortable",
        apply: (c) => c.patch({ levels: ["A1", "A2", "B1", "B2"], rate: 0.9, landing: { kind: "home", tab: "library" }, preloadPacks: PRELOAD_READERS }),
        next: "tts",
      },
      {
        id: "improving",
        labelKey: "onboarding.calibrate.enjoyImproving",
        apply: (c) => c.patch({ levels: ["A0", "A1", "A2", "B1"], rate: 0.8, landing: { kind: "home", tab: "library" }, preloadPacks: PRELOAD_READERS }),
        next: "tts",
      },
      {
        // Complete beginner / new to reading it (incl. an adult who speaks but
        // doesn't read yet, or a young child). Gentlest: A0 + slowest speech.
        id: "just_starting",
        labelKey: "onboarding.calibrate.enjoyJustStarting",
        apply: (c) => c.patch({ levels: ["A0"], rate: 0.5, landing: { kind: "home", tab: "library" }, preloadPacks: PRELOAD_READERS }),
        next: "tts",
      },
    ],
  },

  // ── Learn: primary + targets, experience calibration → phrase experience ──
  pickLearning: {
    kind: "adapter",
    id: "pickLearning",
    component: "pickLearning",
    next: (c) => (c.draft.journey === "polyglot" ? "tts" : "calibrateLearn"),
  },

  calibrateLearn: {
    kind: "question",
    id: "calibrateLearn",
    titleKey: "onboarding.calibrate.learnTitle",
    interpolate: (c) => ({ lang: targetLabel(c) }),
    options: [
      {
        id: "never",
        labelKey: "onboarding.calibrate.learnNever",
        apply: (c) => c.patch({ levels: ["A0"], rate: 0.6, landing: { kind: "experience", packId: PHRASE_PACK_ID } }),
        next: "pickPhrasePacks",
      },
      {
        id: "a_little",
        labelKey: "onboarding.calibrate.learnLittle",
        apply: (c) => c.patch({ levels: ["A0", "A1", "A2"], rate: 0.7, landing: { kind: "experience", packId: PHRASE_PACK_ID } }),
        next: "pickPhrasePacks",
      },
      {
        id: "advanced",
        labelKey: "onboarding.calibrate.learnAdvanced",
        apply: (c) => c.patch({ levels: ["A1", "A2", "B1", "B2"], rate: 0.9, landing: { kind: "experience", packId: PHRASE_PACK_ID } }),
        next: "pickPhrasePacks",
      },
    ],
  },

  pickPhrasePacks: { kind: "adapter", id: "pickPhrasePacks", component: "pickPhrasePacks", next: "tts" },

  // ── Child: age band → gentlest defaults → curated readers/Library ──
  childAge: {
    kind: "question",
    id: "childAge",
    titleKey: "onboarding.calibrate.childAgeTitle",
    options: [
      {
        id: "under_13",
        labelKey: "onboarding.calibrate.childUnder13",
        apply: (c) => c.patch({ ageBand: "under_13", levels: ["A0"], rate: 0.5, landing: { kind: "home", tab: "library" }, preloadPacks: PRELOAD_READERS }),
        next: "tts",
      },
      {
        id: "teen",
        labelKey: "onboarding.calibrate.childTeen",
        apply: (c) => c.patch({ ageBand: "teen", levels: ["A0", "A1"], rate: 0.6, landing: { kind: "home", tab: "library" }, preloadPacks: PRELOAD_READERS }),
        next: "tts",
      },
    ],
  },

  // ── Shared tail: voices → interests → engagement page → commit ──
  // (The Plus pitch is folded SOFTLY into the engagement page now — no
  //  standalone paywall interlude mid-onboarding.)
  tts: { kind: "adapter", id: "tts", component: "tts", next: "interests" },

  // "What do you want to do?" — a skippable multi-select that seeds the
  // experience recommendations. Reached by every journey (all roads hit tts).
  interests: {
    kind: "multiQuestion",
    id: "interests",
    titleKey: "onboarding.interests.title",
    subtitleKey: "onboarding.interests.subtitle",
    options: [
      { id: "read", labelKey: "onboarding.interests.read", descKey: "onboarding.interests.readDesc", icon: "BookOpen" },
      { id: "audio", labelKey: "onboarding.interests.audio", descKey: "onboarding.interests.audioDesc", icon: "Headphones" },
      { id: "games", labelKey: "onboarding.interests.games", descKey: "onboarding.interests.gamesDesc", icon: "Gamepad2" },
      { id: "speak", labelKey: "onboarding.interests.speak", descKey: "onboarding.interests.speakDesc", icon: "Mic" },
      { id: "study", labelKey: "onboarding.interests.study", descKey: "onboarding.interests.studyDesc", icon: "GraduationCap" },
      { id: "wild", labelKey: "onboarding.interests.wild", descKey: "onboarding.interests.wildDesc", icon: "Sparkles" },
    ],
    apply: (c, ids) => c.patch({ interests: ids }),
    next: "finish",
  },

  finish: { kind: "adapter", id: "finish", component: "finish", next: "commit" },
  commit: { kind: "terminal", id: "commit", commit: commitDraft },
}

/** A human label for the primary target language, for "{lang}" interpolation.
 *  Falls back to the generic word if no target is set yet. */
function targetLabel(c: NodeCtx): string {
  const targets = c.targets()
  return targets[0] ?? c.primary()
}
