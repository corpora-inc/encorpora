// src/store/wordPackCatalog.ts
//
// Zustand store for the dedicated WORD-PACK index. Parallel to
// `usePhrasePackCatalogStore`: word packs are written directly to S3 by the
// publisher with no PR or build, so this store ticks on a short TTL (5 min)
// and is independent of the v3 catalog (`useCatalogStore`).
//
// Persisted so the Settings discovery list renders instantly on launch from
// the last-fetched copy even while a fresh fetch is in flight (or offline).
// The index is tiny (a handful of entries) so plain localStorage is fine —
// unlike the phrase-pack catalog which uses the IndexedDB LARGE tier.

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
    fetchWordPackCatalogFresh,
    type WordPackCatalog,
} from "@/contentPacks/wordPackCatalog";
import { getNetworkStatus, listenToNetworkChanges } from "@/utils/network";

/** 5 minutes — matches the CloudFront Cache-Control on the published index. */
const CACHE_DURATION = 5 * 60 * 1000;

type WordPackCatalogState = {
    catalog: WordPackCatalog | null;
    lastFetched: number | null;
    /** Last freshness check (304/error included); distinct from a successful
     *  refresh (`lastFetched`). */
    lastChecked: number | null;
    /** HTTP validators for conditional revalidation (cheap 304 polls). */
    etag: string | null;
    lastModified: string | null;
    isOnline: boolean;
    isFetching: boolean;

    fetchCatalog: (force?: boolean) => Promise<void>;
    setOnlineStatus: (online: boolean) => void;
    clearCache: () => void;
};

export const useWordPackCatalogStore = create<WordPackCatalogState>()(
    persist(
        (set, get) => ({
            catalog: null,
            lastFetched: null,
            lastChecked: null,
            etag: null,
            lastModified: null,
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
                    console.log("[word-pack catalog] offline; skipping fetch");
                    return;
                }
                set({ isFetching: true });
                try {
                    const haveCache = !!get().catalog;
                    const validators =
                        force || !haveCache
                            ? undefined
                            : {
                                  etag: get().etag,
                                  lastModified: get().lastModified,
                              };
                    const r = await fetchWordPackCatalogFresh(validators);
                    if (r.status === "unchanged") {
                        set({ lastFetched: now, lastChecked: now });
                    } else {
                        set({
                            catalog: r.data,
                            etag: r.validators.etag ?? null,
                            lastModified: r.validators.lastModified ?? null,
                            lastFetched: now,
                            lastChecked: now,
                        });
                    }
                } catch (err) {
                    console.warn("[word-pack catalog] fetch failed:", err);
                    // Keep the existing cached catalog; record the attempt.
                    set({ lastChecked: now });
                } finally {
                    // ALWAYS clear the in-flight flag so a failed/timed-out
                    // fetch can never wedge `isFetching` true.
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
                set({
                    catalog: null,
                    lastFetched: null,
                    lastChecked: null,
                    etag: null,
                    lastModified: null,
                });
                void get().fetchCatalog(true);
            },
        }),
        {
            name: "corpan-word-pack-catalog-v1",
            version: 1,
            partialize: (state) => ({
                catalog: state.catalog,
                lastFetched: state.lastFetched,
                lastChecked: state.lastChecked,
                etag: state.etag,
                lastModified: state.lastModified,
            }),
        },
    ),
);

if (typeof window !== "undefined") {
    listenToNetworkChanges((online) => {
        useWordPackCatalogStore.getState().setOnlineStatus(online);
    });
}
