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
  pictureMatchHint: "Tap the word for this picture",
  pictureMatchWordHint: (native) => `Tap the word that means “${native}”`,
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

const STRINGS: Record<string, ChallengeStrings> = { en }

/**
 * Resolve the in-card string table for a UI language. Falls back to `en`.
 * (Single-arg today; takes the language so the call sites are already correct
 * when a localized table is added.)
 */
export function challengeStrings(_uiLang?: string): ChallengeStrings {
  const lang = _uiLang?.split("-")[0] ?? "en"
  return STRINGS[lang] ?? STRINGS.en
}

/** Convenience default table (en) for tools that have no UI-language in scope. */
export const S: ChallengeStrings = en
