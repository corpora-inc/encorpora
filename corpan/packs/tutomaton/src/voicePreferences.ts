import type { HostVoiceInfo } from "./languageManager"

const STORAGE_PREFIX = "tutomaton.voice"

const QUALITY_RANK: Record<NonNullable<HostVoiceInfo["quality"]>, number> = {
  premium: 7,
  very_high: 6,
  high: 5,
  enhanced: 4,
  normal: 3,
  default: 2,
  low: 1,
  very_low: 0,
}

function languageRank(language: string, want: string): number {
  const voice = language.toLowerCase()
  const target = want.toLowerCase()
  if (voice === target) return 2
  if (voice.split("-")[0] === target.split("-")[0]) return 1
  return 0
}

export function sortTutorVoices(
  voices: readonly HostVoiceInfo[],
  language: string
): HostVoiceInfo[] {
  return [...voices].sort((a, b) => {
    const languageDifference = languageRank(b.language, language) - languageRank(a.language, language)
    if (languageDifference) return languageDifference

    const offlineDifference = Number(!b.networkRequired) - Number(!a.networkRequired)
    if (offlineDifference) return offlineDifference

    const qualityDifference =
      (QUALITY_RANK[b.quality ?? "default"] ?? 2) - (QUALITY_RANK[a.quality ?? "default"] ?? 2)
    if (qualityDifference) return qualityDifference

    return (a.name ?? a.id).localeCompare(b.name ?? b.id)
  })
}

export function chooseTutorVoice(
  voices: readonly HostVoiceInfo[],
  language: string,
  preferredId: string | null
): HostVoiceInfo | null {
  const sorted = sortTutorVoices(voices, language)
  return sorted.find((voice) => voice.id === preferredId) ?? sorted[0] ?? null
}

export function loadTutorVoiceId(language: string): string | null {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}.${language}`)
  } catch {
    return null
  }
}

export function saveTutorVoiceId(language: string, voiceId: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}.${language}`, voiceId)
  } catch {
    // The current session still stays pinned when storage is unavailable.
  }
}
