// src/store/recentNative.ts
//
// Last-launch timestamps for the built-in NATIVE experiences (Phrase Flip),
// which aren't entries in the games store and so can't carry `lastLaunchedAt`
// there. Home synthesizes a Recent tile from this so Phrase Flip shows in the
// "Recent" row just like installed packs do.

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

type RecentNativeState = {
  /** When Phrase Flip was last opened (ms epoch); undefined until first launch. */
  phraseLastLaunchedAt?: number
  /** Stamp Phrase Flip as just-launched. */
  touchPhrase: () => void
}

export const useRecentNativeStore = create<RecentNativeState>()(
  persist(
    (set) => ({
      phraseLastLaunchedAt: undefined,
      touchPhrase: () => set({ phraseLastLaunchedAt: Date.now() }),
    }),
    {
      name: "corpan-recent-native-v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
