// src/store/history.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useSettingsStore } from "./settings";

/**
 * v0.7.0: Per-stack history (IDs only), no subscriptions/mirrors.
 * - Canonical state: byStack[stackId] = { ids, index }
 * - Components derive the active slice with activeStackId from settings.
 * - Mutators always write to the CURRENT active stack.
 */

export type EntryOut = { entry_id: number };

type StackHistory = {
    ids: number[];
    index: number;
};

type HistoryState = {
    byStack: Record<string, StackHistory>;

    setHistory: (ids: number[], index?: number) => void;
    pushEntry: (entryOrId: EntryOut | number) => void;
    setIndex: (index: number) => void;
    clear: () => void;
};

// ---- one-time migration from legacy single-history store ----

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

        const ids: number[] = legacyArr
            .map((e) => (e && typeof e.entry_id === "number" ? e.entry_id : null))
            .filter((n) => typeof n === "number") as number[];

        const settings = useSettingsStore.getState();
        const activeStackId =
            settings.activeStackId ||
            Object.keys(settings.stacks || {})[0] ||
            "default";

        return {
            [activeStackId]: {
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
            const initialByStack: Record<string, StackHistory> = imported ?? {};

            // Utility: operate on current active stack
            const withActive = <T,>(fn: (h: StackHistory, aId: string) => T): T | void => {
                const aId =
                    useSettingsStore.getState().activeStackId ||
                    Object.keys(useSettingsStore.getState().stacks || {})[0] ||
                    "default";

                const { byStack } = get();
                const curr = byStack[aId] ?? { ids: [], index: -1 };
                const result = fn(curr, aId);

                // If fn mutated, persist back
                if (curr !== byStack[aId]) {
                    // userland didn’t mutate ref; do nothing
                    return result;
                }
                // We mutate via copy in callers; they will set()
                return result;
            };

            return {
                byStack: initialByStack,

                setHistory: (ids, index = -1) => {
                    const aId =
                        useSettingsStore.getState().activeStackId ||
                        Object.keys(useSettingsStore.getState().stacks || {})[0] ||
                        "default";
                    const { byStack } = get();
                    const next: StackHistory = {
                        ids: [...ids],
                        index: Math.min(Math.max(index, -1), ids.length - 1),
                    };
                    set({ byStack: { ...byStack, [aId]: next } });
                },

                pushEntry: (entryOrId) => {
                    const aId =
                        useSettingsStore.getState().activeStackId ||
                        Object.keys(useSettingsStore.getState().stacks || {})[0] ||
                        "default";
                    const { byStack } = get();
                    const curr = byStack[aId] ?? { ids: [], index: -1 };

                    const id =
                        typeof entryOrId === "number"
                            ? entryOrId
                            : (entryOrId as EntryOut)?.entry_id;
                    if (typeof id !== "number") return;

                    const nextIds = [...curr.ids.slice(0, curr.index + 1), id];
                    const next: StackHistory = { ids: nextIds, index: nextIds.length - 1 };
                    set({ byStack: { ...byStack, [aId]: next } });
                },

                // src/store/history.ts
                // Only the setIndex function changed (and tiny comment). Replace that function.

                setIndex: (index) => {
                    const aId =
                        useSettingsStore.getState().activeStackId ||
                        Object.keys(useSettingsStore.getState().stacks || {})[0] ||
                        "default";
                    const { byStack } = get();
                    const curr = byStack[aId] ?? { ids: [], index: -1 };

                    const clamped = Math.min(Math.max(index, -1), curr.ids.length - 1);
                    // IMPORTANT: give ids a new reference even if unchanged, so selectors that pick the object re-render
                    const next: StackHistory = {
                        ids: [...curr.ids],
                        index: clamped,
                    };

                    set({ byStack: { ...byStack, [aId]: next } });
                },

                clear: () => {
                    const aId =
                        useSettingsStore.getState().activeStackId ||
                        Object.keys(useSettingsStore.getState().stacks || {})[0] ||
                        "default";
                    const { byStack } = get();
                    set({ byStack: { ...byStack, [aId]: { ids: [], index: -1 } } });
                },
            };
        },
        {
            name: "corpan-history-v2",
            version: 2,
            partialize: (state) => ({
                byStack: state.byStack, // only persist canonical data
            }),
        }
    )
);
