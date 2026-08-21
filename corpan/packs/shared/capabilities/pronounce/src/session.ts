// Session ids + whisper language mapping — MOVED from
// packs/pronunciation-coach/src/game.ts (capability-modules.md §4.1).
import { toWhisperLang } from "./whisperLangs"

export const newSessionId = (): string => {
  try {
    const c = (globalThis as { crypto?: Crypto }).crypto
    if (c && typeof c.randomUUID === "function") {
      return c.randomUUID()
    }
  } catch (err) {
    console.error("[cap-pronounce] randomUUID failed:", err)
  }
  return `pc-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
}

// Corpán code → the whisper code that scores it (e.g. Javanese `jv` → `jw`,
// `pt-BR` → `pt`). Callers only reach this for languages already filtered to
// `isWhisperSupported`; the `"en"` fallback is a degenerate guard for an empty
// code and never scores a real unsupported language (those are gated upstream).
export const whisperLang = (lang: string): string => toWhisperLang(lang) ?? "en"
