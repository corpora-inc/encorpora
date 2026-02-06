import { useCallback, useRef } from "react"
import type { HostApi, EntryOut } from "../sdk/types"
import { tokenizeText, isCJKText } from "../utils/tokenizer"
import { useGameStore, type WordBlock } from "../store/gameState"

export type LoadedPhrase = {
  id: string
  targetText: string
  blockText: string
  targetLang: string
  blockLang: string
  correctWords: string[]
  blocks: WordBlock[]
}

const normalizeLang = (lang: string): string => lang.trim().toLowerCase()

const pickByLang = (
  translations: { language_code: string; text: string }[],
  lang: string
): string | undefined => {
  const desired = normalizeLang(lang)
  const exact = translations.find((t) => normalizeLang(t.language_code) === desired)
  if (exact) return exact.text

  const base = desired.split("-")[0]
  const baseMatch = translations.find(
    (t) => normalizeLang(t.language_code).split("-")[0] === base
  )
  if (baseMatch) return baseMatch.text

  return translations[0]?.text
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function usePhraseLoader(hostApi: HostApi) {
  const loadPhrase = useGameStore((s) => s.loadPhrase)
  const targetLangRotationRef = useRef(0)

  const load = useCallback(async (): Promise<LoadedPhrase | null> => {
    const stackConfig = hostApi.getStackConfig()
    const languages = stackConfig.languages

    // Target language (prompt) is always first/primary language (user's native language)
    const targetLang = languages[0] || "en"

    // Block language (words to arrange) rotates through languages being learned
    let blockLang: string
    if (languages.length > 1) {
      const learningLangs = languages.slice(1)
      blockLang = learningLangs[targetLangRotationRef.current % learningLangs.length]
      targetLangRotationRef.current++
    } else {
      blockLang = targetLang
    }

    const maxAttempts = 20
    let attempts = 0

    while (attempts < maxAttempts) {
      attempts++

      let entry: EntryOut | null = null

      try {
        if (hostApi.getRandomEntries) {
          const entries = await hostApi.getRandomEntries(1)
          if (entries && entries.length > 0) {
            entry = entries[0]
          }
        } else {
          entry = await hostApi.getRandomEntry()
        }
      } catch (error) {
        console.error("[juice-squeeze2] Error loading entry:", error)
        continue
      }

      if (!entry) continue

      const blockText = pickByLang(entry.translations, blockLang)
      const targetText = pickByLang(entry.translations, targetLang)

      if (!blockText || !targetText) continue

      const words = tokenizeText(blockText)

      // Need at least 2 words
      if (words.length < 2) continue

      // Skip if too short
      const isCJK = isCJKText(blockText)
      if (blockText.trim().length < 5 || (!isCJK && !blockText.includes(" "))) {
        continue
      }

      // Create shuffled blocks
      const blocks: WordBlock[] = shuffleArray(
        words.map((word, index) => ({
          id: `block-${index}-${Date.now()}`,
          word,
          originalIndex: index,
          zone: "choices" as const,
        }))
      )

      const phrase: LoadedPhrase = {
        id: `entry-${entry.entry_id}`,
        targetText,
        blockText,
        targetLang,
        blockLang,
        correctWords: words,
        blocks,
      }

      // Update store
      loadPhrase(
        {
          id: phrase.id,
          targetText: phrase.targetText,
          blockText: phrase.blockText,
          targetLang: phrase.targetLang,
          blockLang: phrase.blockLang,
          correctWords: phrase.correctWords,
        },
        phrase.blocks
      )

      return phrase
    }

    console.error("[juice-squeeze2] Failed to load phrase after", maxAttempts, "attempts")
    return null
  }, [hostApi, loadPhrase])

  return { load }
}
