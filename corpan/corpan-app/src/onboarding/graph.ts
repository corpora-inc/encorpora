import { useSettingsStore, ALL_LEVELS } from "@/store/settings"
import { useLandingStore } from "@/store/landing"
import { useGamesStore } from "@/store/games"
import { useCatalogStore } from "@/store/catalog"
import { trackOnboardingCompleted, trackOnboardingLaunch } from "@/util/analytics"
import { bestFitExperience } from "./bestFit"
import { resolveLanding, WHAT_TO_START_INTEREST, type WhatToStart } from "./resolveLanding"
import type { OnboardingGraph, NodeCtx } from "./types"

/** The phrase experience pack id (Phase 3). Until it exists as a pack, the
 *  landing consumer gracefully falls back to the in-app phrase experience. */
export const PHRASE_PACK_ID = "phrase_main"

/** Central reader/radio packs we want ready by the time the user lands. */
export const PRELOAD_READERS = ["earthgate_reader", "stargate_reader", "world_radio"]

export const ENTRY_NODE = "welcome"

const ALL = [...ALL_LEVELS]

/**
 * When the user picks their final answer, start downloading the pack we'll land
 * them in — so it's ready (or close) by the time they finish the last screen +
 * watch the razzle transition. Best-effort; the App listens for this event and
 * installs quietly. No-op for native/Library landings (nothing to install).
 */
function preinstallForChoice(choice: WhatToStart) {
  try {
    const res = resolveLanding({
      choice,
      languages: useSettingsStore.getState().languages,
      catalogIds: useCatalogStore.getState().getCatalog().map((g) => g.id),
      installedIds: Object.keys(useGamesStore.getState().games),
    })
    if (res.installPackId && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("corpan:preinstall-pack", { detail: { packId: res.installPackId } }),
      )
    }
  } catch {
    /* best-effort preinstall — the landing re-checks + re-kicks install anyway */
  }
}

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
  // The single-choice final question seeds Home's "For you" recs too, so a user
  // who skipped the multi-select still gets sensible recommendations.
  const seededInterest = d.whatToStart ? WHAT_TO_START_INTEREST[d.whatToStart] : null
  const interests =
    d.interests?.length
      ? d.interests
      : seededInterest
        ? [seededInterest]
        : []
  if (interests.length) s.setInterests(interests)

  // ── The "aha moment": drop the user STRAIGHT into a chosen experience and
  // play the razzle-dazzle collage transition on the way in. The final question
  // (whatToStart) makes a DETERMINISTIC landing call (resolveLanding); if it was
  // somehow not answered we fall back to Home's best-fit ranking. Power users
  // who hit "Explore on my own" set `skipAutoLaunch` → gentle guided tour.
  if (d.skipAutoLaunch) {
    useLandingStore.getState().setLanding({ kind: "tour" })
    trackOnboardingLaunch("home")
  } else if (d.whatToStart) {
    const res = resolveLanding({
      choice: d.whatToStart as WhatToStart,
      languages: useSettingsStore.getState().languages,
      catalogIds: useCatalogStore.getState().getCatalog().map((g) => g.id),
      installedIds: Object.keys(useGamesStore.getState().games),
    })
    useLandingStore.getState().setLanding(res.intent)
    trackOnboardingLaunch(res.chosenId)
  } else {
    // Defensive fallback (final question not answered): the old best-fit path,
    // now also razzled for a consistent first landing.
    const fit = bestFitExperience({
      userClass: d.userClass ?? "learner",
      interests,
      level: d.levels,
      languages: useSettingsStore.getState().languages,
      installedIds: Object.keys(useGamesStore.getState().games),
    })
    if (fit?.kind === "phrase") {
      useLandingStore.getState().setLanding({ kind: "experience", packId: PHRASE_PACK_ID, razzle: true })
      trackOnboardingLaunch(PHRASE_PACK_ID)
    } else if (fit?.kind === "pack") {
      useLandingStore.getState().setLanding({ kind: "experience", packId: fit.packId, razzle: true })
      trackOnboardingLaunch(fit.packId)
    } else {
      useLandingStore.getState().setLanding({ kind: "tour" })
      trackOnboardingLaunch("home")
    }
  }
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

  // ── Shared tail: voices → interests → final question → commit ──
  // (The Plus pitch lives at real engagement moments — reader EOF, Settings —
  //  not as an onboarding interlude.)
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
    next: "whatToStart",
  },

  // The DETERMINISTIC final question — one tap tells us exactly where to drop
  // the user. Interests (above) still power the broader Home "For you" list;
  // this makes the single landing call (see resolveLanding). Immediate-advance.
  whatToStart: {
    kind: "question",
    id: "whatToStart",
    titleKey: "onboarding.whatToStart.title",
    subtitleKey: "onboarding.whatToStart.subtitle",
    options: [
      {
        id: "read",
        labelKey: "onboarding.whatToStart.read.label",
        descKey: "onboarding.whatToStart.read.desc",
        apply: (c) => { c.patch({ whatToStart: "read" }); preinstallForChoice("read") },
        next: "commit",
      },
      {
        id: "study",
        labelKey: "onboarding.whatToStart.study.label",
        descKey: "onboarding.whatToStart.study.desc",
        apply: (c) => { c.patch({ whatToStart: "study" }); preinstallForChoice("study") },
        next: "commit",
      },
      {
        id: "playMusic",
        labelKey: "onboarding.whatToStart.playMusic.label",
        descKey: "onboarding.whatToStart.playMusic.desc",
        apply: (c) => { c.patch({ whatToStart: "playMusic" }); preinstallForChoice("playMusic") },
        next: "commit",
      },
      {
        id: "playGames",
        labelKey: "onboarding.whatToStart.playGames.label",
        descKey: "onboarding.whatToStart.playGames.desc",
        apply: (c) => { c.patch({ whatToStart: "playGames" }); preinstallForChoice("playGames") },
        next: "commit",
      },
      {
        id: "surprise",
        labelKey: "onboarding.whatToStart.surprise.label",
        descKey: "onboarding.whatToStart.surprise.desc",
        apply: (c) => { c.patch({ whatToStart: "surprise" }); preinstallForChoice("surprise") },
        next: "commit",
      },
    ],
  },

  // The final question commits DIRECTLY — no engagement/socials interlude. Its
  // channels + Share moved to the bottom of Settings, so onboarding drops the
  // user straight into the chosen experience (with the razzle transition).
  commit: { kind: "terminal", id: "commit", commit: commitDraft },
}

/** A human label for the primary target language, for "{lang}" interpolation.
 *  Falls back to the generic word if no target is set yet. */
function targetLabel(c: NodeCtx): string {
  const targets = c.targets()
  return targets[0] ?? c.primary()
}
