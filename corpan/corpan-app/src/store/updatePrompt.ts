import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { compareVersions } from "@/contentPacks/catalog"
import type { StorePlatform } from "@/lib/latestVersion"

export const UPDATE_PROMPT_CRITERIA = {
  // Minimum gap (ms) between consecutive prompt appearances after a
  // "remind me later" tap. Keeps things calm.
  REMIND_BACKOFF_MS: 3 * 24 * 60 * 60 * 1000,
  // Max times we honor "remind me later" before going quiet for this version.
  MAX_REMIND_COUNT: 5,
} as const

type UpdatePromptState = {
  // Latest known release for the user's platform, or null if unknown.
  latestVersion: string | null
  latestStoreUrl: string | null
  latestPlatform: StorePlatform | null
  lastCheckedAt: number | null

  // Current installed app version, mirrored here so selectors can read both
  // pieces synchronously when deciding whether to show the prompt.
  currentVersion: string | null

  // Per-version dismissal state. A new latestVersion resets the prompt.
  dismissedVersion: string | null
  remindMeLaterCount: number
  lastPromptShownAt: number | null

  setLatest: (input: {
    version: string
    storeUrl: string
    platform: StorePlatform
  }) => void
  setCurrentVersion: (version: string) => void
  dismissCurrent: () => void
  remindLater: () => void
  reset: () => void
}

export const useUpdatePromptStore = create<UpdatePromptState>()(
  persist(
    (set) => ({
      latestVersion: null,
      latestStoreUrl: null,
      latestPlatform: null,
      lastCheckedAt: null,
      currentVersion: null,
      dismissedVersion: null,
      remindMeLaterCount: 0,
      lastPromptShownAt: null,

      setLatest: ({ version, storeUrl, platform }) => {
        set((state) => {
          // If a strictly newer version arrived, clear per-version dismissal so
          // the user can be prompted again. Same or older version: leave state.
          const isNewer =
            !state.latestVersion ||
            compareVersions(version, state.latestVersion) > 0
          return {
            latestVersion: version,
            latestStoreUrl: storeUrl,
            latestPlatform: platform,
            lastCheckedAt: Date.now(),
            ...(isNewer
              ? { dismissedVersion: null, remindMeLaterCount: 0 }
              : {}),
          }
        })
      },

      setCurrentVersion: (version) => {
        set({ currentVersion: version })
      },

      dismissCurrent: () => {
        set((state) => ({
          dismissedVersion: state.latestVersion,
          lastPromptShownAt: Date.now(),
        }))
      },

      remindLater: () => {
        set((state) => ({
          remindMeLaterCount: state.remindMeLaterCount + 1,
          lastPromptShownAt: Date.now(),
        }))
      },

      reset: () => {
        set({
          latestVersion: null,
          latestStoreUrl: null,
          latestPlatform: null,
          lastCheckedAt: null,
          currentVersion: null,
          dismissedVersion: null,
          remindMeLaterCount: 0,
          lastPromptShownAt: null,
        })
      },
    }),
    {
      name: "corpan-update-prompt",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

// True when latest > current AND we haven't dismissed *this* version.
export function selectIsUpdateAvailable(
  state: UpdatePromptState,
): boolean {
  if (!state.latestVersion || !state.currentVersion) return false
  return compareVersions(state.latestVersion, state.currentVersion) > 0
}

export function selectShouldShowPrompt(state: UpdatePromptState): boolean {
  if (!selectIsUpdateAvailable(state)) return false
  if (state.dismissedVersion === state.latestVersion) return false
  if (state.remindMeLaterCount >= UPDATE_PROMPT_CRITERIA.MAX_REMIND_COUNT)
    return false
  if (
    state.lastPromptShownAt &&
    Date.now() - state.lastPromptShownAt <
      UPDATE_PROMPT_CRITERIA.REMIND_BACKOFF_MS
  ) {
    return false
  }
  return true
}
