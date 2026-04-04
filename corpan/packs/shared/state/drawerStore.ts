import { createStore } from "zustand/vanilla"
import type { LanguageInfo } from "../ui/commandDrawer"

export type DrawerScreen = "now-playing" | "library" | "browse" | "detail"

export type DrawerState = {
  currentLanguage: string
  currentNarrationId: string
  languages: LanguageInfo[]
  nowPlaying: { bookTitle: string; narrator?: string }
  activeScreen: DrawerScreen
}

// Migrate from old two-key format (one-time, on module load)
function readLegacy() {
  try {
    const lang = localStorage.getItem("drawerStore:currentLanguage") || ""
    const narrId = localStorage.getItem("drawerStore:currentNarrationId") || ""
    if (lang || narrId) {
      localStorage.removeItem("drawerStore:currentLanguage")
      localStorage.removeItem("drawerStore:currentNarrationId")
    }
    return { currentLanguage: lang, currentNarrationId: narrId }
  } catch {
    return { currentLanguage: "", currentNarrationId: "" }
  }
}
const legacy = readLegacy()

export const drawerStore = createStore<DrawerState>()(() => ({
  currentLanguage: legacy.currentLanguage,
  currentNarrationId: legacy.currentNarrationId,
  languages: [],
  nowPlaying: { bookTitle: "" },
  activeScreen: "now-playing",
}))
