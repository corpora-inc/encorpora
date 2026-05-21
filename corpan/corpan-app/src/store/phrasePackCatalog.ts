// src/store/phrasePackCatalog.ts
//
// Zustand store for the dedicated phrase-pack catalog.
// Parallel to `useCatalogStore` (which serves games / readers / narrations
// from the v3 catalog), but independent: phrase packs are written directly
// to S3 by the publisher with no PR or build, so this store ticks on a
// much shorter TTL (5 min vs. v3's 1 h).
//
// Persisted to localStorage so the UI renders instantly on launch from
// the last-fetched copy even while a fresh fetch is in flight (or while
// offline).

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
    fetchPhrasePackCatalog,
    type PhrasePackCatalog,
} from "@/contentPacks/phrasePackCatalog";
import { getNetworkStatus, listenToNetworkChanges } from "@/utils/network";

/** 5 minutes. The publisher uploads catalog.json with
 *  `Cache-Control: public, max-age=300, must-revalidate`, so this matches
 *  what CloudFront serves to clients. Force-refresh via `clearCache()`
 *  or by passing `true` to `fetchCatalog`. */
const CACHE_DURATION = 5 * 60 * 1000;

type PhrasePackCatalogState = {
    catalog: PhrasePackCatalog | null;
    lastFetched: number | null;
    isOnline: boolean;
    isFetching: boolean;

    fetchCatalog: (force?: boolean) => Promise<void>;
    setOnlineStatus: (online: boolean) => void;
    clearCache: () => void;
};

export const usePhrasePackCatalogStore = create<PhrasePackCatalogState>()(
    persist(
        (set, get) => ({
            catalog: null,
            lastFetched: null,
            isOnline: getNetworkStatus(),
            isFetching: false,

            fetchCatalog: async (force = false) => {
                const state = get();
                if (state.isFetching) return;
                const now = Date.now();
                if (
                    !force &&
                    state.lastFetched &&
                    state.catalog &&
                    now - state.lastFetched < CACHE_DURATION
                ) {
                    return;
                }
                if (!state.isOnline) {
                    console.log("[phrase-pack catalog] offline; skipping fetch");
                    return;
                }
                set({ isFetching: true });
                try {
                    const catalog = await fetchPhrasePackCatalog();
                    set({
                        catalog: catalog ?? state.catalog,
                        lastFetched: catalog ? now : state.lastFetched,
                        isFetching: false,
                    });
                } catch (err) {
                    console.error("[phrase-pack catalog] fetch failed:", err);
                    set({ isFetching: false });
                }
            },

            setOnlineStatus: (online: boolean) => {
                set({ isOnline: online });
                if (online) {
                    const state = get();
                    const now = Date.now();
                    if (
                        !state.lastFetched ||
                        now - state.lastFetched >= CACHE_DURATION
                    ) {
                        void get().fetchCatalog();
                    }
                }
            },

            clearCache: () => {
                set({ catalog: null, lastFetched: null });
                void get().fetchCatalog(true);
            },
        }),
        {
            name: "corpan-phrase-pack-catalog-v1",
            version: 1,
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                catalog: state.catalog,
                lastFetched: state.lastFetched,
            }),
        },
    ),
);

if (typeof window !== "undefined") {
    listenToNetworkChanges((online) => {
        usePhrasePackCatalogStore.getState().setOnlineStatus(online);
    });
}
