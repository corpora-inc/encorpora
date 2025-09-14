// src/store/history.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useSettingsStore } from "./settings";

/**
 * v0.7.0: Per-stack history (IDs only)
 * - Public API remains the same names, but history is now number[] (entry_ids).
 * - Internally keyed by activeStackId from settings.
 * - One-time migration: imports legacy `corpan-history` (EntryOut[]) into Default stack as ids[].
 */

// Keep a minimal shape so existing imports of EntryOut don't explode.
// In v0.7.x we only care about entry_id.
export type EntryOut = { entry_id: number };

type StackHistory = {
    ids: number[];
    index: number;
};

type HistoryState = {
    // Internal: histories for each stack
    byStack: Record<string, StackHistory>;

    // Derived for the ACTIVE stack
    history: number[];
    index: number;

    // API (same method names as before)
    setHistory: (ids: number[], index?: number) => void;
    pushEntry: (entry: EntryOut | number) => void;
    setIndex: (index: number) => void;
    clear: () => void;
};

// ---- migration from legacy single-history store ----

function importLegacyHistory(): Record<string, StackHistory> | null {
    try {
        const raw = localStorage.getItem("corpan-history");
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        const legacyState = parsed?.state ?? parsed;

        const legacyArr: any[] = Array.isArray(legacyState?.history) ? legacyState.history : [];
        const legacyIndex: number =
            typeof legacyState?.index === "number" && isFinite(legacyState.index)
                ? legacyState.index
                : -1;

        // Convert EntryOut[] -> number[]
        const ids: number[] = legacyArr
            .map((e) => (e && typeof e.entry_id === "number" ? e.entry_id : null))
            .filter((n) => typeof n === "number") as number[];

        const stackId = useSettingsStore.getState().getActiveStackId?.() ||
            useSettingsStore.getState().activeStackId ||
            Object.keys(useSettingsStore.getState().stacks || {})[0] ||
            "default";

        return {
            [stackId]: {
                ids,
                index: Math.min(Math.max(legacyIndex, -1), ids.length - 1),
            },
        };
    } catch {
        return null;
    }
}

export const useHistoryStore = create<HistoryState>()(
    persist(
        (set, get) => {
            const imported = importLegacyHistory();
            const initial: Record<string, StackHistory> = imported ?? {};

            const readActive = (): StackHistory => {
                const activeId =
                    useSettingsStore.getState().getActiveStackId?.() ||
                    useSettingsStore.getState().activeStackId;
                const { byStack } = get();
                const h = byStack[activeId];
                if (h) return h;

                // self-heal initialize empty history for this stack
                const empty: StackHistory = { ids: [], index: -1 };
                set({ byStack: { ...byStack, [activeId]: empty } });
                return empty;
            };

            const writeActive = (mutate: (h: StackHistory) => void) => {
                const activeId =
                    useSettingsStore.getState().getActiveStackId?.() ||
                    useSettingsStore.getState().activeStackId;
                const { byStack } = get();
                const current = byStack[activeId] ?? { ids: [], index: -1 };
                const copy: StackHistory = { ids: [...current.ids], index: current.index };
                mutate(copy);
                set({ byStack: { ...byStack, [activeId]: copy } });
            };

            return {
                byStack: initial,

                // Derived getters reflect the active stack
                get history() {
                    return readActive().ids;
                },
                get index() {
                    return readActive().index;
                },

                setHistory: (ids, index = -1) =>
                    writeActive((h) => {
                        h.ids = [...ids];
                        h.index = Math.min(Math.max(index, -1), h.ids.length - 1);
                    }),

                pushEntry: (entryOrId) =>
                    writeActive((h) => {
                        const id =
                            typeof entryOrId === "number"
                                ? entryOrId
                                : (entryOrId as EntryOut)?.entry_id;

                        if (typeof id !== "number") return;

                        // standard forward-history semantics
                        const next = [...h.ids.slice(0, h.index + 1), id];
                        h.ids = next;
                        h.index = next.length - 1;
                    }),

                setIndex: (index) =>
                    writeActive((h) => {
                        h.index = Math.min(Math.max(index, -1), h.ids.length - 1);
                    }),

                clear: () =>
                    writeActive((h) => {
                        h.ids = [];
                        h.index = -1;
                    }),
            };
        },
        {
            name: "corpan-history-v2",
            version: 2,
        }
    )
);
