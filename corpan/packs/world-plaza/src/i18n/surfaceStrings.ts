/**
 * Per-surface string builders — the bridge between the flat i18n catalog
 * (`strings.ts`) and the typed `*Strings` shapes each chrome surface already
 * accepts (`MenuStrings`, `QuestTrackerStrings`, `QuestSectionStrings`,
 * `QuestInterludeStrings`).
 *
 * Each `make*Strings(native)` builds that surface's strings object resolved into
 * the learner's NATIVE locale, so the orchestrator (`game.ts`) wires it in one
 * line and the surface stays oblivious to the catalog. The English DEFAULT_*
 * objects inside each surface remain the offline fallback when no builder is
 * passed (e.g. a unit test mounting a surface bare).
 */

import { bindT } from "./strings"
import type { MenuStrings } from "../shell/menuPanel"
import type { QuestTrackerStrings } from "../quest/questTracker"
import type { QuestSectionStrings } from "../quest/questSection"
import type { QuestInterludeStrings } from "../vignettes/questInterlude"

/** Localized strings for the unified menu panel. */
export function makeMenuStrings(native: string): MenuStrings {
  const t = bindT(native)
  return {
    title: t("menu.title"),
    resume: t("menu.resume"),
    leave: t("menu.leave"),
    close: t("menu.close"),
    tabs: {
      map: t("menu.tab.map"),
      inventory: t("menu.tab.inventory"),
      quest: t("menu.tab.quest"),
      badges: t("menu.tab.badges"),
    },
    comingSoon: t("menu.comingSoon"),
  }
}

/** Localized strings for the status capsule / quest tracker. */
export function makeTrackerStrings(native: string): QuestTrackerStrings {
  const t = bindT(native)
  return {
    questLabel: t("tracker.questLabel"),
    findItem: (item) => t("tracker.findItem", { item }),
    deliverItem: (item, who) => t("tracker.deliverItem", { item, who }),
    talkTo: (who) => t("tracker.talkTo", { who }),
    beginChallenge: (who) => t("tracker.beginChallenge", { who }),
    progress: (done, total) => t("tracker.progress", { done, total }),
    complete: t("tracker.complete"),
    details: t("tracker.details"),
    collapse: t("tracker.collapse"),
    immersion: (level) => t("tracker.immersion", { level }),
    openQuest: t("tracker.openQuest"),
    openWallet: t("tracker.openWallet"),
    openBadges: t("tracker.openBadges"),
    location: t("tracker.location"),
  }
}

/** Localized strings for the in-menu quest detail section. */
export function makeSectionStrings(native: string): QuestSectionStrings {
  const t = bindT(native)
  return {
    objectiveHeading: t("section.objectiveHeading"),
    stepsHeading: t("section.stepsHeading"),
    findItem: (item) => t("section.findItem", { item }),
    deliverItem: (item, who) => t("section.deliverItem", { item, who }),
    talkTo: (who) => t("section.talkTo", { who }),
    progress: (done, total) => t("section.progress", { done, total }),
    complete: t("section.complete"),
  }
}

/** Localized strings for the quest-complete interlude. */
export function makeInterludeStrings(native: string): QuestInterludeStrings {
  const t = bindT(native)
  return {
    title: t("interlude.title"),
    subtitle: (q) => t("interlude.subtitle", { quest: q }),
    pickPrompt: t("interlude.pickPrompt"),
    goTo: (where) => t("interlude.goTo", { where }),
    begin: t("interlude.begin"),
    notNow: t("interlude.notNow"),
  }
}
