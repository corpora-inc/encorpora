import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EntryOut } from "./history";

type BookmarkState = {
    bookmarks: EntryOut[];
    addBookmark: (entry: EntryOut) => void;
    removeBookmark: (entryId: number) => void;
    isBookmarked: (entryId: number) => boolean;
    clear: () => void;
};

export const useBookmarkStore = create<BookmarkState>()(
    persist(
        (set, get) => ({
            bookmarks: [],
            addBookmark: (entry) => {
                const { bookmarks } = get();
                const exists = bookmarks.find(b => b.entry_id === entry.entry_id);
                if (!exists) {
                    set({ bookmarks: [...bookmarks, entry] });
                }
            },
            removeBookmark: (entryId) => {
                const { bookmarks } = get();
                set({ bookmarks: bookmarks.filter(b => b.entry_id !== entryId) });
            },
            isBookmarked: (entryId) => {
                const { bookmarks } = get();
                return bookmarks.some(b => b.entry_id === entryId);
            },
            clear: () => set({ bookmarks: [] }),
        }),
        { name: "corpan-bookmarks" }
    )
);