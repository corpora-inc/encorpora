/**
 * Centralized in-card UI strings for the micro-challenge library.
 *
 * The NPC *pretext* lines (the in-character framing in the ribbon) are localized
 * in `content/challenges/prompts.json`. These are the *instruction* strings that
 * render INSIDE the card body (prompts, sub-hints, affordances). Centralizing
 * them here keeps the games consistent and gives a future i18n pass a single
 * hook — every tool reads `S.<key>` instead of hardcoding English inline.
 *
 * To localize: swap `STRINGS` for a per-UI-language lookup keyed the same way,
 * falling back to `en` (mirrors the pretext loader in `registry.ts`). Until that
 * lands, the `en` block is the single source of truth, so no game string is
 * duplicated across tools.
 */

import { t, type I18nKey } from "../../i18n"

export interface ChallengeStrings {
  /* shared affordances */
  tapToContinue: string
  hearIt: string
  replay: string
  tapInOrder: string
  tapWordsInOrder: string

  /* grid family */
  memoryFind: string
  memoryStudy: string
  sortPrompt: string
  sortHint: (label: string) => string
  pictureMatchHint: string
  /** Fallback when no picturable nouns are available → plain word-match. */
  pictureMatchWordHint: (native: string) => string
  memorizeTitle: string
  memorizeSub: string
  ready: string
  whichMeant: (native: string) => string
  findHidden: string

  /* text family */
  unscramble: string
  meansHint: (native: string) => string
  buildOrder: string
  whichFits: string
  missingLine: string
  chooseReply: string
  whichTypo: string
  whichRhymes: (word: string) => string
  verbHint: (inf: string) => string

  /* choice family */
  whichTranslation: string
  tapMeaning: string
  whichHeard: string
  tapSpeakerReplay: string
  trueLabel: string
  falseLabel: string
  oddOneOut: string
  tapNumber: string

  /* stt family */
  readItAloud: string
  selfRateHint: string
  sayItBack: string
  listeningStop: string
  scoring: string
  heard: (transcript: string) => string
  rateTough: string
  rateOkay: string
  rateNailed: string
}

const en: ChallengeStrings = {
  tapToContinue: "Tap to continue",
  hearIt: "🔊 Hear it",
  replay: "Tap the speaker to replay",
  tapInOrder: "Tap the letters in order",
  tapWordsInOrder: "Tap the words in order",

  memoryFind: "Find the matching pairs",
  memoryStudy: "Not a match — tap anywhere to flip back",
  sortPrompt: "Sort each phrase into its basket",
  sortHint: (label) => `🧺 ${label}`,
  // NOUN-NEUTRAL ("the one"): the answer tiles are whole corpus phrases/sentences,
  // not single words, so "Tap the WORD that means «Trae el libro aquí.»" reads as a
  // lie. "the one" is true for a word, a phrase, or a sentence (#56).
  pictureMatchHint: "Tap the one for this picture",
  pictureMatchWordHint: (native) => `Tap the one that means “${native}”`,
  memorizeTitle: "Memorise these",
  memorizeSub: "study them, then tap Ready",
  ready: "I'm ready →",
  whichMeant: (native) => `Which line meant “${native}”?`,
  findHidden: "Find the hidden words",

  unscramble: "Unscramble the word",
  // The hinted `native` is the source PHRASE/sentence the target word came from
  // (e.g. "have you ever lost a card while travelling"), not a definition of the
  // single word — so "as in …" reads as context, where "means …" read as a (wrong)
  // definition.
  meansHint: (native) => `as in “${native}”`,
  buildOrder: "Put the words in order",
  whichFits: "Which word fills the gap?",
  missingLine: "What's the missing line?",
  chooseReply: "Choose the reply",
  whichTypo: "Which word is misspelled?",
  whichRhymes: (word) => `Which word rhymes with “${word}”?`,
  verbHint: (inf) => `verb: ${inf}`,

  whichTranslation: "Tap the meaning",
  tapMeaning: "Tap the one that means this",
  whichHeard: "🔊 Which one did you hear?",
  tapSpeakerReplay: "Tap the speaker to replay",
  trueLabel: "✓ True",
  falseLabel: "✗ False",
  oddOneOut: "Which one doesn't belong?",
  tapNumber: "🔊 Tap the number you heard",

  readItAloud: "Tap the mic and read it aloud",
  selfRateHint: "STT unavailable — tap to self-rate",
  sayItBack: "Now say it back",
  listeningStop: "Listening… tap to stop",
  scoring: "Scoring…",
  heard: (transcript) => `Heard: “${transcript || "—"}”`,
  rateTough: "Tough",
  rateOkay: "Okay",
  rateNailed: "Nailed it",
}

/**
 * Resolve the in-card string table for a UI language. The values now come from
 * the pack-wide i18n catalog (`src/i18n` `challenge.*` keys), localized into ~46
 * languages with a per-key English fallback (never blank). The shape stays the
 * `ChallengeStrings` interface so every `S.<key>` / `challengeStrings(lang).<key>`
 * call site is unchanged; only the SOURCE of the text moved from a hardcoded `en`
 * const to the catalog. The function-valued keys pass their param through `t`'s
 * `{token}` interpolation.
 *
 * `uiLang` is the Track's NATIVE for instructions; under immersion the caller
 * passes the TARGET (the immersion resolver's `uiLocale()`), so the card speaks
 * the target — consistent with the rest of the chrome.
 */
export function challengeStrings(uiLang?: string): ChallengeStrings {
  const lang = uiLang ?? "en"
  const tr = (key: I18nKey, params?: Record<string, string | number>): string =>
    t(key, lang, params)
  return {
    tapToContinue: tr("challenge.tapToContinue"),
    hearIt: tr("challenge.hearIt"),
    replay: tr("challenge.replay"),
    tapInOrder: tr("challenge.tapInOrder"),
    tapWordsInOrder: tr("challenge.tapWordsInOrder"),

    memoryFind: tr("challenge.memoryFind"),
    memoryStudy: tr("challenge.memoryStudy"),
    sortPrompt: tr("challenge.sortPrompt"),
    sortHint: (label) => tr("challenge.sortHint", { label }),
    pictureMatchHint: tr("challenge.pictureMatchHint"),
    pictureMatchWordHint: (native) => tr("challenge.pictureMatchWordHint", { native }),
    memorizeTitle: tr("challenge.memorizeTitle"),
    memorizeSub: tr("challenge.memorizeSub"),
    ready: tr("challenge.ready"),
    whichMeant: (native) => tr("challenge.whichMeant", { native }),
    findHidden: tr("challenge.findHidden"),

    unscramble: tr("challenge.unscramble"),
    meansHint: (native) => tr("challenge.meansHint", { native }),
    buildOrder: tr("challenge.buildOrder"),
    whichFits: tr("challenge.whichFits"),
    missingLine: tr("challenge.missingLine"),
    chooseReply: tr("challenge.chooseReply"),
    whichTypo: tr("challenge.whichTypo"),
    whichRhymes: (word) => tr("challenge.whichRhymes", { word }),
    verbHint: (inf) => tr("challenge.verbHint", { inf }),

    whichTranslation: tr("challenge.whichTranslation"),
    tapMeaning: tr("challenge.tapMeaning"),
    whichHeard: tr("challenge.whichHeard"),
    tapSpeakerReplay: tr("challenge.tapSpeakerReplay"),
    trueLabel: tr("challenge.trueLabel"),
    falseLabel: tr("challenge.falseLabel"),
    oddOneOut: tr("challenge.oddOneOut"),
    tapNumber: tr("challenge.tapNumber"),

    readItAloud: tr("challenge.readItAloud"),
    selfRateHint: tr("challenge.selfRateHint"),
    sayItBack: tr("challenge.sayItBack"),
    listeningStop: tr("challenge.listeningStop"),
    scoring: tr("challenge.scoring"),
    heard: (transcript) => tr("challenge.heard", { transcript: transcript || "—" }),
    rateTough: tr("challenge.rateTough"),
    rateOkay: tr("challenge.rateOkay"),
    rateNailed: tr("challenge.rateNailed"),
  }
}

/**
 * Convenience default table for tools with no UI-language in scope. This is the
 * ENGLISH table (the hardcoded `en` source above), used only as a last-ditch
 * fallback; tools should prefer `challengeStrings(spec.nativeLanguage ?? spec.language)`
 * so the card localizes. Kept as `en` (not `challengeStrings(undefined)`) so a
 * tool that hasn't been migrated still renders identical English.
 */
export const S: ChallengeStrings = en
