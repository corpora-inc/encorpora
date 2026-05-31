/**
 * Tutomaton chrome localization.
 *
 * The UI text is localized into the user's NATIVE language — `stackConfig.languages[0]`
 * (the host passes the stack at mount; languages[0] is native, [1..] are learning).
 * `t(key, lang)` resolves the locale (collapsing variants: ko-polite→ko, pt-BR→pt,
 * zh-Hans→zh) and falls back to English per-key, so a missing/partial locale never
 * shows a blank — it shows clean English.
 *
 * The English block below is the source of truth. Other languages are generated
 * from it by `tools/gen_i18n.py` (which calls the repo's OpenAI translate tooling).
 * Generated locales are appended to LOCALES; English ships even if none exist yet.
 */

export type I18nKey =
  | "home"
  | "switchLanguage"
  | "chooseTutor"
  | "close"
  | "searchLanguages"
  | "languages"
  | "muteVoice"
  | "unmuteVoice"
  | "voiceReplies"
  | "newConversation"
  | "send"
  | "askAnything"
  | "setUpTutor"
  | "checkingDevice"
  | "needsInstall"        // "…runs a private AI tutor ({model}, ~{size} GB)…"
  | "downloadTutor"       // "Download tutor · {size} GB"
  | "downloadingTutor"
  | "wakingTutor"
  | "tryAgain"
  | "runsOnDevice"
  | "noLanguagesMatch"
  | "yourLanguages"
  | "allLanguagesSection"
  | "practice"           // "Practice {lang}"
  | "yourPrivateTutor"
  | "welcomeSub"
  | "allLanguages"
  | "browseLanguages"
  | "tapToHearHoldToCopy"
  | "releaseToCopy"
  | "copied"
  | "adding"             // "Adding {lang}"
  | "downloadingLessons"
  | "couldntLoad"        // "Couldn't load {lang}: {error}"
  | "couldntCopy"

type Dict = Record<I18nKey, string>

// ---- English source of truth ----
const en: Dict = {
  home: "Home",
  switchLanguage: "Switch language",
  chooseTutor: "Choose a tutor",
  close: "Close",
  searchLanguages: "Search languages…",
  languages: "Languages",
  muteVoice: "Mute voice replies",
  unmuteVoice: "Unmute voice replies",
  voiceReplies: "Voice replies",
  newConversation: "New conversation",
  send: "Send",
  askAnything: "Ask your tutor anything…",
  setUpTutor: "Set up your tutor",
  checkingDevice: "Checking your device…",
  needsInstall: "Tutomaton runs a private AI tutor ({model}, ~{size} GB) entirely on your device. Download it once — then learn anytime, even offline.",
  downloadTutor: "Download tutor · {size} GB",
  downloadingTutor: "Downloading your tutor…",
  wakingTutor: "Waking up your tutor…",
  tryAgain: "Try again",
  runsOnDevice: "Runs entirely on your device. No account, nothing sent to the cloud.",
  noLanguagesMatch: "No languages match your search.",
  yourLanguages: "Your languages",
  allLanguagesSection: "All languages",
  practice: "Practice {lang}",
  yourPrivateTutor: "Your private tutor",
  welcomeSub: "Ask anything — translations, grammar, vocab, or just chat. It all runs on your device.",
  allLanguages: "All languages",
  browseLanguages: "Browse languages",
  tapToHearHoldToCopy: "Tap to hear · hold to copy",
  releaseToCopy: "Release to copy",
  copied: "Copied",
  adding: "Adding {lang}",
  downloadingLessons: "Downloading lessons, vocabulary & grammar…",
  couldntLoad: "Couldn't load {lang}: {error}",
  couldntCopy: "Couldn't copy to the clipboard.",
}

// ---- Generated locales (filled by tools/gen_i18n.py). en is always present. ----
// GENERATED_LOCALES_START
const LOCALES: Record<string, Partial<Dict>> = {
  en,
}
// GENERATED_LOCALES_END

/** Collapse a stack/manifest code to its base translation locale. */
function baseLocale(lang: string): string {
  return (lang || "en").split("-")[0].toLowerCase()
}

/** Translate `key` into `lang` (native language), interpolating {name} params.
 *  Falls back to English per-key so nothing is ever blank. */
export function t(key: I18nKey, lang: string, params?: Record<string, string>): string {
  const loc = baseLocale(lang)
  const s = LOCALES[loc]?.[key] ?? LOCALES[lang]?.[key] ?? en[key]
  if (!params) return s
  return Object.entries(params).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, v), s)
}
