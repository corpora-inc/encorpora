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
    return { promptLang: languages[0], answerLang: languages[0] }
  }
  const promptLang = pickRandom(languages) ?? languages[0]
  const remaining = languages.filter((lang) => lang !== promptLang)
  const answerLang = pickRandom(remaining) ?? promptLang
  return { promptLang, answerLang }
}
