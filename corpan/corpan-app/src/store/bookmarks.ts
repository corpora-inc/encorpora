import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EntryOut } from "./history";
import { useSettingsStore } from "./settings";

type BookmarkState = {
    byStack: Record<string, EntryOut[]>;
    addBookmark: (entry: EntryOut) => void;
    removeBookmark: (entryId: number) => void;
    isBookmarked: (entryId: number) => boolean;
    clear: () => void;
};

export const useBookmarkStore = create<BookmarkState>()(
    persist(
        (set, get) => ({
            byStack: {},
            addBookmark: (entry) => {
                const aId =
                    useSettingsStore.getState().activeStackId ||
                    Object.keys(useSettingsStore.getState().stacks || {})[0] ||
                    "default";
                set((state) => {
                    const curr = state.byStack[aId] ?? [];
                    const exists = curr.find(b => b.entry_id === entry.entry_id);
                    if (!exists) {
                        return { byStack: { ...state.byStack, [aId]: [...curr, entry] } };
                    }
                    return state;
                });
            },
            removeBookmark: (entryId) => {
                const aId =
                    useSettingsStore.getState().activeStackId ||
                    Object.keys(useSettingsStore.getState().stacks || {})[0] ||
                    "default";
                set((state) => {
                    const curr = state.byStack[aId] ?? [];
                    return { byStack: { ...state.byStack, [aId]: curr.filter(b => b.entry_id !== entryId) } };
                });
            },
            isBookmarked: (entryId) => {
                const aId =
                    useSettingsStore.getState().activeStackId ||
                    Object.keys(useSettingsStore.getState().stacks || {})[0] ||
                    "default";
                const curr = get().byStack[aId] ?? [];
                return curr.some(b => b.entry_id === entryId);
            },
            clear: () => {
                const aId =
                    useSettingsStore.getState().activeStackId ||
                    Object.keys(useSettingsStore.getState().stacks || {})[0] ||
                    "default";
                set((state) => ({ byStack: { ...state.byStack, [aId]: [] } }));
            },
        }),
        { name: "corpan-bookmarks" }
    )
);