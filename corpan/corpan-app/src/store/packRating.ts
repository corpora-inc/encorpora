// src/store/packRating.ts
//
// Lightweight, on-device per-experience ratings ("like" / "dismiss") collected
// from the Home "For you" cycle (and reusable elsewhere). Feeds the
// recommendation score so the cycle biases toward what the user likes and away
// from what they dismissed. Persisted; no identifiers, never sent anywhere.

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export type PackRating = "like" | "dismiss"

type PackRatingState = {
  ratings: Record<string, PackRating>
  rate: (id: string, rating: PackRating) => void
  clear: (id: string) => void
}

export const usePackRatingStore = create<PackRatingState>()(
  persist(
    (set) => ({
      ratings: {},
      rate: (id, rating) => set((s) => ({ ratings: { ...s.ratings, [id]: rating } })),
      clear: (id) =>
        set((s) => {
          const { [id]: _omit, ...rest } = s.ratings
          return { ratings: rest }
        }),
    }),
    {
      name: "corpan-pack-rating-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ ratings: s.ratings }),
    },
  ),
)

/** Map ratings → numeric signal for scoring (+1 liked, −1 dismissed). */
export function ratingSignals(ratings: Record<string, PackRating>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, r] of Object.entries(ratings)) out[id] = r === "like" ? 1 : -1
  return out
}
