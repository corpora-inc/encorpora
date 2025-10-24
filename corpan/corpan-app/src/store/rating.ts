// src/store/rating.ts

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type RatingState = {
    // Tracking
    firstUsedAt: number | null;
    sessionCount: number;
    totalTimeSpentMs: number;
    lastSessionStartedAt: number | null;
    
    // Rating state
    hasRated: boolean;
    hasDismissed: boolean;
    remindMeLaterCount: number;
    lastRemindMeLaterAt: number | null;
    
    // Actions
    trackSessionStart: () => void;
    trackSessionEnd: () => void;
    shouldShowPrompt: () => boolean;
    dismissPrompt: () => void;
    rateApp: () => void;
    remindLater: () => void;
    reset: () => void;
};

const CRITERIA = {
    MIN_SESSIONS: 5,           // Show after at least 5 sessions
    MIN_TIME_MS: 6 * 60 * 1000, // Show after 5 minutes total usage
    REMIND_DELAY_MS: 1 * 24 * 60 * 60 * 1000, // Remind after 1 day
    MAX_REMIND_COUNT: 3,       // Max times to show "remind me later"
};

export const useRatingStore = create<RatingState>()(
    persist(
        (set, get) => ({
            // Initial state
            firstUsedAt: null,
            sessionCount: 0,
            totalTimeSpentMs: 0,
            lastSessionStartedAt: null,
            hasRated: false,
            hasDismissed: false,
            remindMeLaterCount: 0,
            lastRemindMeLaterAt: null,

            trackSessionStart: () => {
                const now = Date.now();
                set((state) => ({
                    firstUsedAt: state.firstUsedAt ?? now,
                    sessionCount: state.sessionCount + 1,
                    lastSessionStartedAt: now,
                }));
            },

            trackSessionEnd: () => {
                const { lastSessionStartedAt } = get();
                if (lastSessionStartedAt) {
                    const sessionDuration = Date.now() - lastSessionStartedAt;
                    set((state) => ({
                        totalTimeSpentMs: state.totalTimeSpentMs + sessionDuration,
                        lastSessionStartedAt: null,
                    }));
                }
            },

            shouldShowPrompt: () => {
                const state = get();
                
                // Don't show if already rated or permanently dismissed
                if (state.hasRated || state.hasDismissed) {
                    return false;
                }

                // Check if user has postponed too many times
                if (state.remindMeLaterCount >= CRITERIA.MAX_REMIND_COUNT) {
                    return false;
                }

                // Check if enough time has passed since last "remind me later"
                if (state.lastRemindMeLaterAt) {
                    const timeSinceReminder = Date.now() - state.lastRemindMeLaterAt;
                    if (timeSinceReminder < CRITERIA.REMIND_DELAY_MS) {
                        return false;
                    }
                }

                // Check if criteria are met
                const hasEnoughSessions = state.sessionCount >= CRITERIA.MIN_SESSIONS;
                const hasEnoughTime = state.totalTimeSpentMs >= CRITERIA.MIN_TIME_MS;

                return hasEnoughSessions && hasEnoughTime;
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
                    lastRemindMeLaterAt: Date.now(),
                }));
            },

            reset: () => {
                set({
                    firstUsedAt: null,
                    sessionCount: 0,
                    totalTimeSpentMs: 0,
                    lastSessionStartedAt: null,
                    hasRated: false,
                    hasDismissed: false,
                    remindMeLaterCount: 0,
                    lastRemindMeLaterAt: null,
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
