import { createStore } from "zustand/vanilla"
import { persist, createJSONStorage } from "zustand/middleware"
import type { SettingsState } from "./types"

export const settingsStore = createStore<SettingsState>()(
  persist(
    (): SettingsState => ({
      sfxEnabled: true,
      musicEnabled: true,
      highScore: 0,
      totalGamesPlayed: 0,
      totalAdsBlasted: 0,
    }),
    {
      name: "ad-blaster-settings",
      storage: createJSONStorage(() => localStorage),
    }
  )
)
