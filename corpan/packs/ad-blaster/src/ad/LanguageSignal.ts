let currentLang = "en"

export const setLanguageSignals = (langCode: string) => {
  currentLang = langCode
  document.documentElement.lang = langCode

  try {
    Object.defineProperty(navigator, "language", {
      get: () => currentLang,
      configurable: true,
    })
  } catch {
    // Some environments don't allow this
  }

  try {
    Object.defineProperty(navigator, "languages", {
      get: () => [currentLang, "en"],
      configurable: true,
    })
  } catch {
    // Some environments don't allow this
  }
}

/**
 * Creates a rotator that cycles through a list of languages,
 * updating document.lang and navigator.language each call.
 */
export const createLanguageRotator = (langs: string[]) => {
  const pool = langs.length > 0 ? langs : ["en"]
  let index = 0

  return {
    /** Advance to the next language and update browser signals. */
    rotate: () => {
      const lang = pool[index % pool.length]
      index++
      currentLang = lang
      document.documentElement.lang = lang
    },

    /** Current active language. */
    current: () => currentLang,
  }
}
