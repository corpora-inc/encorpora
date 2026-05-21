// src/store/history.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useSettingsStore } from "./settings";

/**
 * v0.7.0: Per-stack history (IDs only).
 * v0.15.0 (v3): each id is paired with a `source` so phrase-pack entries
 * resolve back to the same pack on revisit. `(source, entryId)` is the
 * canonical lookup tuple — `entryId` alone collides across packs.
 *
 * byStack[stackId] = { ids, sources, index }
 */

type StackHistory = {
    ids: number[];
    /** Parallel to `ids`. "base" for bundled-corpus entries, or the
     *  phrase-pack id (e.g. "phrase-botany-basics"). */
    sources: string[];
    index: number;
};

/** Anti-repetition tuple shape matches the Rust `ExcludeEntry` struct
 *  (serde camelCase). Send this verbatim as `exclude` to the sampler. */
export type HistoryTuple = {
    source: string;
    entryId: number;
};

type HistoryState = {
    byStack: Record<string, StackHistory>;

    setHistory: (ids: number[], sources: string[], index?: number) => void;
    /** Push an entry to history. `source` defaults to `"base"` if omitted
     *  (used by older callers that haven't been updated yet). */
    pushEntry: (entryId: number, source?: string) => void;
    setIndex: (index: number) => void;
    /**
     * Gaslight: replace the entry id at the current index with a new id +
     * source. Used when a history entry references a row that has since
     * been pruned (or whose pack has been uninstalled) — we silently swap
     * in a same-level entry the caller has already fetched, and the user
     * never sees the missing row.
     */
    replaceCurrent: (entryId: number, source?: string) => void;
    /** Most-recent N `(source, entryId)` tuples from the active stack's
     *  history, newest first. Fed to the Rust sampler as the anti-
     *  repetition `exclude` list. Safe to call at any time — returns
     *  `[]` when the stack has no history yet. */
    getRecentTuples: (n: number) => HistoryTuple[];
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
                sources: ids.map(() => "base"),
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

                setHistory: (ids, sources, index = -1) => {
                    const aId =
                        useSettingsStore.getState().activeStackId ||
                        Object.keys(useSettingsStore.getState().stacks || {})[0] ||
                        "default";
                    const { byStack } = get();
                    const normalizedSources = ids.map(
                        (_, i) => sources[i] ?? "base",
                    );
                    const next: StackHistory = {
                        ids: [...ids],
                        sources: normalizedSources,
                        index: Math.min(Math.max(index, -1), ids.length - 1),
                    };
                    set({ byStack: { ...byStack, [aId]: next } });
                },

                // Always append to the end and jump to tail (no truncation).
                pushEntry: (entryId: number, source: string = "base") => {
                    const aId =
                        useSettingsStore.getState().activeStackId ||
                        Object.keys(useSettingsStore.getState().stacks || {})[0] ||
                        "default";

                    set((state) => {
                        const curr =
                            state.byStack[aId] ?? { ids: [], sources: [], index: -1 };
                        const ids = [...curr.ids, entryId];
                        const sources = [...curr.sources, source];
                        return {
                            byStack: {
                                ...state.byStack,
                                [aId]: { ids, sources, index: ids.length - 1 },
                            },
                        };
                    });
                },

                // Only move the pointer (do not change ids). Clone arrays to
                // keep referential updates tidy.
                setIndex: (index) => {
                    const aId =
                        useSettingsStore.getState().activeStackId ||
                        Object.keys(useSettingsStore.getState().stacks || {})[0] ||
                        "default";
                    const { byStack } = get();
                    const curr =
                        byStack[aId] ?? { ids: [], sources: [], index: -1 };

                    const clamped = Math.min(Math.max(index, -1), curr.ids.length - 1);
                    const next: StackHistory = {
                        ids: [...curr.ids],
                        sources: [...curr.sources],
                        index: clamped,
                    };

                    set({ byStack: { ...byStack, [aId]: next } });
                },

                replaceCurrent: (entryId: number, source: string = "base") => {
                    const aId =
                        useSettingsStore.getState().activeStackId ||
                        Object.keys(useSettingsStore.getState().stacks || {})[0] ||
                        "default";

                    set((state) => {
                        const curr = state.byStack[aId];
                        if (!curr || curr.index < 0 || curr.index >= curr.ids.length) {
                            // Nothing to replace — fall back to push so we don't drop the entry.
                            const ids = curr ? [...curr.ids, entryId] : [entryId];
                            const sources = curr
                                ? [...curr.sources, source]
                                : [source];
                            return {
                                byStack: {
                                    ...state.byStack,
                                    [aId]: {
                                        ids,
                                        sources,
                                        index: ids.length - 1,
                                    },
                                },
                            };
                        }
                        const ids = [...curr.ids];
                        const sources = [...curr.sources];
                        ids[curr.index] = entryId;
                        sources[curr.index] = source;
                        return {
                            byStack: {
                                ...state.byStack,
                                [aId]: { ids, sources, index: curr.index },
                            },
                        };
                    });
                },

                getRecentTuples: (n: number): HistoryTuple[] => {
                    if (n <= 0) return [];
                    const aId =
                        useSettingsStore.getState().activeStackId ||
                        Object.keys(useSettingsStore.getState().stacks || {})[0] ||
                        "default";
                    const curr = get().byStack[aId];
                    if (!curr || curr.ids.length === 0) return [];
                    // Walk backwards from the tail so the most recent
                    // entry is first. Cap at the available length so a
                    // short history doesn't pad with garbage.
                    const limit = Math.min(n, curr.ids.length);
                    const out: HistoryTuple[] = [];
                    for (let i = curr.ids.length - 1; i >= curr.ids.length - limit; i--) {
                        out.push({
                            source: curr.sources[i] ?? "base",
                            entryId: curr.ids[i],
                        });
                    }
                    return out;
                },

                clear: () => {
                    const aId =
                        useSettingsStore.getState().activeStackId ||
                        Object.keys(useSettingsStore.getState().stacks || {})[0] ||
                        "default";
                    const { byStack } = get();
                    set({
                        byStack: {
                            ...byStack,
                            [aId]: { ids: [], sources: [], index: -1 },
                        },
                    });
                },
            };
        },
        {
            name: "corpan-history-v2",
            version: 3,
            migrate: (state: any, version) => {
                // v2 → v3: backfill `sources` for legacy entries. Treat
                // every legacy id as base — the user explicitly said they
                // don't care about non-base legacy entries, just don't
                // break the *fresh* phrase-pack pushes that have proper
                // sources recorded going forward.
                if (version < 3 && state?.byStack) {
                    for (const stack of Object.values<any>(state.byStack)) {
                        if (!Array.isArray(stack?.sources)) {
                            stack.sources = Array.isArray(stack?.ids)
                                ? stack.ids.map(() => "base")
                                : [];
                        }
                    }
                }
                return state;
            },
            // No partialize: persist will ignore functions; we keep it simple & type-safe.
        }
    )
);
