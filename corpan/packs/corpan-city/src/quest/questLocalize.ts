/**
 * questLocalize — the ONE resolver every quest-bearing surface (Status Capsule,
 * Quest section, completion interlude, next-quest picker) calls to render quest
 * COPY in the learner's UI locale (NATIVE by default, TARGET under immersion).
 *
 * WHY THIS EXISTS. The quest JSONs are authored PAIR-AGNOSTIC + KEYED: a quest's
 * `title`/`narrative`/`step.label` literal is the English source-of-truth, and its
 * localized text lives in the `src/i18n/quests.ts` catalog under a key DERIVED from
 * the ids the JSON already carries (`quest.<id>.title`, `quest.<id>.step.<stepId>`,
 * …). Before this helper, the tracker/section/interlude rendered the raw English
 * `quest.title`/`step.label` — so the keyed catalog was never consulted and quest
 * copy never localized. This binds the catalog in ONE place, behind a tiny typed
 * interface, so the surfaces don't each re-derive keys.
 *
 * CONTRACT (the keyed-quest rule, LOCALIZATION.md §3): prefer the catalog key, fall
 * back to the authored LITERAL — never blank. So an un-keyed or not-yet-translated
 * quest still renders clean English (its JSON literal). `lang` is the UI locale the
 * caller already computes (the immersion resolver's `uiLocale()`).
 *
 * Pure + dependency-light: it reads only the contract `Quest`/`QuestStep` shapes and
 * the i18n catalog resolver. No DOM, no host, no storage.
 */

import type { Quest, QuestStep } from "@corpan-city/contracts"
import {
  questString,
  questTitleKey,
  questNarrativeKey,
  questStepKey,
} from "../i18n/quests"

/** The typed quest-copy localizer the surfaces consume. Each falls back to the literal. */
export interface QuestLocalizer {
  /** The quest's title in `lang` (or its authored literal). */
  title(quest: Quest): string
  /** The quest's one-line narrative in `lang` (or its authored literal). */
  narrative(quest: Quest): string
  /** A step's label in `lang` (or its authored literal / id). */
  stepLabel(quest: Quest, step: QuestStep): string
}

/**
 * Build a localizer bound to a single UI locale. Cheap to (re)build — the
 * orchestrator rebuilds it on an immersion flip so quest copy re-resolves into the
 * new locale with no teardown.
 *
 * `lang` empty/omitted ⇒ the English source-of-truth (the literals), which is the
 * safe default for tests + single-pair back-compat.
 */
export function makeQuestLocalizer(lang: string): QuestLocalizer {
  const L = lang || "en"
  return {
    title: (quest) => questString(questTitleKey(quest.id), L, quest.title),
    narrative: (quest) => questString(questNarrativeKey(quest.id), L, quest.narrative ?? ""),
    stepLabel: (quest, step) =>
      questString(questStepKey(quest.id, step.id), L, step.label || step.id),
  }
}

/**
 * The English-literal localizer (no catalog lookup) — the explicit identity used as
 * the default when a surface is mounted before a locale is known. Equivalent to
 * `makeQuestLocalizer("en")` when the catalog has no non-English entries, but states
 * the intent: render exactly what the JSON authored.
 */
export const literalQuestLocalizer: QuestLocalizer = {
  title: (quest) => quest.title,
  narrative: (quest) => quest.narrative ?? "",
  stepLabel: (_quest, step) => step.label || step.id,
}
