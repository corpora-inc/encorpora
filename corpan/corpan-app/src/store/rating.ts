// src/store/rating.ts

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const RATING_CRITERIA = {
    // First time we ever show the prompt
    MIN_UTTERANCES_BEFORE_FIRST_PROMPT: 20,
    // Utterances between prompts after "remind me later"
    UTTERANCES_BETWEEN_PROMPTS: 20,
    // Max times to honor "remind me later"
    MAX_REMIND_COUNT: 100,
} as const;

type RatingState = {
    // Usage tracking
    totalUtteranceCount: number;
    utterancesSinceLastPrompt: number;

    // Rating state
    hasRated: boolean;
    hasDismissed: boolean;
    remindMeLaterCount: number;

    // Actions
    incrementUtteranceCount: () => void;
    dismissPrompt: () => void;
    rateApp: () => void;
    remindLater: () => void;
    reset: () => void;
};

export const useRatingStore = create<RatingState>()(
    persist(
        (set, _get) => ({
            // Initial state
            totalUtteranceCount: 0,
            utterancesSinceLastPrompt: 0,
            hasRated: false,
            hasDismissed: false,
            remindMeLaterCount: 0,

            incrementUtteranceCount: () => {
                set((state) => ({
                    totalUtteranceCount: state.totalUtteranceCount + 1,
                    utterancesSinceLastPrompt:
                        state.utterancesSinceLastPrompt + 1,
                }));
                // // console.log("Utterance counted", get().totalUtteranceCount, get().utterancesSinceLastPrompt);
            },

            dismissPrompt: () => {
                set({ hasDismissed: true });
            },

            rateApp: () => {
                set({ hasRated: true });
            },

            remindLater: () => {
                set((state) => ({
                    remindMeLaterCount: state.remindMeLaterCount + 1,
                    // Reset the "since last prompt" counter so we wait for more usage
                    utterancesSinceLastPrompt: 0,
                }));
            },

            reset: () => {
                set({
                    totalUtteranceCount: 0,
                    utterancesSinceLastPrompt: 0,
                    hasRated: false,
                    hasDismissed: false,
                    remindMeLaterCount: 0,
                });
            },
        }),
        {
            name: "corpan-rating",
            version: 1,
            storage: createJSONStorage(() => localStorage),
        }
    )
);
