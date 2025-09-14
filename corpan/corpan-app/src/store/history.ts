// src/store/history.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useSettingsStore } from "./settings";

/**
 * v0.7.0: Per-stack history (IDs only).
 * byStack[stackId] = { ids, index }
 */

type StackHistory = {
    ids: number[];
    index: number;
};

type HistoryState = {
    byStack: Record<string, StackHistory>;

    setHistory: (ids: number[], index?: number) => void;
    pushEntry: (entryId: number) => void;
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
            settings.activeStackId || Object.keys(settings.stacks || {})[0] || "default";

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
        (set, get, _api) => {
            const imported = importLegacyHistory();
            const initialByStack: Record<string, StackHistory> = imported ?? {};

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

                // Always append to the end and jump to tail (no truncation).
                pushEntry: (entryId: number) => {
                    const aId =
                        useSettingsStore.getState().activeStackId ||
                        Object.keys(useSettingsStore.getState().stacks || {})[0] ||
                        "default";

                    set((state) => {
                        const curr = state.byStack[aId] ?? { ids: [], index: -1 };
                        const ids = [...curr.ids, entryId];
                        return {
                            byStack: {
                                ...state.byStack,
                                [aId]: { ids, index: ids.length - 1 },
                            },
                        };
                    });
                },

                // Only move the pointer (do not change ids). Clone ids to keep referential updates tidy.
                setIndex: (index) => {
                    const aId =
                        useSettingsStore.getState().activeStackId ||
                        Object.keys(useSettingsStore.getState().stacks || {})[0] ||
                        "default";
                    const { byStack } = get();
                    const curr = byStack[aId] ?? { ids: [], index: -1 };

                    const clamped = Math.min(Math.max(index, -1), curr.ids.length - 1);
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
            // No partialize: persist will ignore functions; we keep it simple & type-safe.
        }
    )
);
