import type { HostApi, HostVoiceInfo } from "../../corpan-city/src/npc/hostTypes"

// A conversation speaks in ONE language, but the host's plain speak() picks a
// default voice per utterance — so consecutive sentences can jump between voices.
// We resolve ONE stable voice per locale (pinned, remembered) and speak through
// the host's voice-pinned speakVoice(), so a conversation keeps a single voice
// the way Tutomaton's tutor does. Falls back to plain speak() when the host
// can't enumerate or pin voices.

const STORAGE_PREFIX = "teletron.voice"

function languageRank(voiceLanguage: string, want: string): number {
  const voice = voiceLanguage.toLowerCase()
  const target = want.toLowerCase()
  if (voice === target) return 2
  if (voice.split("-")[0] === target.split("-")[0]) return 1
  return 0
}

function sortVoices(voices: readonly HostVoiceInfo[], language: string): HostVoiceInfo[] {
  return [...voices].sort((a, b) => {
    const languageDifference = languageRank(b.language, language) - languageRank(a.language, language)
    if (languageDifference) return languageDifference
    return (a.name ?? a.id).localeCompare(b.name ?? b.id)
  })
}

function chooseVoice(
  voices: readonly HostVoiceInfo[],
  language: string,
  preferredId: string | null,
): HostVoiceInfo | null {
  const sorted = sortVoices(voices, language)
  return sorted.find((voice) => voice.id === preferredId) ?? sorted[0] ?? null
}

function loadVoiceId(language: string): string | null {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}.${language}`)
  } catch {
    return null
  }
}

function saveVoiceId(language: string, voiceId: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}.${language}`, voiceId)
  } catch {
    // The current session still stays pinned in memory when storage is unavailable.
  }
}

export type StableSpeaker = (locale: string, text: string) => Promise<void>

/**
 * Build a speak() that pins a stable voice per locale. The first utterance for a
 * locale enumerates the host voices once, picks (and remembers) one, and caches
 * it; every later utterance reuses it — so a conversation never changes voice
 * mid-stream. Degrades to plain host speak() when voice pinning is unavailable.
 */
export function createStableSpeaker(hostApi: HostApi): StableSpeaker {
  const resolved = new Map<string, HostVoiceInfo | null>()
  const loading = new Map<string, Promise<HostVoiceInfo | null>>()

  const localeKey = (locale: string): string => (locale || "").toLowerCase().split("-")[0] || locale

  async function ensureVoice(locale: string): Promise<HostVoiceInfo | null> {
    if (!hostApi.listVoices || !hostApi.speakVoice) return null
    const key = localeKey(locale)
    if (resolved.has(key)) return resolved.get(key) ?? null
    let pending = loading.get(key)
    if (!pending) {
      pending = hostApi
        .listVoices(locale)
        .then((voices) => {
          const choice = chooseVoice(voices ?? [], locale, loadVoiceId(key))
          resolved.set(key, choice)
          if (choice) saveVoiceId(key, choice.id)
          return choice
        })
        .catch((error) => {
          console.error("[teletron/voice] listVoices failed:", error)
          resolved.set(key, null)
          return null
        })
      loading.set(key, pending)
    }
    return pending
  }

  return async (locale, text) => {
    const voice = await ensureVoice(locale)
    if (voice && hostApi.speakVoice) {
      await hostApi.speakVoice(locale, text, voice.id)
      return
    }
    await hostApi.speak(locale, text)
  }
}
