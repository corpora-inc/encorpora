import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

/**
 * One-shot "landing intent" produced by the onboarding decision graph and
 * consumed exactly once by the post-onboarding shell (Home). It expresses
 * WHERE a finished journey should land the user.
 *
 * Persisted so a cold restart immediately after onboarding still honors it,
 * then cleared on consume. This is ephemeral routing intent — NOT user config
 * (that lives in the stack). Decoupled on purpose: the onboarding engine only
 * writes intent; the shell interprets it.
 */
export type LandingIntent =
  | { kind: "home"; tab?: "roll" | "library" | "recommended"; razzle?: boolean }
  | { kind: "experience"; packId: string; razzle?: boolean }
  | { kind: "discover" }
  | { kind: "tour" }
  /** Land directly in the Journey feed (onboarding journey opt-in, W10). */
  | { kind: "journey" }

/**
 * `razzle` (on `home`/`experience` intents) asks the post-onboarding shell to
 * play the ~5s "razzle-dazzle" collage transition before revealing the landing
 * — the celebratory hand-off that drops a brand-new user into their first
 * experience. Only set by the onboarding commit; normal Home→pack launches
 * never set it (they stay instant).
 */

type LandingState = {
  landing: LandingIntent | null
  setLanding: (l: LandingIntent) => void
  /** Return the pending intent and clear it (fires only once). */
  consumeLanding: () => LandingIntent | null
}

export const useLandingStore = create<LandingState>()(
  persist(
    (set, get) => ({
      landing: null,
      setLanding: (landing) => set({ landing }),
      consumeLanding: () => {
        const l = get().landing
        if (l) set({ landing: null })
        return l
      },
    }),
    {
      name: "corpan-landing-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ landing: s.landing }),
    }
  )
)
