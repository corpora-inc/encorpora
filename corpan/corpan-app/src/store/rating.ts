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
    // Soft local backstop for the OS-native review prompt. The OS is the REAL
    // throttle (iOS shows it ~3×/year and never tells us whether it appeared),
    // but we add a generous client-side floor so a user who exits many packs in
    // a row doesn't make us hammer the (silently-ignored) native API every time.
    // Minimum engagement before we'll ask the OS the first time:
    MIN_UTTERANCES_BEFORE_NATIVE_REVIEW: 20,
    // Minimum wall-clock gap between native-review requests (30 days). Matches
    // the spirit of the iOS ~3×/year cap without ever blocking functionality.
    MIN_MS_BETWEEN_NATIVE_REVIEWS: 30 * 24 * 60 * 60 * 1000,
} as const;

type RatingState = {
    // Usage tracking
    totalUtteranceCount: number;
    utterancesSinceLastPrompt: number;

    // Rating state
    hasRated: boolean;
    hasDismissed: boolean;
    remindMeLaterCount: number;

    // Soft local backstop for the OS-native review prompt (the OS is the real
    // throttle). Unix ms of the last time we asked the OS, or 0 if never.
    lastNativeReviewRequestAt: number;

    // Actions
    incrementUtteranceCount: () => void;
    dismissPrompt: () => void;
    rateApp: () => void;
    remindLater: () => void;
    /**
     * Best-effort: ask the OS to show its native in-app review prompt, gated
     * ONLY by a soft local backstop (minimum engagement + a long cooldown).
     * The OS is the real throttle — it may show nothing and never tells us.
     * Fire-and-forget; never blocks, never throws, never gates functionality.
     */
    maybeRequestNativeReview: () => void;
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
            lastNativeReviewRequestAt: 0,

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

            maybeRequestNativeReview: () => {
                const state = _get();
                // Soft local backstop. These are NOT hard gates on any feature —
                // they just keep us from pinging the (silently-ignored) native
                // API on every single pack exit. The OS is the real throttle.
                if (
                    state.totalUtteranceCount <
                    RATING_CRITERIA.MIN_UTTERANCES_BEFORE_NATIVE_REVIEW
                ) {
                    return;
                }
                const now = Date.now();
                if (
                    state.lastNativeReviewRequestAt > 0 &&
                    now - state.lastNativeReviewRequestAt <
                        RATING_CRITERIA.MIN_MS_BETWEEN_NATIVE_REVIEWS
                ) {
                    return;
                }
                // Record the attempt BEFORE firing so an exit storm can't race
                // past the cooldown. The native call is fire-and-forget.
                set({ lastNativeReviewRequestAt: now });
                void import("@/contentPacks/purchase")
                    .then(({ requestNativeReview }) => requestNativeReview())
                    .catch((err) => {
                        // Never surface — the prompt is always best-effort.
                        console.debug("[rating] native review request failed:", err);
                    });
            },

            reset: () => {
                set({
                    totalUtteranceCount: 0,
                    utterancesSinceLastPrompt: 0,
                    hasRated: false,
                    hasDismissed: false,
                    remindMeLaterCount: 0,
                    lastNativeReviewRequestAt: 0,
                });
            },
        }),
        {
            name: "corpan-rating",
            // v2 adds lastNativeReviewRequestAt (the OS-native review backstop).
            // The shallow merge keeps the initializer's `0` default for old
            // persisted state, so no explicit migrate is required.
            version: 2,
            storage: createJSONStorage(() => localStorage),
        }
    )
);
