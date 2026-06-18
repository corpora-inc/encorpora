// src/store/rating.ts

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type RatingState = {
    // Whether the rating card is currently open. Manual-only: the card never
    // auto-opens — it is shown solely via promptManualReview() (the
    // Settings → About "Rate Corpán" button).
    isOpen: boolean;

    // Whether the user has ever rated (kept for analytics / debug visibility).
    hasRated: boolean;

    // Actions
    /**
     * Open the rating card UNCONDITIONALLY, bypassing any eligibility, cooldown,
     * or once-only guards. Backs the Settings → About "Rate Corpán" button.
     */
    promptManualReview: () => void;
    /** Close the rating card. */
    dismissPrompt: () => void;
    /** Record that the user chose to rate. */
    rateApp: () => void;
    reset: () => void;
};

export const useRatingStore = create<RatingState>()(
    persist(
        (set) => ({
            // Initial state
            isOpen: false,
            hasRated: false,

            promptManualReview: () => {
                set({ isOpen: true });
            },

            dismissPrompt: () => {
                set({ isOpen: false });
            },

            rateApp: () => {
                set({ hasRated: true, isOpen: false });
            },

            reset: () => {
                set({ isOpen: false, hasRated: false });
            },
        }),
        {
            name: "corpan-rating",
            // v3 retires the automatic-prompt machinery (utterance counters,
            // remind-later cooldowns, native-review backstop). Rating is now
            // manual-only. `isOpen` is intentionally NOT persisted so the card
            // never re-opens on launch — only an explicit user tap opens it.
            version: 3,
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ hasRated: state.hasRated }),
        }
    )
);
