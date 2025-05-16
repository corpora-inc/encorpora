import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EntryOut = {
    entry_id: number;
    en_text: string;
    level: string;
    domains: string[];
    translations: { language_code: string; text: string }[];
};

type HistoryState = {
    history: EntryOut[];
    index: number;
    setHistory: (history: EntryOut[], index?: number) => void;
    pushEntry: (entry: EntryOut) => void;
    setIndex: (index: number) => void;
    clear: () => void;
};

export const useHistoryStore = create<HistoryState>()(
    persist(
        (set, get) => ({
            history: [],
            index: -1,
            setHistory: (history, index = -1) => set({ history, index }),
            pushEntry: (entry) => {
                const { history, index } = get();
                const next = [...history.slice(0, index + 1), entry];
                set({ history: next, index: next.length - 1 });
            },
            setIndex: (index) => set({ index }),
            clear: () => set({ history: [], index: -1 }),
        }),
        { name: "corpan-history" }
    )
);
