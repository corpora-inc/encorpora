import { normalizeLang, pickRandom } from "../core/utils"
import type { EntryLookup } from "../core/types"
import type { StackConfig, TranslationOut } from "../sdk/types"

export const buildEntryLookup = (translations: TranslationOut[]): EntryLookup => {
  const textByCode: Record<string, string> = {}
  const romByCode: Record<string, string> = {}
  translations.forEach((translation) => {
    const code = normalizeLang(translation.language_code)
    if (!textByCode[code]) {
      textByCode[code] = translation.text
    }
    if (translation.romanization && !romByCode[code]) {
      romByCode[code] = translation.romanization
    }
  })
  return { textByCode, romByCode }
}

export const pickLanguages = (stack: StackConfig | null) => {
  const languages = stack?.languages?.length ? stack.languages : ["en"]
  if (languages.length === 1) {
    // Single-language stack (immersion, monolingual readers, kids learning
    // their own language). There is no second language to translate into, so
    // a phrase-to-translation match would be phrase-to-itself — degenerate.
    // Instead we run a LISTENING-MATCH round: prompt and answer are the same
    // language, the prompt text is never shown (only spoken), and the gates
    // carry the correct written phrase among same-language distractors. The
    // `singleLanguage` flag tells the round builder / HUD to hide the prompt
    // text so the player must match by ear (or sight-read recognition).
    return { promptLang: languages[0], answerLang: languages[0], singleLanguage: true }
  }
  const promptLang = pickRandom(languages) ?? languages[0]
  const remaining = languages.filter((lang) => lang !== promptLang)
  const answerLang = pickRandom(remaining) ?? promptLang
  return { promptLang, answerLang, singleLanguage: false }
}
